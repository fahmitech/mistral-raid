import { CharacterType, CharacterStats } from './types';

export const CHARACTER_CONFIGS: Record<CharacterType, CharacterStats> = {
  [CharacterType.Knight]: {
    maxHP: 6,
    speed: 110,
    damage: 1.0,
    fireRate: 280,
    spriteKey: 'knight_m',
    label: 'Knight',
    desc: 'Balanced warrior. Strong shield, steady aim.',
  },
  [CharacterType.Rogue]: {
    maxHP: 4,
    speed: 145,
    damage: 0.8,
    fireRate: 200,
    spriteKey: 'elf_f',
    label: 'Rogue',
    desc: 'Lightning fast. Low HP but rapid fire.',
  },
  [CharacterType.Mage]: {
    maxHP: 3,
    speed: 100,
    damage: 2.0,
    fireRate: 420,
    spriteKey: 'lizard_f',
    label: 'Mage',
    desc: 'High damage spells. Fragile but deadly.',
  },
  [CharacterType.Paladin]: {
    maxHP: 8,
    speed: 88,
    damage: 1.5,
    fireRate: 360,
    spriteKey: 'dwarf_m',
    label: 'Paladin',
    desc: 'Iron tank. Maximum HP, heavy hits.',
  },
};
