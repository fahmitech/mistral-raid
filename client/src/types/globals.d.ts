interface AudioSystemInterface {
  stopAllMusic(): void;
  stopMusic(id: string): void;
  playMusic(id: string): void;
  playSFX(id: string): void;
  isPlaying(id: string): boolean;
}

declare global {
  interface Window {
    AudioSystem: AudioSystemInterface;
  }
}

export {};
