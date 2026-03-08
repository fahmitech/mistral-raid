import Phaser from 'phaser';

const TORCH_WIDTH = 24;
const TORCH_HEIGHT = 44;

const Palette = {
  hw: '#1C0E06', hm: '#3A1E0C', hhi: '#5A3018',
  bk: '#0A0604', bhi: '#3A2010',
  ci: '#1A1008', cm: '#2E1C0C', chi: '#4A2C14',
  cs: '#3A2010', csh: '#6A3818',
  st: '#8A5020', eg: '#3D0800',
  f0: '#1A0000', f1: '#5C0000', f2: '#A00000', f3: '#D42000',
  f4: '#FF4500', f5: '#FF7800', f6: '#FFAA00', f7: '#FFD840', fw: '#FFF0C0',
} as const;

type PaletteKey = keyof typeof Palette;

type TorchState = {
  flicker: number;
  dark: boolean;
};

function px(ctx: CanvasRenderingContext2D, x: number, y: number, color: PaletteKey): void {
  ctx.fillStyle = Palette[color];
  ctx.fillRect(x, y, 1, 1);
}

function row(ctx: CanvasRenderingContext2D, x1: number, x2: number, y: number, color: PaletteKey): void {
  if (x2 < x1) return;
  ctx.fillStyle = Palette[color];
  ctx.fillRect(x1, y, x2 - x1 + 1, 1);
}

function noise(time: number, freq: number, amp: number): number {
  return Math.sin(time * freq) * amp;
}

function drawBody(ctx: CanvasRenderingContext2D): void {
  const cx = 11;

  for (let y = 24; y <= 41; y += 1) {
    px(ctx, cx - 1, y, 'hw');
    px(ctx, cx, y, 'hm');
    px(ctx, cx + 1, y, 'hhi');
  }

  [26, 30, 34, 38].forEach((bandY) => {
    row(ctx, cx - 1, cx + 1, bandY, 'bk');
    row(ctx, cx - 1, cx + 1, bandY + 1, 'bhi');
  });

  px(ctx, cx, 42, 'hm');
  px(ctx, cx, 43, 'bk');

  row(ctx, cx - 3, cx + 3, 22, 'cm');
  row(ctx, cx - 3, cx + 3, 21, 'chi');
  row(ctx, cx - 3, cx + 3, 20, 'cm');
  row(ctx, cx - 3, cx + 3, 19, 'ci');
  row(ctx, cx - 3, cx + 3, 18, 'chi');

  px(ctx, cx - 3, 20, 'ci');
  px(ctx, cx - 3, 21, 'ci');
  px(ctx, cx + 3, 19, 'chi');
  px(ctx, cx + 3, 20, 'chi');
  px(ctx, cx - 2, 20, 'chi');
  px(ctx, cx + 2, 20, 'chi');
  row(ctx, cx - 2, cx + 2, 23, 'eg');

  px(ctx, cx - 4, 19, 'cs');
  px(ctx, cx - 4, 18, 'csh');
  px(ctx, cx - 5, 17, 'cs');
  px(ctx, cx - 5, 16, 'st');
  px(ctx, cx - 3, 17, 'cs');
  px(ctx, cx - 3, 16, 'csh');
  px(ctx, cx - 4, 15, 'st');

  px(ctx, cx + 4, 19, 'cs');
  px(ctx, cx + 4, 18, 'csh');
  px(ctx, cx + 5, 17, 'cs');
  px(ctx, cx + 5, 16, 'st');
  px(ctx, cx + 3, 17, 'cs');
  px(ctx, cx + 3, 16, 'csh');
  px(ctx, cx + 4, 15, 'st');

  px(ctx, cx, 17, 'csh');
  px(ctx, cx, 16, 'st');
}

function drawFlame(ctx: CanvasRenderingContext2D, frame: number): void {
  const cx = 11;
  const baseY = 18;
  const t = frame * 0.13;

  const sway = Math.round(noise(t, 2.3, 1.0) + noise(t, 5.1, 0.5) * 0.4);
  const heightVar = Math.round((noise(t, 1.7, 1.2) + noise(t, 4.3, 0.6)) * 0.5);
  const widthVar = Math.round(noise(t, 3.1, 0.8) * 0.5);

  row(ctx, cx - 3, cx + 3, baseY, 'f0');
  row(ctx, cx - 3, cx + 3, baseY - 1, 'f1');
  row(ctx, cx - 3, cx + 3, baseY - 2, 'f1');

  const bw = 3 + widthVar;
  row(ctx, cx - bw, cx + bw, baseY - 3, 'f2');
  row(ctx, cx - bw, cx + bw, baseY - 4, 'f2');
  row(ctx, cx - (bw - 1) + Math.min(0, sway), cx + (bw - 1) + Math.max(0, sway), baseY - 5, 'f3');

  row(ctx, cx - 2 + sway, cx + 2 + sway, baseY - 6, 'f3');
  row(ctx, cx - 2, cx + 2, baseY - 7, 'f4');
  row(ctx, cx - 2 + sway, cx + 2 + sway, baseY - 8, 'f4');
  row(ctx, cx - 1, cx + 1, baseY - 9, 'f5');

  row(ctx, cx - 1 + sway, cx + 1 + sway, baseY - 10, 'f5');
  row(ctx, cx - 1, cx + 1, baseY - 11, 'f6');
  px(ctx, cx + sway, baseY - 12, 'f6');
  px(ctx, cx + sway, baseY - 13 + heightVar, 'f7');

  const tipY = baseY - 14 + heightVar;
  px(ctx, cx + sway, tipY, 'f7');
  px(ctx, cx + sway, tipY - 1, 'fw');

  const lt = frame * 0.09;
  const ls = Math.round(noise(lt, 3.3, 0.8) + noise(lt, 6.1, 0.4));
  if (noise(lt, 2.7, 1) > -0.3) {
    px(ctx, cx - 2 + ls, baseY - 8, 'f2');
    px(ctx, cx - 2 + ls, baseY - 9, 'f3');
    px(ctx, cx - 1 + ls, baseY - 10, 'f3');
  }

  const rt = frame * 0.11;
  const rs = Math.round(noise(rt, 2.9, 0.8));
  if (noise(rt, 3.5, 1) > -0.2) {
    px(ctx, cx + 2 + rs, baseY - 7, 'f2');
    px(ctx, cx + 2 + rs, baseY - 8, 'f3');
    px(ctx, cx + 1 + rs, baseY - 9, 'f4');
  }

  px(ctx, cx, baseY - 7, 'fw');
  px(ctx, cx, baseY - 8, 'fw');
  px(ctx, cx - 1, baseY - 7, 'f7');
  px(ctx, cx + 1, baseY - 7, 'f7');

  const sparks = [
    { tx: cx - 3, ty: baseY - 13, freq: 4.1, thresh: 0.55, color: 'f3' },
    { tx: cx + 4, ty: baseY - 12, freq: 5.7, thresh: 0.6, color: 'f4' },
    { tx: cx - 4, ty: baseY - 11, freq: 6.3, thresh: 0.65, color: 'f2' },
    { tx: cx + 2, ty: baseY - 15, freq: 7.1, thresh: 0.7, color: 'f5' },
    { tx: cx - 1, ty: baseY - 16, freq: 8.3, thresh: 0.78, color: 'f6' },
    { tx: cx + 3, ty: baseY - 15, freq: 9.1, thresh: 0.8, color: 'f7' },
    { tx: cx, ty: baseY - 17, freq: 5.3, thresh: 0.85, color: 'fw' },
    { tx: cx - 5, ty: baseY - 8, freq: 3.7, thresh: 0.72, color: 'f1' },
    { tx: cx + 5, ty: baseY - 9, freq: 4.9, thresh: 0.68, color: 'f2' },
  ];
  sparks.forEach(({ tx, ty, freq, thresh, color }) => {
    if (Math.sin(frame * freq * 0.05) > thresh) px(ctx, tx, ty, color as PaletteKey);
  });
}

export class InfernalTorch {
  private readonly textureKey: string;
  private readonly texture: Phaser.Textures.CanvasTexture;
  private readonly image: Phaser.GameObjects.Image;
  private readonly glow: Phaser.GameObjects.Image;
  private frame = 0;
  private state: TorchState = { flicker: 1, dark: false };
  private readonly baseScale: number;
  private readonly glowBaseScale: number;

  constructor(private scene: Phaser.Scene, x: number, y: number, scale = 2.2) {
    InfernalTorch.ensureGlowTexture(scene);
    this.textureKey = `infernal_torch_${Phaser.Utils.String.UUID()}`;
    this.texture = scene.textures.createCanvas(this.textureKey, TORCH_WIDTH, TORCH_HEIGHT);
    this.texture.context.imageSmoothingEnabled = false;

    this.image = scene.add.image(x, y, this.textureKey).setOrigin(0.5, 1).setDepth(12);
    this.baseScale = scale;
    this.image.setScale(scale);
    this.image.setBlendMode(Phaser.BlendModes.ADD);

    this.glow = scene.add.image(x, y - TORCH_HEIGHT * scale * 0.35, 'infernal_torch_glow')
      .setDepth(11)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setOrigin(0.5, 0.5);
    this.glowBaseScale = scale * 0.75;
    this.glow.setScale(this.glowBaseScale);

    this.drawFrame();
  }

  step(delta: number): void {
    this.frame += delta / 16.6667;
    if (this.state.dark) return;
    this.drawFrame();
    this.updateGlow();
  }

  setDark(dark: boolean): void {
    this.state.dark = dark;
    this.image.setVisible(!dark);
    this.glow.setVisible(!dark);
    if (!dark) {
      this.drawFrame();
      this.updateGlow();
    }
  }

  setFlicker(amount: number): void {
    this.state.flicker = amount;
    const alpha = 0.7 + amount * 0.3;
    this.image.setAlpha(alpha);
    this.image.setScale(this.baseScale * (0.95 + amount * 0.08));
    this.glow.setAlpha(0.4 + amount * 0.35);
    this.glow.setScale(this.glowBaseScale * (0.9 + amount * 0.2));
  }

  destroy(): void {
    this.image.destroy();
    this.glow.destroy();
    this.texture.destroy();
    this.scene.textures.remove(this.textureKey);
  }

  private drawFrame(): void {
    const ctx = this.texture.context;
    ctx.clearRect(0, 0, TORCH_WIDTH, TORCH_HEIGHT);
    drawBody(ctx);
    drawFlame(ctx, this.frame);
    this.texture.refresh();
  }

  private updateGlow(): void {
    const t = this.frame * 0.05;
    const pulse = 0.28 + Math.sin(t * 2.3) * 0.07 + Math.sin(t * 4.1) * 0.04;
    this.glow.setScale(this.glowBaseScale * (0.9 + pulse * 0.35));
  }

  private static ensureGlowTexture(scene: Phaser.Scene): void {
    const key = 'infernal_torch_glow';
    if (scene.textures.exists(key)) return;

    const size = 128;
    const tex = scene.textures.createCanvas(key, size, size);
    const ctx = tex.context;
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, 'rgba(255,80,0,0.9)');
    gradient.addColorStop(0.4, 'rgba(200,40,0,0.45)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    tex.refresh();
  }
}
