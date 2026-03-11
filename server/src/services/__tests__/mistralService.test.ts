import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session, StoryContext, TelemetrySummary } from '../../types.js';

const mocks = vi.hoisted(() => ({
  complete: vi.fn(),
  mistralCtor: vi.fn(),
  writeLog: vi.fn(),
}));

vi.mock('@mistralai/mistralai', () => ({
  Mistral: mocks.mistralCtor,
}));

vi.mock('../loggingService.js', () => ({
  logger: {
    writeLog: mocks.writeLog,
  },
}));

function makeTelemetry(overrides: Partial<TelemetrySummary> = {}): TelemetrySummary {
  return {
    avgAccuracy: 0.5,
    cornerPercentageLast10s: 10,
    totalDashCount: 5,
    recentHitsTaken: 1,
    dominantZone: 'mid_center',
    bossHpPercent: 50,
    playerHpPercent: 70,
    sampleCount: 20,
    timestamp: Date.now(),
    bossActive: true,
    loreInteractionCount: 0,
    avgTimeReadingLore: 0,
    avgLoreLingerTime: 0,
    skippedMandatoryLore: 0,
    retreatDistance: 0,
    wallBias: 20,
    longTerm: {
      avgAccuracy: 0.5,
      cornerPercentage: 10,
      dashPerMin: 2,
      dominantZone: 'mid_center',
      sampleCount: 100,
      windowSeconds: 90,
    },
    ...overrides,
  };
}

function makeStoryContext(overrides: Partial<StoryContext> = {}): StoryContext {
  return {
    levelTag: 'depth_3',
    loreDiscovered: ['watcher_journal'],
    bossHistory: ['the gaoler'],
    playerClass: 'knight',
    sanctumReached: false,
    runSummary: {
      aggression: 'balanced',
      movementStyle: 'methodical',
      loreBehavior: 'engaged',
      panicResponse: 'composed',
      environmentUsage: 'roaming',
      healingStyle: 'reactive',
    },
    ...overrides,
  };
}

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'session-under-test',
    turnState: 'LISTENING',
    aiState: 'listening',
    partialTranscript: '',
    stableTranscript: '',
    latestTelemetrySummary: null,
    rollingDebateNotes: '',
    conversationHistory: [],
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
    levelTag: 'unknown',
    loreDiscovered: [],
    bossHistory: [],
    playerClass: 'knight',
    sanctumReached: false,
    ...overrides,
  };
}

function makeWords(count: number): string {
  return Array.from({ length: count }, (_, index) => `word${index + 1}`).join(' ');
}

function mockChatResponse(overrides: Partial<{ analysis: string; taunt: string; mechanics: unknown[] }> = {}) {
  return {
    choices: [
      {
        message: {
          content: JSON.stringify({
            analysis: 'Predictable strafing pattern detected.',
            taunt: 'You dodge with rhythm, but rhythm can be broken.',
            mechanics: [
              {
                type: 'hazard_zone',
                location: 'center',
                shape: 'circle',
                radius: 120,
                damage_per_tick: 10,
                duration_seconds: 6,
                warning_time: 1,
              },
            ],
            ...overrides,
          }),
        },
      },
    ],
  };
}

describe('mistralService.generateBossReply', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.MISTRAL_API_KEY = 'test-key';
    process.env.DEMO_MODE = 'false';
    delete process.env.LLM_TIMEOUT_MS;
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    mocks.mistralCtor.mockImplementation(function MockMistral() {
      return {
        chat: {
          complete: mocks.complete,
        },
      };
    });
  });

  it('uses VOICE_CASCADE first model when fastMode=true', async () => {
    mocks.complete.mockResolvedValue(mockChatResponse());
    const { generateBossReply } = await import('../mistralService.js');

    await generateBossReply('test', null, undefined, true);

    const [request] = mocks.complete.mock.calls[0];
    expect(request.model).toBe('mistral-small-latest');
  });

  it('uses MODEL_CASCADE first model when fastMode=false', async () => {
    mocks.complete.mockResolvedValue(mockChatResponse());
    const { generateBossReply } = await import('../mistralService.js');

    await generateBossReply('test', null, undefined, false);

    const [request] = mocks.complete.mock.calls[0];
    expect(request.model).toBe('mistral-small-latest');
  });

  it('returns fallback response when all models fail', async () => {
    mocks.complete.mockRejectedValue(new Error('network failure'));
    const { generateBossReply } = await import('../mistralService.js');

    const response = await generateBossReply('test', null, undefined, false);

    expect(response.taunt).toBe('You move the way they all move. I have been watching long enough to know what comes next.');
    expect(response.mechanics).toHaveLength(2);
  });

  it('respects LLM_TIMEOUT_MS override', async () => {
    process.env.LLM_TIMEOUT_MS = '1234';
    mocks.complete.mockResolvedValue(mockChatResponse());
    const { generateBossReply } = await import('../mistralService.js');

    await generateBossReply('test', null, undefined, false);

    const [, options] = mocks.complete.mock.calls[0];
    expect(options.timeoutMs).toBe(1234);
  });

  it('includes speech engagement rules in the system prompt', async () => {
    mocks.complete.mockResolvedValue(mockChatResponse());
    const { generateBossReply } = await import('../mistralService.js');

    await generateBossReply('hello', null, undefined, false);

    const [request] = mocks.complete.mock.calls[0];
    expect(request.messages[0].content).toContain('SPEECH ENGAGEMENT RULES');
    expect(request.messages[0].content).toContain('Never ignore what was said');
    expect(request.messages[0].content).toContain('reply to the actual content first');
    expect(request.messages[0].content).toContain('Avoid repetitive stock phrasing');
    expect(request.messages[0].content).toContain('CONFRONTATION FLOW RULES');
    expect(request.messages[0].content).toContain('ongoing confrontation');
  });

  it('pushes exchange to session.conversationHistory on success', async () => {
    mocks.complete.mockResolvedValue(mockChatResponse());
    const { generateBossReply } = await import('../mistralService.js');
    const session = makeSession();

    const response = await generateBossReply('test speech', null, session, false);

    expect(session.conversationHistory).toHaveLength(1);
    expect(session.conversationHistory[0]).toEqual({
      player: 'test speech',
      boss: response.taunt,
    });
  });

  it('caps conversationHistory at 4 entries, removing oldest', async () => {
    mocks.complete.mockResolvedValue(mockChatResponse({ taunt: 'Entry e.' }));
    const { generateBossReply } = await import('../mistralService.js');
    const session = makeSession({
      conversationHistory: [
        { player: 'a', boss: 'A.' },
        { player: 'b', boss: 'B.' },
        { player: 'c', boss: 'C.' },
        { player: 'd', boss: 'D.' },
      ],
    });

    await generateBossReply('e', null, session, false);

    expect(session.conversationHistory).toHaveLength(4);
    expect(session.conversationHistory[0].player).toBe('b');
    expect(session.conversationHistory[3].player).toBe('e');
  });

  it('does not record history when all models fail and fallback is returned', async () => {
    mocks.complete.mockRejectedValue(new Error('network failure'));
    const { generateBossReply } = await import('../mistralService.js');
    const session = makeSession();

    await generateBossReply('test', null, session, false);

    expect(session.conversationHistory).toHaveLength(0);
  });

  it('preserves taunt under 50 words', async () => {
    const taunt = makeWords(30);
    mocks.complete.mockResolvedValue(mockChatResponse({ taunt }));
    const { generateBossReply } = await import('../mistralService.js');

    const response = await generateBossReply('test', null, undefined, false);

    expect(response.taunt.split(/\s+/)).toHaveLength(30);
    expect(response.taunt).toBe(taunt);
  });

  it('trims taunt to 50 words when exceeding limit', async () => {
    mocks.complete.mockResolvedValue(mockChatResponse({ taunt: makeWords(70) }));
    const { generateBossReply } = await import('../mistralService.js');

    const response = await generateBossReply('test', null, undefined, false);

    expect(response.taunt.split(/\s+/)).toHaveLength(50);
  });

  it('preserves taunt at exactly 50 words', async () => {
    const taunt = makeWords(50);
    mocks.complete.mockResolvedValue(mockChatResponse({ taunt }));
    const { generateBossReply } = await import('../mistralService.js');

    const response = await generateBossReply('test', null, undefined, false);

    expect(response.taunt.split(/\s+/)).toHaveLength(50);
    expect(response.taunt).toBe(taunt);
  });
});

describe('mistralService.buildUserPrompt', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('omits history section when conversationHistory is empty', async () => {
    const { buildUserPrompt } = await import('../mistralService.js');

    const prompt = buildUserPrompt('hello', makeTelemetry(), makeStoryContext(), []);

    expect(prompt).not.toContain('Prior exchanges');
  });

  it('includes prior exchanges when conversationHistory has entries', async () => {
    const { buildUserPrompt } = await import('../mistralService.js');

    const prompt = buildUserPrompt(
      'hello',
      makeTelemetry(),
      makeStoryContext(),
      [{ player: 'die', boss: 'Noted.' }]
    );

    expect(prompt).toContain('Prior exchanges (most recent last):');
    expect(prompt).toContain('[1] Subject: "die" -> You responded: "Noted."');
  });

  it('formats multiple history entries in ascending order', async () => {
    const { buildUserPrompt } = await import('../mistralService.js');

    const prompt = buildUserPrompt(
      'hello',
      makeTelemetry(),
      makeStoryContext(),
      [
        { player: 'first', boss: 'One.' },
        { player: 'second', boss: 'Two.' },
        { player: 'third', boss: 'Three.' },
      ]
    );

    expect(prompt).toContain('[1] Subject: "first" -> You responded: "One."');
    expect(prompt).toContain('[2] Subject: "second" -> You responded: "Two."');
    expect(prompt).toContain('[3] Subject: "third" -> You responded: "Three."');
    expect(prompt.indexOf('Subject: "first"')).toBeLessThan(prompt.indexOf('Subject: "third"'));
  });

  it('includes conversation pressure and continuity for ongoing debate turns', async () => {
    const { buildUserPrompt } = await import('../mistralService.js');

    const prompt = buildUserPrompt(
      'Can you stop me after all this?',
      makeTelemetry(),
      makeStoryContext(),
      [
        { player: 'I came here to end this.', boss: 'You came here to be seen.' },
      ]
    );

    expect(prompt).toContain('Conversation pressure:');
    expect(prompt).toContain('Speech act: question');
    expect(prompt).toContain('Current claim or challenge: "Can you stop me after all this?"');
    expect(prompt).toContain('Last subject line: "I came here to end this."');
    expect(prompt).toContain('Continue the same argument. Do not restart from zero.');
    expect(prompt).toContain('Answer, counter, then escalate.');
  });

  it('includes clinical detachment tone when bossHpPercent > 60', async () => {
    const { buildUserPrompt } = await import('../mistralService.js');

    const prompt = buildUserPrompt('test', makeTelemetry({ bossHpPercent: 80 }), makeStoryContext());

    expect(prompt).toContain('Clinical detachment');
  });

  it('includes reluctant recognition tone when bossHpPercent is 31-60', async () => {
    const { buildUserPrompt } = await import('../mistralService.js');

    const prompt = buildUserPrompt('test', makeTelemetry({ bossHpPercent: 45 }), makeStoryContext());

    expect(prompt).toContain('Reluctant recognition');
  });

  it('includes facade cracking tone when bossHpPercent is 1-30', async () => {
    const { buildUserPrompt } = await import('../mistralService.js');

    const prompt = buildUserPrompt('test', makeTelemetry({ bossHpPercent: 15 }), makeStoryContext());

    expect(prompt).toContain('facade cracks');
  });

  it('omits tone directive when bossHpPercent is 0', async () => {
    const { buildUserPrompt } = await import('../mistralService.js');

    const prompt = buildUserPrompt('test', makeTelemetry({ bossHpPercent: 0 }), makeStoryContext());

    expect(prompt).not.toContain('Tone:');
  });
});
