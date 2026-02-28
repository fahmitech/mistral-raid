/**
 * generateStaticAudio.mjs
 *
 * Generates the 13 static audio files for Mistral Raid using ElevenLabs API.
 * Output: client/public/audio/*.mp3
 *
 * Usage: node server/scripts/generateStaticAudio.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.resolve(__dirname, '../../client/public/audio');
const API_KEY = 'sk_3f673adecdcafe93fbe8e1465cb8d3fd8d53bc4f134b1e07';
const API_URL = 'https://api.elevenlabs.io/v1/sound-generation';

// The 13 audio assets from the plan
const AUDIO_ASSETS = [
  {
    filename: 'menu_theme.mp3',
    prompt: 'Epic dark fantasy dungeon menu theme music, orchestral, mysterious and atmospheric, looping background music, medieval RPG style, dramatic horns and strings',
    duration: 22,
  },
  {
    filename: 'dungeon_ambient.mp3',
    prompt: 'Dark dungeon ambient sound, distant dripping water, faint torch crackling, low ominous hum, eerie atmosphere, looping dungeon background ambience',
    duration: 22,
  },
  {
    filename: 'combat_music.mp3',
    prompt: 'Intense action combat music, fast-paced dungeon battle theme, drums and strings, aggressive fantasy battle soundtrack, looping RPG combat music',
    duration: 22,
  },
  {
    filename: 'boss_music.mp3',
    prompt: 'Epic boss battle music, dramatic dark fantasy orchestral theme, massive drums, intense strings and brass, climactic RPG boss fight soundtrack, cinematic',
    duration: 22,
  },
  {
    filename: 'game_over.mp3',
    prompt: 'Game over music, dark melancholic defeat theme, slow descending melody, somber piano and strings, dramatic failure sound for RPG game',
    duration: 8,
  },
  {
    filename: 'victory_music.mp3',
    prompt: 'Victory fanfare music, triumphant fantasy celebration theme, heroic brass and strings, joyful RPG win music, uplifting and grand',
    duration: 10,
  },
  {
    filename: 'credits_theme.mp3',
    prompt: 'Gentle credits theme music, peaceful and reflective, soft piano melody with light orchestral backdrop, end credits fantasy game music, warm and nostalgic',
    duration: 22,
  },
  {
    filename: 'sword_attack.mp3',
    prompt: 'Sharp metallic sword slash sound effect, quick blade whoosh, fantasy weapon attack sound, crisp and impactful sword strike',
    duration: 0.5,
  },
  {
    filename: 'player_hit.mp3',
    prompt: 'Player taking damage sound, painful impact grunt, hit sound effect, body impact with short pain sound, RPG damage received',
    duration: 0.5,
  },
  {
    filename: 'boss_roar.mp3',
    prompt: 'Monster boss roar sound effect, terrifying demonic growl, massive creature battle cry, intimidating fantasy monster roar',
    duration: 2,
  },
  {
    filename: 'footstep.mp3',
    prompt: 'Single stone floor footstep sound effect, dungeon walking step, short crisp boot on stone tile sound',
    duration: 0.3,
  },
  {
    filename: 'dash.mp3',
    prompt: 'Quick dash movement sound effect, fast whoosh air rush, character dash ability sound, swift movement burst sound',
    duration: 0.4,
  },
  {
    filename: 'shield_activate.mp3',
    prompt: 'Shield activation sound effect, magical energy shield shimmering into place, protective barrier sound, fantasy shield power up',
    duration: 0.6,
  },
];

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function generateAudio(asset) {
  const outputPath = path.join(OUTPUT_DIR, asset.filename);

  if (fs.existsSync(outputPath)) {
    const stat = fs.statSync(outputPath);
    if (stat.size > 1000) {
      console.log(`  ✅ Already exists: ${asset.filename} (${(stat.size / 1024).toFixed(1)} KB)`);
      return true;
    }
  }

  console.log(`  ⏳ Generating: ${asset.filename}...`);

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'xi-api-key': API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: asset.prompt,
        duration_seconds: asset.duration,
        prompt_influence: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`  ❌ Failed (${response.status}): ${errorText.slice(0, 200)}`);
      return false;
    }

    const buffer = await response.arrayBuffer();
    fs.writeFileSync(outputPath, Buffer.from(buffer));
    const sizeKB = (buffer.byteLength / 1024).toFixed(1);
    console.log(`  ✅ Generated: ${asset.filename} (${sizeKB} KB)`);
    return true;
  } catch (err) {
    console.error(`  ❌ Error: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log('\n🎵 Mistral Raid — Static Audio Generator');
  console.log(`   Output: ${OUTPUT_DIR}\n`);

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  let success = 0;
  let failed = 0;

  for (let i = 0; i < AUDIO_ASSETS.length; i++) {
    const asset = AUDIO_ASSETS[i];
    console.log(`[${i + 1}/${AUDIO_ASSETS.length}] ${asset.filename}`);
    const ok = await generateAudio(asset);
    if (ok) success++;
    else failed++;

    // Rate limit: 1.5s between API calls
    if (i < AUDIO_ASSETS.length - 1) {
      await sleep(1500);
    }
  }

  console.log(`\n🏁 Done! ${success} generated, ${failed} failed`);
  if (failed > 0) {
    console.log('   Re-run the script to retry failed assets.');
  }
}

main().catch(console.error);
