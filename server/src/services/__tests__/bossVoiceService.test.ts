import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '../../types.js';

const mocks = vi.hoisted(() => {
  class MockWebSocket {
    static OPEN = 1;
    static CONNECTING = 0;

    readyState = MockWebSocket.OPEN;
    handlers: Record<string, Array<(...args: any[]) => void>> = {};
    send = vi.fn();
    close = vi.fn(() => {
      this.readyState = 3;
    });
    on = vi.fn((event: string, handler: (...args: any[]) => void) => {
      (this.handlers[event] ??= []).push(handler);
      return this;
    });
    once = vi.fn((event: string, handler: (...args: any[]) => void) => {
      if (event === 'open') {
        handler();
        return this;
      }
      (this.handlers[event] ??= []).push(handler);
      return this;
    });
    removeAllListeners = vi.fn((event?: string) => {
      if (event) {
        delete this.handlers[event];
        return;
      }
      this.handlers = {};
    });

    emit(event: string, ...args: any[]): void {
      (this.handlers[event] ?? []).forEach((handler) => handler(...args));
    }
  }

  const instances: MockWebSocket[] = [];

  class MockWebSocketCtor extends MockWebSocket {
    constructor(_url?: string, _options?: unknown) {
      super();
      instances.push(this);
    }
  }

  return {
    instances,
    WebSocketCtor: MockWebSocketCtor,
    setTurnState: vi.fn(),
    sendToClient: vi.fn(),
  };
});

vi.mock('ws', () => ({
  default: mocks.WebSocketCtor,
  WebSocket: mocks.WebSocketCtor,
}));

vi.mock('../sessionManager.js', () => ({
  setTurnState: mocks.setTurnState,
}));

vi.mock('../../ws/WebSocketServer.js', () => ({
  sendToClient: mocks.sendToClient,
}));

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'tts-session',
    turnState: 'AI_SPEAKING',
    aiState: 'speaking',
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

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

function getInitPayload(callIndex = 0): { voice_settings: { stability: number; style: number; speed: number } } {
  return JSON.parse(mocks.instances.at(-1)!.send.mock.calls[callIndex][0]);
}

describe('bossVoiceService.synthesize', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.instances.length = 0;
    process.env.ENABLE_AI_SPEECH = 'true';
    process.env.ELEVENLABS_API_KEY = 'test-key';
    process.env.TTS_TIMEOUT_MS = '10000';
    process.env.ENABLE_STREAMING_TTS = 'true';
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('uses default voice settings when bossHpPercent is undefined', async () => {
    const { synthesize } = await import('../bossVoiceService.js');
    const session = makeSession();
    const promise = synthesize(session, 'test taunt');

    await flushPromises();

    expect(getInitPayload().voice_settings).toEqual({
      stability: 0.3,
      similarity_boost: 0.8,
      style: 0.5,
      speed: 0.9,
    });

    mocks.instances[0].emit('close');
    await promise;
  });

  it('uses default voice settings when bossHpPercent > 60', async () => {
    const { synthesize } = await import('../bossVoiceService.js');
    const session = makeSession();
    const promise = synthesize(session, 'test taunt', 80);

    await flushPromises();

    expect(getInitPayload().voice_settings).toEqual({
      stability: 0.3,
      similarity_boost: 0.8,
      style: 0.5,
      speed: 0.9,
    });

    mocks.instances[0].emit('close');
    await promise;
  });

  it('uses mid-phase voice settings when bossHpPercent is 31-60', async () => {
    const { synthesize } = await import('../bossVoiceService.js');
    const session = makeSession();
    const promise = synthesize(session, 'test taunt', 45);

    await flushPromises();

    expect(getInitPayload().voice_settings).toEqual({
      stability: 0.25,
      similarity_boost: 0.8,
      style: 0.65,
      speed: 0.95,
    });

    mocks.instances[0].emit('close');
    await promise;
  });

  it('uses low-phase voice settings when bossHpPercent <= 30', async () => {
    const { synthesize } = await import('../bossVoiceService.js');
    const session = makeSession();
    const promise = synthesize(session, 'test taunt', 20);

    await flushPromises();

    expect(getInitPayload().voice_settings).toEqual({
      stability: 0.15,
      similarity_boost: 0.8,
      style: 0.8,
      speed: 1,
    });

    mocks.instances[0].emit('close');
    await promise;
  });

  it('uses low-phase settings at exactly 30%', async () => {
    const { synthesize } = await import('../bossVoiceService.js');
    const session = makeSession();
    const promise = synthesize(session, 'test taunt', 30);

    await flushPromises();

    expect(getInitPayload().voice_settings.stability).toBe(0.15);

    mocks.instances[0].emit('close');
    await promise;
  });

  it('uses mid-phase settings at exactly 60%', async () => {
    const { synthesize } = await import('../bossVoiceService.js');
    const session = makeSession();
    const promise = synthesize(session, 'test taunt', 60);

    await flushPromises();

    expect(getInitPayload().voice_settings.stability).toBe(0.25);

    mocks.instances[0].emit('close');
    await promise;
  });

  it('does not mutate the global BOSS_VOICE voice_settings object', async () => {
    const { synthesize } = await import('../bossVoiceService.js');

    const lowSession = makeSession({ id: 'low-phase' });
    const lowPromise = synthesize(lowSession, 'test taunt', 10);
    await flushPromises();
    expect(getInitPayload().voice_settings.stability).toBe(0.15);
    mocks.instances[0].emit('close');
    await lowPromise;

    mocks.instances.length = 0;
    vi.clearAllMocks();

    const defaultSession = makeSession({ id: 'default-phase' });
    const defaultPromise = synthesize(defaultSession, 'test taunt');
    await flushPromises();
    expect(getInitPayload().voice_settings).toEqual({
      stability: 0.3,
      similarity_boost: 0.8,
      style: 0.5,
      speed: 0.9,
    });
    mocks.instances[0].emit('close');
    await defaultPromise;
  });
});
