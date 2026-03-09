import { OptionsData, SaveData } from '../config/types';

const SAVE_KEY = 'mistralraid_save';
const OPTIONS_KEY = 'mistralraid_options';

const DEFAULT_OPTIONS: OptionsData = {
  soundOn: true,
  musicOn: true,
  screenShake: true,
  fullscreen: false,
};

export const SaveSystem = {
  hasSave(): boolean {
    return localStorage.getItem(SAVE_KEY) !== null;
  },
  save(character: SaveData['character'], state: SaveData['state'], discoveredLore?: string[]): void {
    const loreIds =
      Array.isArray(discoveredLore) && discoveredLore.length > 0
        ? Array.from(new Set(discoveredLore.filter((id) => typeof id === 'string')))
        : undefined;
    const data: SaveData = {
      character,
      state,
      savedAt: Date.now(),
      discoveredLore: loreIds,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  },
  load(): SaveData | null {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as SaveData;
    } catch {
      return null;
    }
  },
  deleteSave(): void {
    localStorage.removeItem(SAVE_KEY);
  },
  saveOptions(opts: OptionsData): void {
    localStorage.setItem(OPTIONS_KEY, JSON.stringify(opts));
  },
  loadOptions(): OptionsData {
    const raw = localStorage.getItem(OPTIONS_KEY);
    if (!raw) return { ...DEFAULT_OPTIONS };
    try {
      const parsed = JSON.parse(raw) as Partial<OptionsData>;
      return { ...DEFAULT_OPTIONS, ...parsed };
    } catch {
      return { ...DEFAULT_OPTIONS };
    }
  },
};

export { SAVE_KEY, OPTIONS_KEY, DEFAULT_OPTIONS };
