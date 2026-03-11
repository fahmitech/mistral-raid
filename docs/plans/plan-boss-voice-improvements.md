# Boss Voice Interaction Improvements — Implementation Plan

> **Goal:** Make talking to the boss feel like a real conversation, not disconnected monologues.
> **Constraint:** Surgical changes only. No file renames, no new dependencies, no architecture changes.

---

## Overview of Changes

| # | Improvement | Files Modified | Risk |
|---|---|---|---|
| 1 | Conversation memory (rolling history) | `mistralService.ts`, `voxtralSTT.ts` | Low |
| 2 | Boss responds to speech content | `mistralService.ts` (prompt only) | Low |
| 3 | Emotional arc by boss HP phase | `mistralService.ts` (prompt only) | Low |
| 4 | Increase taunt word limit 30→50 | `mistralService.ts` (1 line) | Trivial |
| 5 | Dynamic music duck tied to audio lifecycle | `BossVoicePlayer.ts`, `ArenaScene.ts` | Low |
| 6 | Voice settings vary by boss HP phase | `bossVoiceService.ts`, `types.ts`, `WebSocketServer.ts` | Low |

---

## Task 1: Conversation Memory (Rolling History)

### Context
`Session.rollingDebateNotes` exists in `server/src/types.ts:20` but is never read or written.
Every LLM call is stateless — the boss has no memory of previous exchanges within a fight.

### Task 1.1: Add conversation history array to Session type

**File:** `server/src/types.ts`

**Action:** Add a typed array field to Session for structured conversation history.

```ts
// Add after line 20 (rollingDebateNotes)
conversationHistory: Array<{ player: string; boss: string }>;
```

**Why not reuse `rollingDebateNotes`?** It's a plain string with no structure. A typed array is safer to slice/serialize. Keep `rollingDebateNotes` for backward compat (don't remove it).

### Task 1.2: Initialize conversation history in session creation

**File:** `server/src/services/sessionManager.ts`

**Action:** In `createSession()` (line 14-40), add initialization:

```ts
conversationHistory: [],
```

Add this after `rollingDebateNotes: '',` (line 20 of the created session object).

### Task 1.3: Record each exchange after boss reply

**File:** `server/src/services/mistralService.ts`

**Action:** In `generateBossReply()`, after the validated response is returned, push to history. This requires the function to accept the player transcript and session, which it already does.

After `return validateBossResponse(parsed);` (line 296), but **before** the return, record the exchange:

```ts
const validated = validateBossResponse(parsed);

// Record exchange in conversation history (keep last 4)
if (session) {
  session.conversationHistory.push({ player: playerSaid, boss: validated.taunt });
  if (session.conversationHistory.length > 4) {
    session.conversationHistory.shift();
  }
}

return validated;
```

**Safety:** Only pushes on success. Fallback responses don't get recorded (they'd pollute history with canned text).

### Task 1.4: Inject conversation history into the user prompt

**File:** `server/src/services/mistralService.ts`

**Action:** Modify `buildUserPrompt()` (line 360) to accept an optional history parameter and format it.

Add a new parameter:

```ts
export function buildUserPrompt(
  playerSaid: string,
  t: TelemetrySummary,
  context: import('../types.js').StoryContext,
  history?: Array<{ player: string; boss: string }>
): string {
```

Add a history block before the telemetry data section:

```
Prior exchanges (most recent last):
${history.map((h, i) => `[${i+1}] Subject: "${h.player}" → You responded: "${h.boss}"`).join('\n')}
```

If history is empty or undefined, omit the section entirely.

### Task 1.5: Pass history from all call sites

**File:** `server/src/services/mistralService.ts`

**Action:** Update the call to `buildUserPrompt` in `generateBossReply()` (line 254):

```ts
const userPrompt = buildUserPrompt(playerSaid, safeTelemetry, storyContext, session?.conversationHistory);
```

This is the only call site for `buildUserPrompt`.

### Verification
- Start a boss fight, speak 3 times. Confirm from server logs that the 3rd prompt includes the prior 2 exchanges.
- Confirm the boss references something said in a prior exchange.

---

## Task 2: Boss Responds to Speech Content

### Context
The ARCHITECT prompt treats player speech as behavioral metadata ("Subject vocalization"). It doesn't instruct the LLM to engage with what was actually said.

### Task 2.1: Add speech engagement rules to ARCHITECT prompt

**File:** `server/src/services/mistralService.ts`

**Action:** Add to `ARCHITECT_SYSTEM_PROMPT` (after the VOICE RULES section, before EXAMPLE TAUNTS):

```
SPEECH ENGAGEMENT RULES:
- When the subject speaks, acknowledge what they said — then redirect to what it reveals.
- If they threaten you: note the behavioral shift, not the words. "Your voice changed. That is data."
- If they ask a question: answer it obliquely through behavioral observation.
- If they plead or express fear: note it clinically, but with weight. You do not mock vulnerability.
- If they reference prior exchanges: acknowledge continuity. You remember everything.
- Never ignore what was said. Never respond as if they were silent.
```

**Safety:** Prompt-only change. No code logic affected.

---

## Task 3: Emotional Arc by Boss HP Phase

### Context
Elias Thorne is always "exhausted and precise" regardless of fight state. At 10% HP he should sound different than at 90% HP.

### Task 3.1: Add phase-aware tone guidance to the user prompt

**File:** `server/src/services/mistralService.ts`

**Action:** In `buildUserPrompt()`, add a tone directive block based on `bossHpPercent`:

```ts
// After the telemetry section, before "Respond with a JSON..."
let toneDirective = '';
if (t.bossHpPercent > 60) {
  toneDirective = 'Tone: Clinical detachment. You are in full control. The data flows freely.';
} else if (t.bossHpPercent > 30) {
  toneDirective = 'Tone: Reluctant recognition. This subject is not like the others. Your observations carry more weight now. Still precise, but there is something behind the words.';
} else if (t.bossHpPercent > 0) {
  toneDirective = 'Tone: The facade cracks. Thirty years of observation and this subject has reached you. Your precision remains, but urgency bleeds through. You are no longer just reporting — you are witnessing.';
}
```

Insert `${toneDirective}` into the prompt string before the final "Respond with a JSON..." line.

**Safety:** Prompt-only addition. Does not change response format or validation.

---

## Task 4: Increase Taunt Word Limit

### Task 4.1: Change word limit from 30 to 50

**File:** `server/src/services/mistralService.ts`

**Action:** Line 406 — change:

```ts
const taunt = trimTaunt(tauntRaw, 30);
```

to:

```ts
const taunt = trimTaunt(tauntRaw, 50);
```

### Task 4.2: Update the prompt to match

**File:** `server/src/services/mistralService.ts`

**Action:** In `ARCHITECT_SYSTEM_PROMPT`, line 59 — change:

```
"taunt": "A short observation (1-2 sentences, under 30 words)...
```

to:

```
"taunt": "A short observation (2-3 sentences, under 50 words)...
```

**Safety:** The taunt is the TTS input. 50 words ≈ 15-20 seconds of speech at ElevenLabs speed. Still within reasonable bounds for `eleven_turbo_v2_5`.

---

## Task 5: Dynamic Music Duck Tied to Audio Lifecycle

### Context
`BossVoicePlayer` always calls `duckMusic(0.3, 3.0)` — 3 seconds regardless of audio length. Short lines sound fine; long lines have music creeping back during speech.

### Task 5.1: Remove fixed duck from BossVoicePlayer.play()

**File:** `client/src/systems/BossVoicePlayer.ts`

**Action:** Line 60 — change:

```ts
AudioManager.get().duckMusic(0.3, 3.0);
```

to:

```ts
AudioManager.get().duckMusic(0.3, 60.0); // Will be restored on end/stop
```

This sets a long duck ceiling. The actual restore happens when audio ends.

### Task 5.2: Restore music volume on audio end/stop

**File:** `client/src/systems/BossVoicePlayer.ts`

**Action:** In the `onended` callback (line 48-51) and `onerror` (line 55-58), add:

```ts
AudioManager.get().duckMusic(1.0, 0.5); // restore over 0.5s
```

Do the same in the streaming `onended` (line 129-132) and `onerror` (line 133-136).

### Task 5.3: Restore music on stop()

**File:** `client/src/systems/BossVoicePlayer.ts`

**Action:** In the `stop()` method (line 71-98), add at the top after `if (this.audio)` block:

```ts
AudioManager.get().duckMusic(1.0, 0.3); // immediate restore on forced stop
```

### Task 5.4: Remove fixed duck from streaming ensureStream()

**File:** `client/src/systems/BossVoicePlayer.ts`

**Action:** Line 147 — change to use the same long-ceiling pattern:

```ts
AudioManager.get().duckMusic(0.3, 60.0); // Will be restored on end/stop
```

### Verification
- Boss says a short line (2s) — music should restore ~0.5s after speech ends.
- Boss says a long line (8s) — music should stay ducked the entire time.
- Player barge-ins (stop()) — music restores immediately.

---

## Task 6: Voice Settings Vary by Boss HP Phase

### Context
ElevenLabs `voice_settings` are fixed: `stability: 0.3, style: 0.5`. At low HP, lower stability + higher style = more emotional/urgent delivery.

### Task 6.1: Accept HP percentage in synthesize()

**File:** `server/src/services/bossVoiceService.ts`

**Action:** Change the `synthesize` function signature (line 125):

```ts
export async function synthesize(session: Session, tauntText: string, bossHpPercent?: number): Promise<void> {
```

### Task 6.2: Compute phase-adjusted voice settings

**File:** `server/src/services/bossVoiceService.ts`

**Action:** Inside `synthesize()`, after the apiKey check (line 136), compute settings:

```ts
const voiceSettings = { ...BOSS_VOICE.voice_settings };
if (typeof bossHpPercent === 'number') {
  if (bossHpPercent <= 30) {
    voiceSettings.stability = 0.15;
    voiceSettings.style = 0.8;
    voiceSettings.speed = 1.0;
  } else if (bossHpPercent <= 60) {
    voiceSettings.stability = 0.25;
    voiceSettings.style = 0.65;
    voiceSettings.speed = 0.95;
  }
  // >60%: use defaults (stability 0.3, style 0.5, speed 0.9)
}
```

### Task 6.3: Use computed settings in the init payload

**File:** `server/src/services/bossVoiceService.ts`

**Action:** Line 287-292 — change `voice_settings: BOSS_VOICE.voice_settings` to:

```ts
voice_settings: voiceSettings,
```

### Task 6.4: Pass bossHpPercent from all call sites

There are 3 call sites for `synthesizeBossVoice`:

1. **`server/src/services/voxtralSTT.ts` line 318:**
   ```ts
   void synthesizeBossVoice(session, bossResponse.taunt, session.latestTelemetrySummary?.bossHpPercent);
   ```

2. **`server/src/services/voxtralSTT.ts` line 401:**
   ```ts
   void synthesizeBossVoice(session, bossResponse.taunt, session.latestTelemetrySummary?.bossHpPercent);
   ```

3. **`server/src/services/mistralService.ts` line 200:**
   ```ts
   void synthesizeBossVoice(session, bossResponse.taunt, session.latestTelemetrySummary?.bossHpPercent);
   ```

**Safety:** `bossHpPercent` is optional. If telemetry hasn't been ingested yet, it passes `undefined` and defaults are used.

---

## Implementation Order

Execute in this exact order to minimize risk:

```
Task 4.1  →  trivial 1-line change (word limit)
Task 4.2  →  trivial prompt update
Task 1.1  →  add type field
Task 1.2  →  initialize field
Task 1.3  →  record exchanges
Task 1.4  →  format history in prompt
Task 1.5  →  wire call site
Task 2.1  →  prompt addition (no code)
Task 3.1  →  prompt addition (no code)
Task 5.1  →  duck ceiling change
Task 5.2  →  restore on end
Task 5.3  →  restore on stop
Task 5.4  →  duck ceiling for streaming
Task 6.1  →  add parameter
Task 6.2  →  compute settings
Task 6.3  →  use computed settings
Task 6.4  →  pass from call sites
```

## Rollback

Every change is additive. No existing behavior is removed.
- Tasks 1-3: LLM prompt changes. Revert by removing added text.
- Task 4: One number change. Revert to 30.
- Task 5: Duck behavior change. Revert `60.0` back to `3.0` and remove restore calls.
- Task 6: Optional param. Remove param and `voiceSettings` override.

## Not In Scope

- LiveKit migration (rejected — current WS+base64 is correct for this use case)
- New UI components (captions are already displayed)
- New dependencies
- Model changes (keep existing cascade)
