export type CompanionFocus = 'aggro' | 'tactical' | 'protector' | 'balanced';

interface PixelArtTemplate {
  palette: Record<string, string>;
  frames: string[][];
}

export interface CompanionGuide {
  id: string;
  label: string;
  spriteKey: string;
  title: string;
  role: string;
  backstory: string;
  abilityName: string;
  abilityDescription: string;
  focus: CompanionFocus;
  color: string;
  stats: {
    offense: number;
    defense: number;
    support: number;
  };
  pixelArt: PixelArtTemplate;
}

const transparent = '.'.repeat(16);

const createTemplate = (palette: Record<string, string>, frames: string[][]): PixelArtTemplate => ({
  palette: { '.': 'transparent', ...palette },
  frames,
});

export const COMPANION_GUIDES: CompanionGuide[] = [
  {
    id: 'alistair',
    label: 'ALISTAIR',
    spriteKey: 'companion_alistair',
    title: 'Fallen Guardian',
    role: 'Shield Vanguard',
    backstory: 'Last knight to fall at the dungeon gate; still sworn to guard reckless heroes.',
    abilityName: 'Spectral Aegis',
    abilityDescription: 'Summons a spectral barrier that absorbs the next heavy hit for the party.',
    focus: 'protector',
    color: '#6ce7ff',
    stats: { offense: 6, defense: 10, support: 8 },
    pixelArt: createTemplate(
      { B: '#a5f3fc', D: '#0891b2', W: '#ffffff' },
      [
        [
          '................',
          '......BBBB......',
          '.....BBBBBB.....',
          '....BBBBBBBB....',
          '....BDDWWDBB....',
          '....BDDWWDBB....',
          '....BBBBBBBB....',
          '....BBBBBBBB....',
          '.....BBBBBB.....',
          '.....BBBBBB.....',
          '....BBBBBBBB....',
          '....BBBBBBBB....',
          '....BB....BB....',
          '....BB....BB....',
          '................',
          '................',
        ],
        [
          '................',
          '......BBBB......',
          '.....BBBBBB.....',
          '....BBBBBBBB....',
          '....BDDWWDBB....',
          '....BDDWWDBB....',
          '....BBBBBBBB....',
          '....BBBBBBBB....',
          '.....BBBBBB.....',
          '.....BBBBBB.....',
          '....BBBBBBBB....',
          '....BBBBBBBB....',
          '....BB....BB....',
          '................',
          '................',
          '................',
        ],
      ]
    ),
  },
  {
    id: 'elara',
    label: 'ELARA',
    spriteKey: 'companion_elara',
    title: 'Shadow Scout',
    role: 'Ranged Intel',
    backstory: 'A master thief who maps every corridor twice before you even see it.',
    abilityName: 'Ghoststep',
    abilityDescription: 'Reveals traps, secret passages, and enemy silhouettes through walls.',
    focus: 'tactical',
    color: '#c084fc',
    stats: { offense: 7, defense: 5, support: 9 },
    pixelArt: createTemplate(
      { P: '#e9d5ff', D: '#7e22ce', E: '#ffffff' },
      [
        [
          '................',
          '......PPPP......',
          '.....PPPPPP.....',
          '....PPPPPPPP....',
          '....PDDEEDPP....',
          '....PPPPPPPP....',
          '.....PPPPPP.....',
          '......PPPP......',
          '.....PPPPPP.....',
          '....PPPPPPPP....',
          '....PP....PP....',
          '....PP....PP....',
          '....PP....PP....',
          '.....PP..PP.....',
          '................',
          '................',
        ],
        [
          '................',
          '......PPPP......',
          '.....PPPPPP.....',
          '....PPPPPPPP....',
          '....PDDEEDPP....',
          '....PPPPPPPP....',
          '.....PPPPPP.....',
          '......PPPP......',
          '.....PPPPPP.....',
          '....PPPPPPPP....',
          '....PP....PP....',
          '....PP....PP....',
          '.....PP..PP.....',
          '................',
          '................',
          '................',
        ],
      ]
    ),
  },
  {
    id: 'kaelen',
    label: 'KAELEN',
    spriteKey: 'companion_kaelen',
    title: 'Arcane Archivist',
    role: 'Battle Mage',
    backstory: 'An eternal scholar who records every spell cast inside the dungeon.',
    abilityName: 'Mana Echo',
    abilityDescription: 'Returns ammo and cooldown energy whenever you clear a room.',
    focus: 'balanced',
    color: '#34d399',
    stats: { offense: 8, defense: 6, support: 8 },
    pixelArt: createTemplate(
      { G: '#bbf7d0', D: '#15803d', S: '#fef08a' },
      [
        [
          '.......S........',
          '......GGG.......',
          '.....GGGGG......',
          '....GGGGGGG.....',
          '....GDDGDDG.....',
          '....GGGGGGG.....',
          '.....GGGGG......',
          '......GGG.......',
          '.....GGGGG......',
          '....GGGGGGG.....',
          '....GG...GG.....',
          '....GG...GG.....',
          '....GG...GG.....',
          '.......S........',
          '................',
          '................',
        ],
        [
          '................',
          '......GGG.......',
          '.....GGGGG......',
          '....GGGGGGG.....',
          '....GDDGDDG.....',
          '....GGGGGGG.....',
          '.....GGGGG......',
          '......GGG.......',
          '.....GGGGG......',
          '....GGGGGGG.....',
          '....GG...GG.....',
          '....GG...GG.....',
          '.......S........',
          '.......S........',
          '................',
          '................',
        ],
      ]
    ),
  },
  {
    id: 'bryn',
    label: 'BRYN',
    spriteKey: 'companion_bryn',
    title: 'Merciful Spirit',
    role: 'Field Medic',
    backstory: 'A battlefield medic who still patches up brave fools from beyond.',
    abilityName: 'Soul Mend',
    abilityDescription: 'Applies slow regenerating heals and shortens revive time.',
    focus: 'protector',
    color: '#f87171',
    stats: { offense: 5, defense: 7, support: 10 },
    pixelArt: createTemplate(
      { R: '#fecaca', D: '#b91c1c', W: '#ffffff' },
      [
        [
          '................',
          '......RRRR......',
          '.....RRRRRR.....',
          '....RRRRRRRR....',
          '....RRRWRRRR....',
          '....RRWWWRRR....',
          '....RRRWRRRR....',
          '....RRRRRRRR....',
          '.....RRRRRR.....',
          '......RRRR......',
          '.....RRRRRR.....',
          '....RRRRRRRR....',
          '....RR....RR....',
          '....RR....RR....',
          '................',
          '................',
        ],
        [
          '................',
          '......RRRR......',
          '.....RRRRRR.....',
          '....RRRRRRRR....',
          '....RRRWRRRR....',
          '....RRWWWRRR....',
          '....RRRWRRRR....',
          '....RRRRRRRR....',
          '.....RRRRRR.....',
          '......RRRR......',
          '.....RRRRRR.....',
          '....RRRRRRRR....',
          '....RR....RR....',
          '................',
          '................',
          '................',
        ],
      ]
    ),
  },
];
