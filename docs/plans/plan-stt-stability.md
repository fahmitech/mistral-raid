# Plan: STT Pipeline Stability Fixes

> **Symptoms**: Flood of `[stt] empty transcript` / `[stt] done chars= 0`, repeated `TypeError: Cannot read properties of undefined (reading 'websocket')` crashes in `applyTargetStreamingDelay`.

## Root Cause Analysis

### Bug 1: `applyTargetStreamingDelay` crashes — SDK private method access

**File**: `server/src/services/voxtralSTT.ts:76-94`

The code extracts `sendJson` from the connection object via unsafe cast:
```ts
const sendJson = (connection as unknown as { sendJson? }).sendJson;
await sendJson({ ... });
```

Two problems:
1. `sendJson` is **private** in the SDK (`connection.ts:277`). Extracting it loses `this` binding → `this.websocket` is `undefined`.
2. Even if the binding were correct, the SDK's public API **does not expose `targetStreamingDelayMs`** in `updateSession()`. The server rejects delay updates after audio starts.

**Fix**: Remove `applyTargetStreamingDelay` entirely. The SDK doesn't support runtime `targetStreamingDelayMs` configuration. Remove `STT_TARGET_DELAY_MS` and all calls to `applyTargetStreamingDelay`.

---

### Bug 2: Audio chunk flood triggers batch path — MicCapture default `transmitEnabled = true`

**File**: `client/src/systems/MicCapture.ts:9`

```ts
private transmitEnabled = true;  // ← PROBLEM
```

The ScriptProcessor sends audio chunks whenever `transmitEnabled` is true (line 133). Since MicCapture defaults to `true`, audio flows continuously from the moment the microphone starts — **before the user ever presses T**.

**Server side** (`WebSocketServer.ts:20-22`):
```ts
const handled = voxtralSTT.pushStreamingAudio(session, data as Buffer);
if (!handled) {
  void voxtralSTT.transcribeAndRespond(session, data as Buffer);
}
```

Every 20ms binary chunk (640 bytes) that arrives without an active `sttStream` triggers a separate `transcribeAndRespond()` call. Each one:
1. Opens a Voxtral connection (~200ms to Paris)
2. Sends 20ms of audio (too short to transcribe)
3. Gets empty transcript → logs `[stt] done chars= 0` / `[stt] empty transcript`
4. Calls `prewarmConnection()` (wastes another Voxtral connection)

At 50 chunks/second, this is **50 Voxtral API calls per second**, all producing empty results.

**Secondary trigger**: After `stopStreaming()` nullifies `sttStream`, any in-flight binary chunks that arrive in the next event loop tick also trigger `transcribeAndRespond`.

**Fix (client)**: Default `transmitEnabled = false`. Audio only flows during PTT.

**Fix (server)**: Add minimum buffer size guard in `transcribeAndRespond` — reject buffers under 3200 bytes (200ms of audio). Also add a guard in the WebSocket handler to silently drop tiny binary chunks instead of calling `transcribeAndRespond`.

---

### Bug 3: Warm connections become stale but pass freshness check

**File**: `server/src/services/voxtralSTT.ts:68-70`

```ts
function isWarmConnectionFresh(entry): boolean {
  return !entry.connection.isClosed && Date.now() - entry.createdAt < STT_WARM_CONN_TTL_MS;
}
```

The SDK's `isClosed` getter checks `this.closed || ws.readyState === CLOSING || CLOSED`. But:
- The server (Paris) may have closed the connection after idle timeout
- The client-side WebSocket hasn't detected the close yet (200ms RTT delay)
- `isClosed` returns `false`, connection passes freshness check
- `acquireConnection` returns a stale connection → `sendAudio` fails silently or returns empty transcript

**Fix**: Wrap `acquireConnection` usage in try-catch with cold connection fallback. If a warm connection fails during `transcribeWithConnection`, discard it and retry with a fresh connection.

---

## Implementation Tasks

### Task 1: Remove `applyTargetStreamingDelay`

**Files**: `server/src/services/voxtralSTT.ts`

1. Delete `applyTargetStreamingDelay` function (lines 76-94)
2. Delete `STT_TARGET_DELAY_MS` constant (line 10)
3. Remove all `await applyTargetStreamingDelay(...)` calls in `acquireConnection` (lines 143, 157, 164)

**Rationale**: The SDK has no public API to set `targetStreamingDelayMs`. The function crashes every time. Removing it eliminates the TypeError flood and the wasted try-catch overhead on every connection.

---

### Task 2: Fix MicCapture default `transmitEnabled`

**Files**: `client/src/systems/MicCapture.ts`

1. Change line 9: `private transmitEnabled = true` → `private transmitEnabled = false`

**Rationale**: In streaming/PTT mode, audio should only flow when the user holds T. The old default caused continuous audio streaming from mic start, flooding the server with untranscribable 20ms chunks.

---

### Task 3: Guard server batch path against tiny chunks

**Files**: `server/src/ws/WebSocketServer.ts`, `server/src/services/voxtralSTT.ts`

1. In `WebSocketServer.ts`, add minimum size check before calling `transcribeAndRespond`:
```ts
if (isBinary) {
  const buf = data as Buffer;
  const handled = voxtralSTT.pushStreamingAudio(session, buf);
  if (!handled) {
    // Reject tiny chunks — need at least 200ms of audio (3200 bytes at 16kHz S16LE)
    if (buf.length >= 3200) {
      void voxtralSTT.transcribeAndRespond(session, buf);
    }
  }
}
```

2. In `transcribeAndRespond`, add an early guard:
```ts
const MIN_UTTERANCE_BYTES = 3200; // 200ms @ 16kHz S16LE
if (utteranceBuffer.length < MIN_UTTERANCE_BYTES) {
  return; // Too short to transcribe meaningfully
}
```

**Rationale**: Even after fixing the client default, late-arriving chunks and edge cases can still trigger the batch path. A server-side guard prevents wasting Voxtral API calls on untranscribable fragments.

---

### Task 4: Add stale connection fallback in `acquireConnection`

**Files**: `server/src/services/voxtralSTT.ts`

Wrap warm connection usage in `startStreaming` and `transcribeAndRespond` with retry logic:

```ts
async function acquireConnection(session: Session): Promise<RealtimeConnection> {
  // Try warm connection first
  const entry = warmConnections.get(session.id);
  if (entry && isWarmConnectionFresh(entry)) {
    warmConnections.delete(session.id);
    console.log('[stt] Using warm Voxtral connection');
    return entry.connection;
  }
  if (entry) {
    discardWarmConnection(session.id);
  }

  // Try pending warm connection
  const pending = warmConnectionPending.get(session.id);
  if (pending) {
    const warmed = await pending;
    const refreshed = warmConnections.get(session.id);
    if (warmed && refreshed && isWarmConnectionFresh(refreshed)) {
      warmConnections.delete(session.id);
      console.log('[stt] Using warm Voxtral connection (awaited)');
      return refreshed.connection;
    }
  }

  // Cold fallback
  console.log('[stt] Using cold Voxtral connection');
  return openConnection();
}
```

And in `startStreaming`/`transcribeAndRespond`, if `transcribeWithConnection` throws, discard the connection and don't call `prewarmConnection` immediately (avoid cascading failures):

```ts
try {
  const connection = await acquireConnection(session);
  for await (const event of transcribeWithConnection(connection, queue)) { ... }
} catch (err) {
  console.warn('[stt] Voxtral stream error:', err);
  // Don't prewarm immediately — might be a network issue
}
```

---

## Implementation Order

```
Task 1: Remove applyTargetStreamingDelay     ← stops the TypeError crash
Task 2: Fix MicCapture transmitEnabled       ← stops the empty transcript flood
Task 3: Guard batch path against tiny chunks ← server-side safety net
Task 4: Stale connection fallback            ← resilience for warm connections
```

Tasks 1-3 are independent and can be done in parallel.
Task 4 depends on Task 1 (removing the applyTargetStreamingDelay calls from acquireConnection).

## Expected Result

- Zero `TypeError: Cannot read properties of undefined` errors
- Zero `[stt] empty transcript` spam from pre-PTT audio
- `transcribeAndRespond` only fires for real utterances (>200ms audio)
- Warm connections that go stale fall back gracefully to cold connections
