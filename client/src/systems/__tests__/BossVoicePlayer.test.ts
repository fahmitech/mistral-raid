import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockDuckMusic = vi.fn();

vi.mock('../AudioManager', () => ({
  AudioManager: {
    get: () => ({
      duckMusic: mockDuckMusic,
    }),
  },
}));

let audioInstances: MockAudio[] = [];

class MockAudio {
  volume = 1;
  preload = '';
  currentTime = 0;
  onended: (() => void) | null = null;
  onpause: (() => void) | null = null;
  onerror: (() => void) | null = null;
  play = vi.fn(() => Promise.resolve());
  pause = vi.fn();

  constructor(_src?: string) {
    audioInstances.push(this);
  }
}

async function loadPlayer() {
  const { bossVoicePlayer } = await import('../BossVoicePlayer');
  return bossVoicePlayer;
}

describe('BossVoicePlayer', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    audioInstances = [];
    vi.stubGlobal('Audio', MockAudio);
    class MockURL extends URL {}
    Object.assign(MockURL, {
      createObjectURL: vi.fn(() => 'blob:mock'),
      revokeObjectURL: vi.fn(),
    });
    vi.stubGlobal('URL', MockURL);
    vi.stubGlobal('atob', (value: string) => Buffer.from(value, 'base64').toString('binary'));
    vi.stubGlobal('btoa', (value: string) => Buffer.from(value, 'binary').toString('base64'));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('ducks music to 0.3 with 60s ceiling on play()', async () => {
    const player = await loadPlayer();

    player.play(Buffer.from('voice').toString('base64'), 'mp3');

    expect(mockDuckMusic).toHaveBeenLastCalledWith(0.3, 60);
  });

  it('restores music to 1.0 on audio ended event', async () => {
    const player = await loadPlayer();

    player.play(Buffer.from('voice').toString('base64'), 'mp3');
    audioInstances[0].onended?.();

    expect(mockDuckMusic).toHaveBeenLastCalledWith(1, 0.5);
  });

  it('restores music to 1.0 on audio error event', async () => {
    const player = await loadPlayer();

    player.play(Buffer.from('voice').toString('base64'), 'mp3');
    audioInstances[0].onerror?.();

    expect(mockDuckMusic).toHaveBeenLastCalledWith(1, 0.5);
  });

  it('restores music to 1.0 with 0.3s ramp on stop()', async () => {
    const player = await loadPlayer();

    player.play(Buffer.from('voice').toString('base64'), 'mp3');
    player.stop();

    expect(mockDuckMusic).toHaveBeenLastCalledWith(1, 0.3);
  });

  it('does not throw when stop() is called without active playback', async () => {
    const player = await loadPlayer();

    expect(() => player.stop()).not.toThrow();
    expect(mockDuckMusic).toHaveBeenCalledWith(1, 0.3);
  });
});
