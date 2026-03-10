import type { CompanionContext, CompanionReply } from '../types/arena';
import { GameState } from '../core/GameState';

const COIN_COST = 2;
const SERVER_URL = `${(import.meta as any).env?.VITE_SERVER_URL ?? 'http://localhost:8787'}/api/companion/query`;

export class VoiceController {
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private recording = false;
  private activated = false;

  constructor(
    private onTranscript: (text: string) => void,
    private onReply: (reply: CompanionReply) => void,
    private getContext: () => CompanionContext
  ) {}

  startRecording(): void {
    if (this.recording) return;

    // Coin gate — only pay once per activation session
    if (!this.activated) {
      const gs = GameState.get();
      const data = gs.getData();
      if (data.coins < COIN_COST) {
        this.onReply({
          reply_text: 'Not enough coins for voice guidance (need 2).',
          warning: false,
          direction_hint: 'none',
          proximity_alert: false,
        });
        return;
      }
      gs.addCoins(-COIN_COST);
      this.activated = true;
    }

    navigator.mediaDevices.getUserMedia({ audio: true })
      .then((stream) => {
        this.stream = stream;
        this.chunks = [];
        this.mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        this.mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) this.chunks.push(e.data);
        };
        this.mediaRecorder.onstop = () => this.handleStop();
        this.mediaRecorder.start();
        this.recording = true;
      })
      .catch((err) => {
        console.warn('[voice] getUserMedia failed:', err);
        this.onReply({
          reply_text: 'Microphone access denied.',
          warning: false,
          direction_hint: 'none',
          proximity_alert: false,
        });
      });
  }

  stopRecording(): void {
    if (!this.recording || !this.mediaRecorder) return;
    this.recording = false;
    this.mediaRecorder.stop();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }

  destroy(): void {
    this.stopRecording();
    this.mediaRecorder = null;
  }

  private handleStop(): void {
    if (this.chunks.length === 0) return;
    const blob = new Blob(this.chunks, { type: 'audio/webm' });
    void this.sendToServer(blob);
  }

  private async sendToServer(blob: Blob): Promise<void> {
    // Convert blob to base64 for JSON transport (simpler than multipart for our setup)
    const arrayBuffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const audioBase64 = btoa(binary);

    const context = this.getContext();

    try {
      // We use the text endpoint with a synthesized transcript via browser speech recognition fallback
      // Since Voxtral requires the server-side streaming setup, we use browser SpeechRecognition
      // to get the transcript and then query the companion
      this.onReply({
        reply_text: 'Voice captured — processing...',
        warning: false,
        direction_hint: 'none',
        proximity_alert: false,
      });

      // Use Web Speech API for transcription (browser-native, no cost)
      type SpeechRecognitionType = new () => {
        lang: string;
        interimResults: boolean;
        maxAlternatives: number;
        start(): void;
        stop(): void;
        onresult: ((e: { results: { [i: number]: { [j: number]: { transcript: string } } } }) => void) | null;
        onerror: ((e: { error: string }) => void) | null;
      };
      const win = window as unknown as {
        SpeechRecognition?: SpeechRecognitionType;
        webkitSpeechRecognition?: SpeechRecognitionType;
      };
      const SpeechRecognitionCtor = win.SpeechRecognition ?? win.webkitSpeechRecognition;

      if (!SpeechRecognitionCtor) {
        // Fallback to direct text API call
        const resp = await fetch(SERVER_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'Help me navigate the dungeon', context, withVoice: false }),
        });
        const data = await resp.json() as { reply: CompanionReply };
        this.onReply(data.reply);
        return;
      }

      // Use Speech Recognition API
      const recognition = new SpeechRecognitionCtor();
      recognition.lang = 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onresult = async (event) => {
        const transcript = event.results[0][0].transcript;
        this.onTranscript(transcript);

        try {
          const resp = await fetch(SERVER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: transcript, context, withVoice: true }),
          });
          const responseData = await resp.json() as { reply: CompanionReply; audioBase64: string | null };
          this.onReply(responseData.reply);
          if (responseData.audioBase64) {
            void this.playAudio(responseData.audioBase64);
          }
        } catch (err) {
          console.warn('[voice] companion fetch failed:', err);
        }
      };

      recognition.onerror = (event) => {
        console.warn('[voice] SpeechRecognition error:', event.error);
        this.onReply({
          reply_text: 'Could not understand audio. Try again.',
          warning: false,
          direction_hint: 'none',
          proximity_alert: false,
        });
      };

      recognition.start();
      // Stop after 5s max
      setTimeout(() => { try { recognition.stop(); } catch { /* */ } }, 5000);

    } catch (err) {
      console.warn('[voice] sendToServer error:', err);
    }

    // Suppress unused variable warning
    void audioBase64;
  }

  private async playAudio(base64: string): Promise<void> {
    try {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const ctx = new AudioContext();
      const buffer = await ctx.decodeAudioData(bytes.buffer);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(ctx.destination);
      src.start();
      src.onended = () => void ctx.close();
    } catch (err) {
      console.warn('[voice] audio playback failed:', err);
    }
  }
}
