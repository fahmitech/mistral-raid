import { beforeEach, describe, expect, it, vi } from 'vitest';
import { canStartBossReply, handleBargeIn } from '../sessionManager.js';
import type { Session } from '../../types.js';

function createSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'session-under-test',
    turnState: 'LISTENING',
    aiState: 'listening',
    partialTranscript: '',
    stableTranscript: '',
    latestTelemetrySummary: null,
    rollingDebateNotes: '',
    activeLLMAbort: null,
    activeTTSAbort: null,
    lastSpeechEndTime: 0,
    lastBossSpeechTime: 0,
    ws: {
      OPEN: 1,
      readyState: 1,
      send: vi.fn(),
    } as Session['ws'],
    sttStream: null,
    directorInterval: null,
    lastDirectorDecision: null,
    ...overrides,
  };
}

describe('sessionManager', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('canStartBossReply returns false while thinking', () => {
    const session = createSession({ turnState: 'THINKING' });
    expect(canStartBossReply(session)).toBe(false);
  });

  it('canStartBossReply returns false while AI is speaking', () => {
    const session = createSession({ turnState: 'AI_SPEAKING' });
    expect(canStartBossReply(session)).toBe(false);
  });

  it('canStartBossReply returns false inside cooldown window', () => {
    vi.spyOn(Date, 'now').mockReturnValue(10_000);
    const session = createSession({
      turnState: 'LISTENING',
      lastBossSpeechTime: 8_500,
    });

    expect(canStartBossReply(session)).toBe(false);
  });

  it('canStartBossReply returns true after cooldown expires', () => {
    vi.spyOn(Date, 'now').mockReturnValue(10_000);
    const session = createSession({
      turnState: 'LISTENING',
      lastBossSpeechTime: 7_900,
    });

    expect(canStartBossReply(session)).toBe(true);
  });

  it('handleBargeIn aborts active requests and resets to LISTENING', () => {
    const llmAbort = new AbortController();
    const ttsAbort = new AbortController();
    const session = createSession({
      turnState: 'THINKING',
      aiState: 'thinking',
      activeLLMAbort: llmAbort,
      activeTTSAbort: ttsAbort,
    });

    handleBargeIn(session);

    expect(llmAbort.signal.aborted).toBe(true);
    expect(ttsAbort.signal.aborted).toBe(true);
    expect(session.activeLLMAbort).toBeNull();
    expect(session.activeTTSAbort).toBeNull();
    expect(session.turnState).toBe('LISTENING');
    expect(session.aiState).toBe('listening');
  });
});
