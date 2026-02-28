import axios from 'axios';

const ELEVENLABS_BASE = 'https://api.elevenlabs.io/v1';
const NARRATOR_VOICE_ID = '21m00Tcm4TlvDq8ikWAM'; // Rachel - clear narrator voice

export type SoundType = 'sfx' | 'music' | 'voice';

export interface GenerateSoundOptions {
  prompt: string;
  type: SoundType;
  duration?: number;
}

function getApiKey(): string {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error('ELEVENLABS_API_KEY is not set in environment');
  return key;
}

async function generateSFXOrMusic(options: GenerateSoundOptions): Promise<Buffer> {
  const apiKey = getApiKey();

  const body: Record<string, unknown> = {
    text: options.prompt,
    prompt_influence: 0.3,
  };

  if (options.duration !== undefined) {
    // ElevenLabs sound-generation max is 22 seconds
    body.duration_seconds = Math.min(options.duration, 22);
  }

  const response = await axios.post<ArrayBuffer>(
    `${ELEVENLABS_BASE}/sound-generation`,
    body,
    {
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      responseType: 'arraybuffer',
      timeout: 60_000,
    }
  );

  return Buffer.from(response.data);
}

async function generateVoice(options: GenerateSoundOptions): Promise<Buffer> {
  const apiKey = getApiKey();

  const response = await axios.post<ArrayBuffer>(
    `${ELEVENLABS_BASE}/text-to-speech/${NARRATOR_VOICE_ID}`,
    {
      text: options.prompt,
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.45,
        similarity_boost: 0.75,
        style: 0.2,
        use_speaker_boost: true,
      },
    },
    {
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      responseType: 'arraybuffer',
      timeout: 60_000,
    }
  );

  return Buffer.from(response.data);
}

export async function generateSound(options: GenerateSoundOptions): Promise<Buffer> {
  if (options.type === 'voice') {
    return generateVoice(options);
  }
  return generateSFXOrMusic(options);
}
