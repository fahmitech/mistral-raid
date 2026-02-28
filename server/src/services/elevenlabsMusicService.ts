/**
 * elevenlabsMusicService.ts
 *
 * Credit-safe music & SFX generation service backed by ElevenLabs.
 *
 * Features:
 * - Organised subfolders: generated-audio/music/ and generated-audio/sfx/
 * - Hash-based caching: each sound is keyed by its name; the manifest also
 *   stores a MD5 of the prompt so stale entries can be detected.
 * - manifest.json tracks every API call and estimated credit cost so you can
 *   monitor spend at the hackathon demo.
 * - Automatic migration of legacy flat-folder cached files into the new structure.
 * - Never calls the API if a cached file already exists on disk.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import axios from 'axios';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUDIO_DIR   = path.join(__dirname, '..', '..', 'generated-audio');
const MUSIC_DIR   = path.join(AUDIO_DIR, 'music');
const SFX_DIR     = path.join(AUDIO_DIR, 'sfx');
const MANIFEST_PATH = path.join(AUDIO_DIR, 'manifest.json');

// Ensure subdirectories exist at module load time
[MUSIC_DIR, SFX_DIR].forEach((d) => fs.mkdirSync(d, { recursive: true }));

// ─── Manifest types ─────────────────────────────────────────────────────────────

interface ManifestEntry {
  name:              string;
  prompt:            string;
  promptHash:        string;  // MD5 of the prompt — detect if prompt changed
  type:              'music' | 'sfx';
  generatedAt:       string;
  durationSecs:      number;
  estimatedCredits:  number;
}

interface Manifest {
  totalApiCalls:           number;
  totalEstimatedCredits:   number;
  sounds:                  Record<string, ManifestEntry>;
}

// ─── Public types ───────────────────────────────────────────────────────────────

export type SoundType = 'music' | 'sfx';

export interface SoundDefinition {
  name:      string;
  prompt:    string;
  type:      SoundType;
  duration?: number; // seconds
}

export interface GeneratedResult {
  url:       string;
  fromCache: boolean;
}

export interface AudioStats {
  totalApiCalls:          number;
  totalEstimatedCredits:  number;
  cachedCount:            number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function loadManifest(): Manifest {
  if (!fs.existsSync(MANIFEST_PATH)) {
    return { totalApiCalls: 0, totalEstimatedCredits: 0, sounds: {} };
  }
  try {
    return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')) as Manifest;
  } catch {
    return { totalApiCalls: 0, totalEstimatedCredits: 0, sounds: {} };
  }
}

function saveManifest(m: Manifest): void {
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(m, null, 2));
}

function md5(text: string): string {
  return crypto.createHash('md5').update(text).digest('hex').slice(0, 12);
}

/**
 * Rough ElevenLabs credit estimate:
 *  - Music generation: ~1.2 credits / second
 *  - SFX generation:   ~0.8 credits / second
 * (Actual billing may vary — this is a planning estimate for the manifest.)
 */
function estimateCredits(durationSecs: number, type: SoundType): number {
  return type === 'music'
    ? Math.ceil(durationSecs * 1.2)
    : Math.ceil(durationSecs * 0.8);
}

function subDir(type: SoundType): string {
  return type === 'music' ? MUSIC_DIR : SFX_DIR;
}

function urlPath(type: SoundType, filename: string): string {
  return `/generated-audio/${type}/${filename}`;
}

// ─── Core ───────────────────────────────────────────────────────────────────────

/**
 * Generate (or return from cache) a sound asset.
 * Never calls ElevenLabs if a cached file already exists on disk.
 */
export async function generateAndCache(def: SoundDefinition): Promise<GeneratedResult> {
  const filename  = `${def.name}.mp3`;
  const targetDir = subDir(def.type);
  const filePath  = path.join(targetDir, filename);
  const url       = urlPath(def.type, filename);

  // ── Cache hit (new subfolder) ──────────────────────────────────────────────
  if (fs.existsSync(filePath)) {
    return { url, fromCache: true };
  }

  // ── Legacy flat path — migrate automatically ───────────────────────────────
  const legacyPath = path.join(AUDIO_DIR, filename);
  if (fs.existsSync(legacyPath)) {
    fs.copyFileSync(legacyPath, filePath);
    console.log(`[music-svc] Migrated "${filename}" → ${def.type}/ subfolder`);
    return { url, fromCache: true };
  }

  // ── Call ElevenLabs ───────────────────────────────────────────────────────
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY not set in environment');

  const durationSecs = def.duration ?? 10;
  const credits      = estimateCredits(durationSecs, def.type);

  console.log(
    `[music-svc] Generating "${def.name}" ` +
    `(${def.type}, ~${durationSecs}s, ~${credits} credits)…`
  );

  const response = await axios.post(
    'https://api.elevenlabs.io/v1/sound-generation',
    {
      text:               def.prompt,
      duration_seconds:   durationSecs,
      prompt_influence:   0.3,
    },
    {
      headers: {
        'xi-api-key':   apiKey,
        Accept:         'audio/mpeg',
        'Content-Type': 'application/json',
      },
      responseType: 'arraybuffer',
      timeout:      90_000,
    }
  );

  fs.writeFileSync(filePath, Buffer.from(response.data as ArrayBuffer));

  // ── Update manifest ────────────────────────────────────────────────────────
  const manifest = loadManifest();
  manifest.totalApiCalls          += 1;
  manifest.totalEstimatedCredits  += credits;
  manifest.sounds[def.name]        = {
    name:             def.name,
    prompt:           def.prompt,
    promptHash:       md5(def.prompt),
    type:             def.type,
    generatedAt:      new Date().toISOString(),
    durationSecs,
    estimatedCredits: credits,
  };
  saveManifest(manifest);

  console.log(
    `[music-svc] ✓ "${def.name}" saved. ` +
    `Total: ${manifest.totalApiCalls} calls / ` +
    `~${manifest.totalEstimatedCredits} estimated credits`
  );

  return { url, fromCache: false };
}

// ─── Stats ──────────────────────────────────────────────────────────────────────

export function getStats(): AudioStats {
  const m = loadManifest();
  return {
    totalApiCalls:         m.totalApiCalls,
    totalEstimatedCredits: m.totalEstimatedCredits,
    cachedCount:           Object.keys(m.sounds).length,
  };
}

/**
 * Check if a sound is already cached (checks both new subfolder and legacy flat path).
 */
export function isCached(name: string, type: SoundType): boolean {
  const filename = `${name}.mp3`;
  return (
    fs.existsSync(path.join(subDir(type), filename)) ||
    fs.existsSync(path.join(AUDIO_DIR, filename))
  );
}
