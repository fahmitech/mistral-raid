import { Router } from 'express';
import https from 'https';
import type { CompanionContext } from '../agents/gameCompanionAgent.js';
import { queryCompanion } from '../agents/gameCompanionAgent.js';
import type { CompanionCombatContext, CompanionPersonality } from '../agents/aiCompanionCombatAgent.js';
import { generateCompanionDecision } from '../agents/aiCompanionCombatAgent.js';

export const companionRouter = Router();

// Companion voice config — uses a narrator-style ElevenLabs voice
const COMPANION_VOICE_ID = process.env.COMPANION_VOICE_ID ?? 'EXAVITQu4vr4xnSDxMaL'; // Sarah — calm narrator
const COMPANION_MODEL_ID = 'eleven_flash_v2_5';

async function synthesizeCompanionTTS(text: string): Promise<Buffer | null> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return null;

  return new Promise<Buffer | null>((resolve) => {
    const body = JSON.stringify({
      text,
      model_id: COMPANION_MODEL_ID,
      voice_settings: { stability: 0.6, similarity_boost: 0.7, speed: 1.0 },
    });

    const options = {
      hostname: 'api.elevenlabs.io',
      path: `/v1/text-to-speech/${COMPANION_VOICE_ID}?output_format=mp3_44100_128`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(Buffer.concat(chunks));
        } else {
          console.warn(`[companion-tts] ElevenLabs returned ${res.statusCode}`);
          resolve(null);
        }
      });
    });

    req.on('error', (err) => {
      console.error('[companion-tts] Request error:', err);
      resolve(null);
    });

    const timeout = setTimeout(() => {
      req.destroy();
      resolve(null);
    }, 6000);

    req.on('close', () => clearTimeout(timeout));
    req.write(body);
    req.end();
  });
}

/**
 * POST /api/companion/query
 * Body: { message: string, context: CompanionContext, withVoice?: boolean }
 * Returns: { reply, audioBase64? }
 */
companionRouter.post('/query', async (req, res) => {
  const { message, context, withVoice } = req.body as {
    message?: string;
    context?: CompanionContext;
    withVoice?: boolean;
  };

  if (!message || !context) {
    res.status(400).json({ error: 'message and context are required' });
    return;
  }

  try {
    const reply = await queryCompanion(message, context);

    let audioBase64: string | null = null;
    if (withVoice && reply.reply_text) {
      const audioBuffer = await synthesizeCompanionTTS(reply.reply_text);
      if (audioBuffer) {
        audioBase64 = audioBuffer.toString('base64');
      }
    }

    res.json({ reply, audioBase64 });
  } catch (err) {
    console.error('[companion] query error:', err);
    res.status(500).json({ error: 'Companion unavailable' });
  }
});

/**
 * POST /api/companion/combat-decision
 * Body: { context: CompanionCombatContext, personality: CompanionPersonality }
 * Returns: { decision: CompanionDecision }
 *
 * Called every ~500ms by LevelScene when AI Co-Op mode is active.
 * Uses mistral-large-latest to pick movement/attack/dash/protect/speak.
 */
companionRouter.post('/combat-decision', async (req, res) => {
  const { context, personality } = req.body as {
    context?: CompanionCombatContext;
    personality?: CompanionPersonality;
  };

  if (!context) {
    res.status(400).json({ error: 'context is required' });
    return;
  }

  const validPersonalities: CompanionPersonality[] = ['aggressive', 'tactical', 'protector', 'balanced'];
  const safePersonality: CompanionPersonality = validPersonalities.includes(personality as CompanionPersonality)
    ? (personality as CompanionPersonality)
    : 'balanced';

  try {
    const decision = await generateCompanionDecision(context, safePersonality);
    res.json({ decision });
  } catch (err) {
    console.error('[companion] combat-decision error:', err);
    // Return a safe fallback so the client always gets a valid response
    res.json({
      decision: { movement: 'idle', attack: false, target_id: null, dash: false, protect: false, speak: null },
    });
  }
});
