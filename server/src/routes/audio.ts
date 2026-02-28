import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { generateSound, SoundType } from '../services/elevenlabsAudioService.js';
import { generateAndCache, getStats, isCached } from '../services/elevenlabsMusicService.js';

const router = express.Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GENERATED_DIR = path.join(__dirname, '..', '..', 'generated-audio');

interface SoundDef {
  prompt: string;
  type: SoundType;
  duration?: number;
}

const SOUND_LIBRARY: Record<string, SoundDef> = {
  // ── Menu ───────────────────────────────────────────────────────────────────
  menu_hover: {
    prompt: 'Quick soft UI hover beep, fantasy dungeon game menu, gentle crystal tone, 0.1 seconds',
    type: 'sfx',
    duration: 0.2,
  },
  menu_select: {
    prompt: 'Fantasy UI menu selection confirm click, dungeon game, satisfying crisp chime, 0.25 seconds',
    type: 'sfx',
    duration: 0.3,
  },
  menu_open: {
    prompt: 'Medieval parchment or stone menu scroll opening, dungeon fantasy game, soft whoosh, 0.3 seconds',
    type: 'sfx',
    duration: 0.4,
  },
  menu_close: {
    prompt: 'Medieval parchment or stone menu scroll closing, dungeon fantasy game, quick whoosh out, 0.2 seconds',
    type: 'sfx',
    duration: 0.3,
  },
  menu_ambient: {
    prompt:
      'Loopable dark dungeon main menu ambient music, ominous low strings, subtle distant echoes, mystery atmosphere, no melody, no vocals, 20 seconds',
    type: 'music',
    duration: 20,
  },

  // ── Movement ───────────────────────────────────────────────────────────────
  footstep_stone: {
    prompt: 'Quick single footstep on ancient stone dungeon floor, crisp tap, 0.15 seconds',
    type: 'sfx',
    duration: 0.2,
  },
  dash: {
    prompt: 'Magical dash ability whoosh, swift burst of air, fantasy game teleport dash, 0.2 seconds',
    type: 'sfx',
    duration: 0.25,
  },
  shield_activate: {
    prompt: 'Energy shield activation pulse, magical protective bubble forms, fantasy dungeon game, arcane crackle, 0.3 seconds',
    type: 'sfx',
    duration: 0.4,
  },

  // ── Combat – Weapons ───────────────────────────────────────────────────────
  sword_slash: {
    prompt: 'Short metallic sword slash, dark dungeon combat, cinematic sharp steel transient, 0.3 seconds',
    type: 'sfx',
    duration: 0.4,
  },
  dagger_slash: {
    prompt: 'Quick light dagger stab, fast sharp metallic ring, dungeon rogue combat, 0.2 seconds',
    type: 'sfx',
    duration: 0.25,
  },
  katana_slice: {
    prompt: 'Clean katana blade slice through air, sharp metallic ring, precise Japanese sword, 0.3 seconds',
    type: 'sfx',
    duration: 0.35,
  },
  hammer_impact: {
    prompt: 'Heavy war hammer smashing, massive stone impact thud, dungeon fantasy combat, 0.4 seconds',
    type: 'sfx',
    duration: 0.5,
  },
  bomb_explosion: {
    prompt: 'Small dungeon bomb explosion, sharp percussion impact with rumble tail, 0.5 seconds',
    type: 'sfx',
    duration: 0.6,
  },

  // ── Combat – Player ────────────────────────────────────────────────────────
  player_hit: {
    prompt: 'Player character taking damage impact, pain grunt and body hit, dungeon game, 0.3 seconds',
    type: 'sfx',
    duration: 0.4,
  },
  player_death: {
    prompt: 'Player death sound, dark descending tone, echoing final breath, dungeon game over, 1.5 seconds',
    type: 'sfx',
    duration: 2.0,
  },
  heartbeat_low_hp: {
    prompt: 'Ominous slow single heartbeat thump, low health warning pulse, dungeon horror tension, 0.8 seconds',
    type: 'sfx',
    duration: 1.0,
  },

  // ── Enemies ────────────────────────────────────────────────────────────────
  goblin_attack: {
    prompt: 'Goblin creature attack screech and grunt, small fantasy creature aggro, dungeon, 0.3 seconds',
    type: 'sfx',
    duration: 0.4,
  },
  orc_roar: {
    prompt: 'Orc battle roar, deep guttural bellow, large dungeon fantasy warrior, 0.5 seconds',
    type: 'sfx',
    duration: 0.6,
  },
  skeleton_rattle: {
    prompt: 'Skeleton bones rattling and clacking, undead creature dungeon horror atmosphere, 0.3 seconds',
    type: 'sfx',
    duration: 0.4,
  },
  zombie_growl: {
    prompt: 'Zombie guttural growl, undead dungeon creature horror, shambling moan, 0.4 seconds',
    type: 'sfx',
    duration: 0.5,
  },
  elemental_magic: {
    prompt: 'Magical elemental spell cast, arcane crackle and energy release, dungeon fantasy, 0.35 seconds',
    type: 'sfx',
    duration: 0.5,
  },
  enemy_kill: {
    prompt: 'Satisfying enemy defeat chime, quick musical note sparkle, dungeon game reward sound, 0.2 seconds',
    type: 'sfx',
    duration: 0.3,
  },
  coin_pickup: {
    prompt: 'Gold coin pickup jingle, bright metallic ring, fantasy RPG treasure collect, 0.25 seconds',
    type: 'sfx',
    duration: 0.3,
  },

  // ── Boss System ────────────────────────────────────────────────────────────
  suspense_build: {
    prompt:
      'Building suspense sting, approaching boss danger in dungeon, ominous low strings rumble, 3 seconds',
    type: 'sfx',
    duration: 3.5,
  },
  low_rumble: {
    prompt: 'Deep ominous low frequency subterranean rumble, dungeon boss room atmosphere, 2 seconds',
    type: 'sfx',
    duration: 2.5,
  },
  boss_intro: {
    prompt:
      'Cinematic boss encounter intro dramatic orchestral impact hit, dungeon fantasy, powerful swell, 2 seconds',
    type: 'sfx',
    duration: 2.5,
  },
  boss_music_loop: {
    prompt:
      'Intense dark boss battle music loop, driving orchestral percussion and strings, dungeon fantasy combat, no vocals, 20 seconds',
    type: 'music',
    duration: 20,
  },
  boss_death: {
    prompt:
      'Epic boss defeated slow motion orchestral impact, victory sting, cinematic triumph, dungeon fantasy, 2 seconds',
    type: 'sfx',
    duration: 2.5,
  },

  // ── Interactions ───────────────────────────────────────────────────────────
  chest_open: {
    prompt: 'Wooden treasure chest opening, dungeon fantasy, wood creak and reveal shimmer chime, 0.5 seconds',
    type: 'sfx',
    duration: 0.7,
  },
  potion_drink: {
    prompt: 'Drinking magical potion, quick liquid gulp with arcane sparkle effect, fantasy game, 0.3 seconds',
    type: 'sfx',
    duration: 0.4,
  },
  item_pickup: {
    prompt: 'Item pickup sparkle chime, bright crystal note, fantasy dungeon game reward, 0.2 seconds',
    type: 'sfx',
    duration: 0.3,
  },
  door_open: {
    prompt: 'Heavy stone dungeon door grinding and sliding open, deep scrape rumble, 0.8 seconds',
    type: 'sfx',
    duration: 1.0,
  },
  stairs_descend: {
    prompt:
      'Descending dungeon staircase transition, whoosh portal sound going deeper underground, 0.5 seconds',
    type: 'sfx',
    duration: 0.7,
  },

  // ── Game Over / Victory ────────────────────────────────────────────────────
  game_over_theme: {
    prompt:
      'Game over defeat theme, dark descending piano notes with echo, sad dungeon game moment, 3 seconds',
    type: 'music',
    duration: 4.0,
  },
  victory_theme: {
    prompt:
      'Victory fanfare, triumphant bright orchestral hit and upward resolution, dungeon quest complete, 3 seconds',
    type: 'music',
    duration: 4.0,
  },

  // ── Background Music ───────────────────────────────────────────────────────
  dungeon_ambient_loop: {
    prompt:
      'Loopable dark dungeon ambient background music, low wind echoes, distant water drips, deep atmospheric hum, no percussion, no melody, no vocals, immersive, 20 seconds',
    type: 'music',
    duration: 20,
  },
  combat_music: {
    prompt:
      'Dungeon combat battle music loop, intense driving percussion and strings, dark fantasy action orchestra, urgent tempo, no vocals, 20 seconds',
    type: 'music',
    duration: 20,
  },

  // ── Hero Select ────────────────────────────────────────────────────────────
  hero_select_music: {
    prompt:
      'Heroic character selection ambient music, dark dungeon kingdom, anticipation and mystery, subtle orchestral strings and choir, no full melody, no vocals, loopable, 20 seconds',
    type: 'music',
    duration: 20,
  },
  character_hover: {
    prompt: 'Hero character portrait hover ping, fantasy RPG selection, bright subtle chime, 0.15 seconds',
    type: 'sfx',
    duration: 0.2,
  },
  character_confirm: {
    prompt: 'Hero character selection confirmed, heroic short fanfare ping, dungeon RPG, 0.4 seconds',
    type: 'sfx',
    duration: 0.5,
  },
  game_start: {
    prompt:
      'Epic dungeon adventure begin fanfare, brave hero enters dungeon, dramatic orchestral hit with whoosh, cinematic, 2 seconds',
    type: 'sfx',
    duration: 2.5,
  },

  // ── Credits ────────────────────────────────────────────────────────────────
  credits_music: {
    prompt:
      'Peaceful ethereal credits music, dungeon adventure complete reflection, gentle piano and soft strings, melancholic and beautiful, no vocals, loopable, 20 seconds',
    type: 'music',
    duration: 20,
  },

  // ── UI Sounds ──────────────────────────────────────────────────────────────
  inventory_open: {
    prompt: 'Quick leather bag or pack rustle opening sound, fantasy RPG dungeon inventory, 0.3 seconds',
    type: 'sfx',
    duration: 0.4,
  },
  weapon_swap: {
    prompt: 'Quick weapon swap whoosh and metallic clank, dungeon fighter switching arms, crisp transient, 0.2 seconds',
    type: 'sfx',
    duration: 0.3,
  },
  pause_whoosh: {
    prompt: 'Soft UI pause menu opening whoosh, fantasy dungeon game pause, gentle air movement, 0.2 seconds',
    type: 'sfx',
    duration: 0.3,
  },
  xp_tone: {
    prompt: 'Short ascending experience points earned chime, RPG progress reward tone, bright and crisp, 0.15 seconds',
    type: 'sfx',
    duration: 0.2,
  },

  // ── Global Presence ────────────────────────────────────────────────────────
  global_presence: {
    prompt:
      'Extremely subtle dungeon presence atmosphere, barely audible low frequency hum, deep stone resonance, no melody, subliminal, 20 seconds',
    type: 'sfx',
    duration: 20,
  },

  // ── Voice Taunts ───────────────────────────────────────────────────────────
  taunt_darkness: {
    prompt: 'The darkness claims another.',
    type: 'voice',
  },
  taunt_journey: {
    prompt: 'Your journey ends here, adventurer.',
    type: 'voice',
  },
  taunt_watcher: {
    prompt: 'The Watcher sees all. There is no escape.',
    type: 'voice',
  },
  taunt_abyss: {
    prompt: 'The abyss consumes the weak.',
    type: 'voice',
  },
};

interface GenerateBody {
  category: string;
  context?: Record<string, unknown>;
}

router.post('/generate', async (req: Request, res: Response): Promise<void> => {
  const { category } = req.body as GenerateBody;

  if (!category || typeof category !== 'string') {
    res.status(400).json({ error: 'category is required' });
    return;
  }

  const def = SOUND_LIBRARY[category];
  if (!def) {
    res.status(404).json({ error: `Unknown category: ${category}` });
    return;
  }

  // Skip voice lines — they use a different ElevenLabs endpoint not supported here
  if (def.type === 'voice') {
    res.status(400).json({ error: 'Voice generation not supported via this endpoint' });
    return;
  }

  try {
    // Use the credit-safe music service (handles subfolders, manifest, legacy migration)
    const result = await generateAndCache({
      name:     category,
      prompt:   def.prompt,
      type:     def.type as 'music' | 'sfx',
      duration: def.duration,
    });
    res.json({ url: result.url, fromCache: result.fromCache });
  } catch (err: unknown) {
    // Fallback: try the original flat-folder service
    try {
      const filename = `${category}.mp3`;
      const filePath = path.join(GENERATED_DIR, filename);
      if (!fs.existsSync(filePath)) {
        const buffer = await generateSound(def);
        fs.writeFileSync(filePath, buffer);
      }
      res.json({ url: `/generated-audio/${filename}`, fromCache: fs.existsSync(filePath) });
    } catch (fallbackErr: unknown) {
      const message = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
      console.error(`[audio] Failed to generate ${category}:`, message);
      res.status(502).json({ error: `Generation failed: ${message}` });
    }
  }
});

// List all categories available (checks both new subfolder and legacy flat paths)
router.get('/categories', (_req: Request, res: Response): void => {
  const categories = Object.keys(SOUND_LIBRARY)
    .filter((key) => SOUND_LIBRARY[key].type !== 'voice')
    .map((key) => {
      const def = SOUND_LIBRARY[key];
      const sfxType = def.type as 'music' | 'sfx';
      const cached =
        isCached(key, sfxType) ||
        fs.existsSync(path.join(GENERATED_DIR, `${key}.mp3`));
      return { name: key, type: def.type, cached };
    });
  res.json({ categories });
});

// Credit & cache statistics
router.get('/stats', (_req: Request, res: Response): void => {
  res.json(getStats());
});

// ─── AI Adaptive Telemetry ───────────────────────────────────────────────────

interface TelemetryBody {
  hp: number;
  maxHp: number;
  bossHp: number;
  bossMaxHp: number;
  enemyCount: number;
  recentDamageTaken: number;
}

router.post('/telemetry', (req: Request, res: Response): void => {
  const { hp, maxHp, bossHp, bossMaxHp, enemyCount, recentDamageTaken } = req.body as TelemetryBody;

  const hpRatio   = maxHp > 0     ? hp / maxHp         : 1;
  const bossRatio = bossMaxHp > 0 ? bossHp / bossMaxHp : 0;
  const hasBoss   = bossMaxHp > 0;

  type MusicMood = 'calm' | 'tense' | 'intense' | 'critical';
  let musicMood: MusicMood;
  let addLayer = false;
  let volumeMultiplier = 1.0;

  if (hpRatio <= 0.2) {
    musicMood = 'critical';
    addLayer = true;
    volumeMultiplier = 1.2;
  } else if (hpRatio <= 0.4 || (hasBoss && bossRatio <= 0.3)) {
    musicMood = 'intense';
    addLayer = true;
    volumeMultiplier = 1.1;
  } else if (enemyCount > 5 || recentDamageTaken > 3 || hasBoss) {
    musicMood = 'tense';
    volumeMultiplier = 1.05;
  } else {
    musicMood = 'calm';
    volumeMultiplier = 1.0;
  }

  res.json({ musicMood, addLayer, volumeMultiplier });
});

export { router as audioRouter };
