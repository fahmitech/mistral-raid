import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';
import { audioRouter } from './routes/audio.js';
import { directorRouter } from './routes/director.js';
import { analyzeTelemetry } from './agents/dungeonDirectorAgent.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env from the server/ directory (one level above src/)
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const GENERATED_DIR = path.join(__dirname, '..', 'generated-audio');

// Ensure generated-audio directory and subfolders exist
[GENERATED_DIR, path.join(GENERATED_DIR, 'music'), path.join(GENERATED_DIR, 'sfx')].forEach(
  (d) => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); }
);

const app = express();
const PORT = Number(process.env.PORT ?? 8787);

app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json());

// Serve generated audio files — subfolders first, then legacy flat root
app.use('/generated-audio/music', express.static(path.join(GENERATED_DIR, 'music')));
app.use('/generated-audio/sfx',   express.static(path.join(GENERATED_DIR, 'sfx')));
app.use('/generated-audio',       express.static(GENERATED_DIR));

// Audio API routes
app.use('/api/audio', audioRouter);

// AI Director routes
app.use('/api/director', directorRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', generatedDir: GENERATED_DIR });
});

async function testDirector(): Promise<void> {
  console.log('\n🧪 [Director] Running startup self-test...');
  try {
    const result = await analyzeTelemetry({
      sessionId: 'startup-test',
      level: 2,
      roomsCleared: 3,
      enemiesKilled: 7,
      playerHP: 2,
      playerMaxHP: 6,
      coins: 40,
      score: 320,
      damageDealt: 28,
      damageTaken: 12,
      playTimeSeconds: 90,
      weaponType: 'w_sword',
      character: 'knight',
    });
    console.log('🧠 DIRECT TEST RESULT:', JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('[Director] Self-test failed:', (err as Error).message);
  }
}

app.listen(PORT, () => {
  console.log(`[server] Mistral Raid audio server running at http://localhost:${PORT}`);
  console.log(`[server] Generated audio stored in: ${GENERATED_DIR}`);

  if (!process.env.ELEVENLABS_API_KEY) {
    console.warn('[server] WARNING: ELEVENLABS_API_KEY is not set – audio generation will fail');
  } else {
    console.log('[server] ElevenLabs API key loaded');
  }

  if (process.env.MISTRAL_API_KEY) {
    testDirector();
  } else {
    console.warn('[server] WARNING: MISTRAL_API_KEY is not set – AI Director will use fallback decisions');
  }
});
