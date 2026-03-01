# Plan: Voice Pipeline Latency Optimization

> **Problem**: Indonesia → Paris RTT (~200ms) compounds across 3 sequential API calls (Voxtral STT, Mistral LLM, ElevenLabs TTS), creating 2.6–4s perceived delay from T-key release to boss audio. The arena voice loop feels laggy and breaks conversational flow.

## Current Latency Breakdown (IDN → Paris, 200ms RTT)

```
[T key up] ─→ await stt.task ─→ await generateBossReply() ─→ void synthesizeBossVoice()
               ~300-500ms          ~1200-1900ms                  ~800-1100ms (parallel)
                                   ↑ BIGGEST KILLER              + 300-500ms browser buffer
```

**Total voice-heard latency: ~2600–4000ms after T release**

## Optimization Targets

| # | Optimization | Expected Savings | Risk |
|---|-------------|-----------------|------|
| 1 | Swap LLM cascade: `ministral-8b` first | **800–1200ms** | Lower quality taunts |
| 2 | Speculative TTS warmup during LLM wait | **~150ms** | Wasted WS if LLM fails |
| 3 | Fix `targetStreamingDelayMs` passthrough | **80–160ms** | None |
| 4 | Reduce boss reply cooldown 4s → 2s | **2000ms felt** | Boss spam if too low |
| 5 | Keep Voxtral WS warm between turns | **~200ms/turn** | Idle connection mgmt |

**Combined expected improvement: ~1200–1700ms off critical path + 2000ms felt improvement**
**Target: <2s voice-heard latency from T release**

---

## Task 1: Fix `targetStreamingDelayMs` Passthrough

### Problem
`STT_TARGET_DELAY_MS` is parsed at `voxtralSTT.ts:10` but never passed to `transcribeStream()`. Voxtral buffers at its own default, ignoring the env config.

### Changes

**File: `server/src/services/voxtralSTT.ts`**

In `startStreaming()` (line 79–83), pass `targetStreamingDelayMs` as third-arg option:
```ts
for await (const event of getClient().transcribeStream(
  queue,
  'voxtral-mini-transcribe-realtime-2602',
  {
    audioFormat: { encoding: AudioEncoding.PcmS16le, sampleRate: 16000 },
    targetStreamingDelayMs: STT_TARGET_DELAY_MS,
  }
)) {
```

Same fix in `transcribeAndRespond()` (line 167–170).

### Validation
- Log `[stt] targetStreamingDelayMs=${STT_TARGET_DELAY_MS}` on stream start
- Verify partial captions arrive within configured delay window

---

## Task 2: Swap LLM Model Cascade Order for Voice Path

### Problem
`mistralService.ts:119-122` tries `mistral-small-latest` (4s timeout) first. For a 30-word taunt + 2-3 mechanics JSON, `ministral-8b-latest` is 3-4x faster (~300-600ms inference vs ~800-1500ms) and produces adequate output.

### Changes

**File: `server/src/services/mistralService.ts`**

Introduce a separate voice-optimized cascade. The existing `MODEL_CASCADE` stays for `handleAnalyze` (phase transitions where quality matters more). Add a new `VOICE_CASCADE` used by the voice path.

```ts
const VOICE_CASCADE: Array<{ model: string; timeout: number }> = [
  { model: 'ministral-8b-latest', timeout: 2500 },
  { model: 'mistral-small-latest', timeout: 3000 },
];
```

Add an optional `fastMode` parameter to `generateBossReply`:
```ts
export async function generateBossReply(
  playerSaid: string,
  telemetry: TelemetrySummary | null,
  session?: Session,
  fastMode = false,           // ← new
): Promise<BossResponse> {
  // ...
  const cascade = fastMode ? VOICE_CASCADE : MODEL_CASCADE;
  for (const { model, timeout } of cascade) {
    // existing logic
  }
}
```

**File: `server/src/services/voxtralSTT.ts`**

Both `stopStreaming()` and `transcribeAndRespond()` call `generateBossReply` — pass `fastMode: true`:
```ts
const bossResponse = await generateBossReply(finalTranscript, session.latestTelemetrySummary, session, true);
```

`handleAnalyze` in `mistralService.ts` keeps `fastMode: false` (default) — phase transition analysis deserves the bigger model.

### Validation
- Log `[mistral] voice-fast model=${model}` when voice path fires
- Compare taunt quality between 8b and small (should be acceptable for 1-2 sentence taunts)

---

## Task 3: Speculative TTS WebSocket Warmup

### Problem
ElevenLabs TTS WebSocket opens only AFTER LLM finishes (`voxtralSTT.ts:147`). The WS handshake to ElevenLabs EU costs ~150ms. This happens inside the LLM wait window — wasted time.

### Changes

**File: `server/src/services/bossVoiceService.ts`**

Add a warmup function that opens the ElevenLabs WS and holds it ready:

```ts
interface WarmSocket {
  ws: WebSocket;
  ready: Promise<void>;
  created: number;
}

let warmSocket: WarmSocket | null = null;
const WARM_SOCKET_TTL_MS = 8000;  // discard if unused after 8s

export function warmup(): void {
  if (!ENABLE_AI_SPEECH) return;
  const apiKey = getApiKey();
  if (!apiKey) return;
  if (warmSocket && Date.now() - warmSocket.created < WARM_SOCKET_TTL_MS) return;

  // Close stale socket if any
  if (warmSocket) {
    try { warmSocket.ws.close(); } catch {}
    warmSocket = null;
  }

  const url = buildTtsUrl();
  const ws = new WebSocket(url, { headers: { 'xi-api-key': apiKey } });
  const ready = new Promise<void>((resolve, reject) => {
    ws.on('open', resolve);
    ws.on('error', reject);
  });
  warmSocket = { ws, ready, created: Date.now() };
}
```

Modify `synthesize()` to consume the warm socket if available:
```ts
export async function synthesize(session: Session, tauntText: string): Promise<void> {
  // ... existing guards ...

  let ws: WebSocket;
  if (warmSocket && warmSocket.ws.readyState === WebSocket.OPEN) {
    ws = warmSocket.ws;
    warmSocket = null;  // consumed
  } else {
    ws = new WebSocket(url, { headers: { 'xi-api-key': apiKey } });
    await new Promise<void>((resolve) => ws.on('open', resolve));
  }

  // send init + text + flush (existing logic, refactored to use `ws`)
}
```

Extract `buildTtsUrl()` helper from the existing inline URL construction.

**File: `server/src/services/voxtralSTT.ts`**

In `stopStreaming()`, trigger warmup right when LLM starts (before awaiting it):

```ts
setTurnState(session, 'THINKING');
bossVoiceService.warmup();  // ← speculative: open TTS WS while LLM runs
const bossResponse = await generateBossReply(...);
```

Same in `transcribeAndRespond()`.

### Validation
- Log `[tts] using warm socket` vs `[tts] cold connect`
- Measure time from `synthesize()` call to first `AUDIO_CHUNK` sent — should be ~150ms faster

---

## Task 4: Keep Voxtral WS Warm Between Turns

### Problem
`transcribeStream()` opens a new WebSocket to Voxtral on every call. Each handshake costs ~200ms (TCP + TLS to Paris). For a multi-turn conversation, this adds up.

### Design

The `@mistralai/mistralai` SDK `RealtimeTranscription` class manages connections internally. We need to verify whether the SDK supports connection reuse or if we need a keep-alive approach.

### Changes

**File: `server/src/services/voxtralSTT.ts`**

Option A — SDK connection reuse (preferred if SDK supports it):
The `RealtimeTranscription` client is already cached (`getClient()`). Check if calling `transcribeStream()` on the same client instance reuses the underlying WS. If yes — already handled. If not — proceed to Option B.

Option B — Pre-connect on session start:
```ts
export async function prewarmConnection(): Promise<void> {
  try {
    // Send a tiny silent audio chunk to force WS open
    const silence = new Uint8Array(640); // 20ms of silence @ 16kHz PCM S16LE
    const stream = (async function* () { yield silence; })();
    for await (const event of getClient().transcribeStream(
      stream,
      'voxtral-mini-transcribe-realtime-2602',
      { audioFormat: { encoding: AudioEncoding.PcmS16le, sampleRate: 16000 } }
    )) {
      break; // just need the connection established
    }
    console.log('[stt] Voxtral connection pre-warmed');
  } catch (err) {
    console.warn('[stt] Voxtral prewarm failed (non-fatal):', err);
  }
}
```

Call from `sessionManager.createSession()` and after each `stopStreaming()` completes:
```ts
// sessionManager.ts — in createSession()
void voxtralSTT.prewarmConnection();

// voxtralSTT.ts — end of stopStreaming(), after response sent
void prewarmConnection();
```

### Investigation Required
- Read SDK source or test: does `RealtimeTranscription.transcribeStream()` reuse its WS?
- If yes → no code change needed, just document
- If no → implement Option B

### Validation
- Log `[stt] connection reuse: true/false`
- Measure time from `startStreaming()` to first `transcription.text.delta` — should be ~200ms faster on warm

---

## Task 5: Reduce Boss Reply Cooldown

### Problem
`BOSS_REPLY_COOLDOWN_MS=4000` prevents new boss replies for 4 seconds after the last one. With ~3s of TTS audio, the user effectively waits 7+ seconds between exchanges. Conversation feels broken.

### Changes

**File: `server/.env`**

```diff
-BOSS_REPLY_COOLDOWN_MS=4000
+BOSS_REPLY_COOLDOWN_MS=2000
```

No code change needed — `sessionManager.ts` already reads from env.

### Guard Rail
The existing `canStartBossReply()` already blocks during `THINKING` and `AI_SPEAKING` states. With barge-in support (`handleBargeIn`), the user can interrupt the boss mid-speech. 2000ms cooldown is still enough to prevent accidental double-triggers from fast T-key taps.

### Validation
- Tap T twice quickly (<2s apart) — second should be rejected
- Normal conversation flow: reply should be available ~2s after boss finishes speaking

---

## Implementation Order

```
Task 3: Fix targetStreamingDelayMs     ← trivial, no risk, do first
Task 5: Reduce cooldown 4s → 2s        ← env-only change
Task 2: Swap LLM cascade for voice     ← biggest latency win
Task 1: Speculative TTS warmup         ← moderate refactor
Task 4: Voxtral WS warm-keep           ← needs SDK investigation first
```

## Expected Result After All 5 Tasks

```
BEFORE (IDN → Paris):
  T-release → voice heard: ~2600-4000ms
  Next turn available: ~7000ms

AFTER:
  T-release → voice heard: ~1200-2000ms  (-1400ms from critical path)
  Next turn available: ~3500ms            (-3500ms from felt latency)
```

## Files Modified

| File | Tasks |
|------|-------|
| `server/src/services/voxtralSTT.ts` | 1, 2, 3, 4 |
| `server/src/services/mistralService.ts` | 2 |
| `server/src/services/bossVoiceService.ts` | 3 |
| `server/src/services/sessionManager.ts` | 4 (if prewarm on create) |
| `server/.env` | 5 |

## Non-Goals
- **Edge deployment / CDN proxy** — out of scope for this sprint
- **WebRTC migration** — too large, different architecture
- **Pre-cached boss responses** — breaks the adaptive AI mechanic
- **LLM streaming JSON parse** — `json_object` response format requires full response
