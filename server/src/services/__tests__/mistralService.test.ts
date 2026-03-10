import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  complete: vi.fn(),
  mistralCtor: vi.fn(),
}));

vi.mock('@mistralai/mistralai', () => {
  return {
    Mistral: mocks.mistralCtor,
  };
});

function mockChatResponse() {
  return {
    choices: [
      {
        message: {
          content: JSON.stringify({
            analysis: 'Predicable strafing pattern detected.',
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
    expect(request.model).toBe('ministral-8b-latest');
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
});
