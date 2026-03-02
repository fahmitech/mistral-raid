/** Companion personality — maps to a Mistral prompt modifier on the server. */
export type CompanionPersonality = 'aggressive' | 'tactical' | 'protector' | 'balanced';

export interface CoopSettings {
  /** True when the player entered via "AI Co-Op Mode" from the menu. */
  isCoopMode: boolean;
  companionPersonality: CompanionPersonality;
  /** Sprite key prefix (e.g. 'knight_m', 'elf_m') for the companion character. */
  companionSpriteKey: string;
  /** Whether ElevenLabs TTS is used to voice companion "speak" lines. */
  voiceEnabled: boolean;
}

const DEFAULTS: CoopSettings = {
  isCoopMode: false,
  companionPersonality: 'balanced',
  companionSpriteKey: 'elf_m',
  voiceEnabled: false,
};

let _settings: CoopSettings = { ...DEFAULTS };

export const CoopState = {
  get(): Readonly<CoopSettings> {
    return _settings;
  },

  set(patch: Partial<CoopSettings>): void {
    _settings = { ..._settings, ...patch };
  },

  reset(): void {
    _settings = { ...DEFAULTS };
  },
};
