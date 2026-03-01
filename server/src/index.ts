import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';
import http from 'http';
import { audioRouter } from './routes/audio.js';
import { bossRouter } from './routes/boss.js';
import { telemetryRouter } from './routes/telemetry.js';
import { attachWebSocketServer } from './ws/WebSocketServer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env from the server/ directory (one level above src/).
// override=true ensures local .env wins over stale shell exports.
dotenv.config({ path: path.join(__dirname, '..', '.env'), override: true });

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
app.use('/generated-audio/sfx', express.static(path.join(GENERATED_DIR, 'sfx')));
app.use('/generated-audio', express.static(GENERATED_DIR));

// Audio API routes
app.use('/api/audio', audioRouter);
app.use('/api/boss', bossRouter);
app.use('/api/telemetry', telemetryRouter);


app.get('/health', (_req, res) => {
  res.json({ status: 'ok', generatedDir: GENERATED_DIR });
});


const httpServer = http.createServer(app);
attachWebSocketServer(httpServer);

httpServer.listen(PORT, () => {
  console.log(`[server] Mistral Raid server running at http://localhost:${PORT}`);
  console.log(`[server] Generated audio stored in: ${GENERATED_DIR}`);

  if (!process.env.ELEVENLABS_API_KEY) {
    console.warn('[server] WARNING: ELEVENLABS_API_KEY is not set – audio generation will fail');
  } else {
    console.log('[server] ElevenLabs API key loaded');
  }

  if (!process.env.MISTRAL_API_KEY) {
    console.warn('[server] WARNING: MISTRAL_API_KEY is not set – AI responses will fail');
  } else {
    const key = process.env.MISTRAL_API_KEY;
    const preview = key.length >= 8 ? `${key.slice(0, 4)}…${key.slice(-4)}` : '****';
    console.log(`[server] Mistral API key loaded (${preview})`);
  }
});
