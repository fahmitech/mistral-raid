# Boss Voice Improvements — Test Implementation Plan

## Completion Status

Implemented on **2026-03-11**.

Coverage added in:
- `server/src/services/__tests__/mistralService.test.ts`
- `server/src/services/__tests__/bossVoiceService.test.ts`
- `client/src/systems/__tests__/BossVoicePlayer.test.ts`
- `server/src/services/__tests__/sessionManager.test.ts`

Verification:
- `npx vitest run server/src/services/__tests__/mistralService.test.ts server/src/services/__tests__/bossVoiceService.test.ts client/src/systems/__tests__/BossVoicePlayer.test.ts`

> **Framework:** Vitest (v4.0.18), Node environment
> **Run:** `npm test` (root)
> **Conventions:** Follow existing patterns from `server/src/services/__tests__/`

---

## Test File Map

| Improvement | Test File | New/Extend |
|---|---|---|
| 1. Conversation memory | `server/src/services/__tests__/mistralService.test.ts` | Extend |
| 2. Speech engagement (prompt) | `server/src/services/__tests__/mistralService.test.ts` | Extend |
| 3. Emotional arc (prompt) | `server/src/services/__tests__/mistralService.test.ts` | Extend |
| 4. Taunt word limit | `server/src/services/__tests__/mistralService.test.ts` | Extend |
| 5. Dynamic music duck | `client/src/systems/__tests__/BossVoicePlayer.test.ts` | New |
| 6. Voice settings by HP | `server/src/services/__tests__/bossVoiceService.test.ts` | New |

---

## Shared Helpers (already exist — must be updated)

### Session factory — needs `conversationHistory` field

**File:** `server/src/services/__tests__/sessionManager.test.ts` line 5-34

The `createSession()` factory must include the new field. Since each test file has its own copy, update each one that's touched.

```ts
conversationHistory: [],
```

Add after `rollingDebateNotes: '',` in every `createSession()` helper.

### TelemetrySummary factory

**File:** `server/src/services/__tests__/playerProfile.test.ts` lines 10-37

Reuse the `makeTelemetry()` pattern. Copy into `mistralService.test.ts` for prompt-building tests.

---

## Test Group 1: Conversation Memory

**File:** `server/src/services/__tests__/mistralService.test.ts`
**Extend:** Add a new `describe('buildUserPrompt')` block.

### Test 1.1: Prompt omits history block when history is empty

```
describe('buildUserPrompt', () => {
  it('omits history section when conversationHistory is empty')
```

**Setup:** Call `buildUserPrompt('hello', telemetry, storyContext, [])`.
**Assert:** Returned string does NOT contain `'Prior exchanges'`.

### Test 1.2: Prompt includes history block when history is provided

```
  it('includes prior exchanges when conversationHistory has entries')
```

**Setup:** Call `buildUserPrompt('hello', telemetry, storyContext, [{ player: 'die', boss: 'Noted.' }])`.
**Assert:**
- Returned string contains `'Prior exchanges (most recent last):'`
- Returned string contains `'[1] Subject: "die" -> You responded: "Noted."'`

### Test 1.3: Prompt includes multiple history entries in order

```
  it('formats multiple history entries in ascending order')
```

**Setup:** Pass 3 entries to history.
**Assert:**
- Contains `[1]`, `[2]`, `[3]` in order
- First entry's player text comes before the last entry's player text

### Test 1.4: History is recorded after successful LLM response

```
  it('pushes exchange to session.conversationHistory on success')
```

**Setup:**
- Mock `complete` to return a valid response
- Create a session with `conversationHistory: []`
- Call `generateBossReply('test speech', null, session, false)`

**Assert:**
- `session.conversationHistory` has length 1
- `session.conversationHistory[0].player` === `'test speech'`
- `session.conversationHistory[0].boss` is the returned taunt string

### Test 1.5: History is bounded to 4 entries (oldest removed)

```
  it('caps conversationHistory at 4 entries, removing oldest')
```

**Setup:**
- Create session with `conversationHistory` pre-filled with 4 entries: `[{player:'a',...}, {player:'b',...}, {player:'c',...}, {player:'d',...}]`
- Mock `complete` for success
- Call `generateBossReply('e', null, session, false)`

**Assert:**
- `session.conversationHistory.length` === 4
- First entry's player is `'b'` (oldest `'a'` was shifted)
- Last entry's player is `'e'` (new entry appended)

### Test 1.6: Fallback response does NOT record history

```
  it('does not record history when all models fail and fallback is returned')
```

**Setup:**
- Mock `complete` to always reject
- Create session with `conversationHistory: []`
- Call `generateBossReply('test', null, session, false)`

**Assert:**
- `session.conversationHistory.length` === 0

---

## Test Group 2: Speech Engagement (prompt content)

**File:** `server/src/services/__tests__/mistralService.test.ts`
**Extend:** Inside the `describe('buildUserPrompt')` block.

### Test 2.1: ARCHITECT prompt contains speech engagement rules

```
  it('system prompt includes speech engagement rules')
```

**Setup:** Import and read `ARCHITECT_SYSTEM_PROMPT` (not exported — test indirectly).

**Alternative approach:** Since the prompt is a module-level const and not exported, test it indirectly via `generateBossReply`. Inspect `mocks.complete.mock.calls[0][0].messages[0].content`.

**Assert:**
- System message content contains `'SPEECH ENGAGEMENT RULES'`
- System message content contains `'Never ignore what was said'`

---

## Test Group 3: Emotional Arc (tone directive)

**File:** `server/src/services/__tests__/mistralService.test.ts`
**Extend:** Inside the `describe('buildUserPrompt')` block.

### Test 3.1: High HP (>60%) produces clinical detachment tone

```
  it('includes clinical detachment tone when bossHpPercent > 60')
```

**Setup:** Call `buildUserPrompt('test', makeTelemetry({ bossHpPercent: 80 }), storyContext)`.
**Assert:** Returned string contains `'Clinical detachment'`.

### Test 3.2: Mid HP (30-60%) produces reluctant recognition tone

```
  it('includes reluctant recognition tone when bossHpPercent is 31-60')
```

**Setup:** Call with `bossHpPercent: 45`.
**Assert:** Contains `'Reluctant recognition'`.

### Test 3.3: Low HP (1-30%) produces facade cracking tone

```
  it('includes facade cracking tone when bossHpPercent is 1-30')
```

**Setup:** Call with `bossHpPercent: 15`.
**Assert:** Contains `'facade cracks'`.

### Test 3.4: Zero HP produces no tone directive

```
  it('omits tone directive when bossHpPercent is 0')
```

**Setup:** Call with `bossHpPercent: 0`.
**Assert:** Does NOT contain `'Tone:'`.

---

## Test Group 4: Taunt Word Limit

**File:** `server/src/services/__tests__/mistralService.test.ts`
**Extend:** Add a new `describe('validateBossResponse')` block.

Since `validateBossResponse` is not exported, test indirectly through `generateBossReply` by controlling the mock response content.

### Test 4.1: Taunt under 50 words is preserved

```
  it('preserves taunt under 50 words')
```

**Setup:** Mock `complete` to return a taunt with 30 words.
**Assert:** Returned `response.taunt` word count === 30 (no trimming).

### Test 4.2: Taunt over 50 words is trimmed to 50

```
  it('trims taunt to 50 words when exceeding limit')
```

**Setup:** Mock `complete` to return a taunt with 70 words (e.g., `'word '.repeat(70).trim()`).
**Assert:** Returned `response.taunt` split by spaces has length 50.

### Test 4.3: Taunt at exactly 50 words is preserved

```
  it('preserves taunt at exactly 50 words')
```

**Setup:** Mock `complete` to return exactly 50 words.
**Assert:** Word count === 50.

---

## Test Group 5: Dynamic Music Duck

**File:** `client/src/systems/__tests__/BossVoicePlayer.test.ts` (NEW)

### Mocking Strategy

BossVoicePlayer depends on:
- `AudioManager.get().duckMusic(vol, dur)` — mock with `vi.fn()`
- `MediaSource` — mock globally or skip streaming tests
- `Audio` (HTMLAudioElement) — mock globally
- `URL.createObjectURL` / `URL.revokeObjectURL` — mock globally
- `atob` / `btoa` — available in Node 16+

```ts
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const mockDuckMusic = vi.fn();

vi.mock('../AudioManager', () => ({
  AudioManager: {
    get: () => ({
      duckMusic: mockDuckMusic,
    }),
  },
}));
```

Mock HTMLAudioElement:

```ts
class MockAudio {
  volume = 1;
  preload = '';
  currentTime = 0;
  onended: (() => void) | null = null;
  onpause: (() => void) | null = null;
  onerror: (() => void) | null = null;
  play() { return Promise.resolve(); }
  pause() {}
}

vi.stubGlobal('Audio', MockAudio);
vi.stubGlobal('URL', {
  createObjectURL: vi.fn(() => 'blob:mock'),
  revokeObjectURL: vi.fn(),
});
vi.stubGlobal('atob', (s: string) => Buffer.from(s, 'base64').toString('binary'));
vi.stubGlobal('btoa', (s: string) => Buffer.from(s, 'binary').toString('base64'));
```

### Test 5.1: play() ducks music with long ceiling

```
describe('BossVoicePlayer', () => {
  it('ducks music to 0.3 with 60s ceiling on play()')
```

**Setup:** Import `bossVoicePlayer`. Call `bossVoicePlayer.play(validBase64, 'mp3')`.
**Assert:** `mockDuckMusic` called with `(0.3, 60.0)`.

### Test 5.2: play() restores music on audio end

```
  it('restores music to 1.0 on audio ended event')
```

**Setup:** Call `bossVoicePlayer.play(validBase64, 'mp3')`. Trigger `onended` on the internal Audio element.
**Assert:** `mockDuckMusic` was called with `(1.0, 0.5)`.

**Implementation note:** Access the internal Audio via the mock — when `new Audio()` is called, capture the instance. The `onended` callback is set on it. Trigger it manually.

### Test 5.3: play() restores music on audio error

```
  it('restores music to 1.0 on audio error event')
```

**Setup:** Call `bossVoicePlayer.play(...)`. Trigger `onerror`.
**Assert:** `mockDuckMusic` called with `(1.0, 0.5)`.

### Test 5.4: stop() restores music immediately

```
  it('restores music to 1.0 with 0.3s ramp on stop()')
```

**Setup:** Call `bossVoicePlayer.play(...)` then `bossVoicePlayer.stop()`.
**Assert:** `mockDuckMusic` called with `(1.0, 0.3)`.

### Test 5.5: stop() without prior play does not crash

```
  it('does not throw when stop() is called without active playback')
```

**Setup:** Call `bossVoicePlayer.stop()` on a fresh instance (no prior play).
**Assert:** No throw. `mockDuckMusic` called with restore values (harmless no-op).

---

## Test Group 6: Voice Settings by Boss HP Phase

**File:** `server/src/services/__tests__/bossVoiceService.test.ts` (NEW)

### Mocking Strategy

`bossVoiceService.synthesize()` depends on:
- `process.env.ENABLE_AI_SPEECH` — set to `'true'`
- `process.env.ELEVENLABS_API_KEY` — set to `'test-key'`
- `ws` (WebSocket constructor) — mock to capture the init payload
- `sessionManager.setTurnState` — mock with `vi.fn()`
- `WebSocketServer.sendToClient` — mock with `vi.fn()`

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSend = vi.fn();
const mockSetTurnState = vi.fn();
const mockSendToClient = vi.fn();

let capturedWsHandlers: Record<string, Function> = {};

vi.mock('ws', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      readyState: 1,  // WebSocket.OPEN
      OPEN: 1,
      CONNECTING: 0,
      send: mockSend,
      close: vi.fn(),
      on: vi.fn((event: string, handler: Function) => {
        capturedWsHandlers[event] = handler;
      }),
      once: vi.fn((event: string, handler: Function) => {
        if (event === 'open') handler();  // Auto-resolve open
      }),
      removeAllListeners: vi.fn(),
    })),
    WebSocket: { OPEN: 1, CONNECTING: 0 },
  };
});

vi.mock('../sessionManager.js', () => ({
  setTurnState: mockSetTurnState,
}));

vi.mock('../../ws/WebSocketServer.js', () => ({
  sendToClient: mockSendToClient,
}));
```

Session factory (minimal):

```ts
function makeSession(): Session {
  return {
    id: 'test',
    turnState: 'AI_SPEAKING',
    aiState: 'speaking',
    // ... (same pattern as sessionManager.test.ts)
    activeTTSAbort: null,
  } as any;
}
```

### Test 6.1: Default voice settings when bossHpPercent is undefined

```
describe('bossVoiceService.synthesize', () => {
  it('uses default voice settings when bossHpPercent is undefined')
```

**Setup:** Call `synthesize(session, 'test taunt')` (no 3rd arg).
**Assert:** First `mockSend` call (init payload) parses to JSON with:
- `voice_settings.stability === 0.3`
- `voice_settings.style === 0.5`
- `voice_settings.speed === 0.9`

**How to extract:** `JSON.parse(mockSend.mock.calls[0][0]).voice_settings`

**Important:** The WebSocket `on('close')` handler must be triggered to resolve the Promise. After asserting the send payload, trigger `capturedWsHandlers['close']?.()` to finalize.

### Test 6.2: Default voice settings when bossHpPercent > 60

```
  it('uses default voice settings when bossHpPercent > 60')
```

**Setup:** Call `synthesize(session, 'test', 80)`.
**Assert:** Init payload `voice_settings` matches defaults (0.3, 0.5, 0.9).

### Test 6.3: Mid HP settings when bossHpPercent is 31-60

```
  it('uses mid-phase voice settings when bossHpPercent is 31-60')
```

**Setup:** Call `synthesize(session, 'test', 45)`.
**Assert:** Init payload `voice_settings`:
- `stability === 0.25`
- `style === 0.65`
- `speed === 0.95`

### Test 6.4: Low HP settings when bossHpPercent <= 30

```
  it('uses low-phase voice settings when bossHpPercent <= 30')
```

**Setup:** Call `synthesize(session, 'test', 20)`.
**Assert:** Init payload `voice_settings`:
- `stability === 0.15`
- `style === 0.8`
- `speed === 1.0`

### Test 6.5: Boundary — bossHpPercent exactly 30 uses low settings

```
  it('uses low-phase settings at exactly 30%')
```

**Setup:** Call `synthesize(session, 'test', 30)`.
**Assert:** `stability === 0.15`.

### Test 6.6: Boundary — bossHpPercent exactly 60 uses mid settings

```
  it('uses mid-phase settings at exactly 60%')
```

**Setup:** Call `synthesize(session, 'test', 60)`.
**Assert:** `stability === 0.25`.

### Test 6.7: Does not mutate the BOSS_VOICE constant

```
  it('does not mutate the global BOSS_VOICE voice_settings object')
```

**Setup:**
- Call `synthesize(session, 'test', 10)` (low HP, changes settings)
- Call `synthesize(session2, 'test')` (no HP, should use defaults)

**Assert:** Second call's init payload has default stability (0.3), proving the first call didn't mutate the original.

---

## Implementation Order

```
1. Update createSession() in sessionManager.test.ts — add conversationHistory field
2. Test Group 4 (taunt word limit) — trivial, validates existing change
3. Test Group 1 (conversation memory) — core feature tests
4. Test Group 3 (emotional arc) — buildUserPrompt tone tests
5. Test Group 2 (speech engagement) — prompt content test
6. Test Group 6 (voice settings) — new test file, moderate mock setup
7. Test Group 5 (music duck) — new test file, most complex mocks
```

## Run & Verify

```bash
# Run all tests
npm test

# Run only the files we touched/created
npx vitest run server/src/services/__tests__/mistralService.test.ts
npx vitest run server/src/services/__tests__/bossVoiceService.test.ts
npx vitest run client/src/systems/__tests__/BossVoicePlayer.test.ts

# Run with coverage to confirm new code paths are hit
npm run test:coverage
```

## What We Don't Test (and why)

| Excluded | Reason |
|---|---|
| Prompt quality / LLM output quality | Non-deterministic. Test prompt structure, not output. |
| ElevenLabs audio quality per HP phase | Requires real API. Test that correct settings are sent. |
| End-to-end voice loop latency | Integration test, not unit. Would need real WS + Voxtral. |
| MicCapture / VAD behavior | No changes made to MicCapture in this plan. |
| ArenaScene message routing | No changes made to ArenaScene handler dispatch. |
