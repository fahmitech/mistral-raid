interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  decay: number;
  size: number;
  color: string;
}

const CANVAS_W = 384;
const CANVAS_H = 216;

const ensureBackdropStyles = (): void => {
  if (document.getElementById('dungeon-backdrop-styles')) return;
  const style = document.createElement('style');
  style.id = 'dungeon-backdrop-styles';
  style.textContent = `
    .dungeon-bg-canvas,
    .dungeon-spark-canvas {
      position:absolute;
      inset:0;
      width:100%;
      height:100%;
      pointer-events:none;
      image-rendering:pixelated;
    }
    .dungeon-bg-canvas { z-index:0; }
    .dungeon-spark-canvas { z-index:1; }
    .dungeon-scanlines {
      position:absolute;
      inset:0;
      z-index:2;
      pointer-events:none;
      background: repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.08) 3px, rgba(0,0,0,0.08) 4px);
    }
    .dungeon-vignette {
      position:absolute;
      inset:0;
      z-index:2;
      pointer-events:none;
      background: radial-gradient(ellipse 80% 80% at 50% 50%, transparent 45%, rgba(0,0,0,0.78) 100%);
    }
  `;
  document.head.appendChild(style);
};

export class DungeonBackdrop {
  private bgCanvas: HTMLCanvasElement;
  private sparkCanvas: HTMLCanvasElement;
  private bgCtx: CanvasRenderingContext2D | null;
  private sparkCtx: CanvasRenderingContext2D | null;
  private scanlines: HTMLDivElement;
  private vignette: HTMLDivElement;
  private animationFrame?: number;
  private sparks: Spark[] = [];
  private phase = 0;
  private frame = 0;
  private readonly torchPositions: Array<{ x: number; y: number }> = [
    { x: 48, y: 54 },
    { x: CANVAS_W - 52, y: 54 },
  ];

  constructor(private host: HTMLElement) {
    ensureBackdropStyles();

    this.bgCanvas = document.createElement('canvas');
    this.bgCanvas.width = CANVAS_W;
    this.bgCanvas.height = CANVAS_H;
    this.bgCanvas.className = 'dungeon-bg-canvas';
    this.bgCtx = this.bgCanvas.getContext('2d');

    this.sparkCanvas = document.createElement('canvas');
    this.sparkCanvas.width = CANVAS_W;
    this.sparkCanvas.height = CANVAS_H;
    this.sparkCanvas.className = 'dungeon-spark-canvas';
    this.sparkCtx = this.sparkCanvas.getContext('2d');

    this.scanlines = document.createElement('div');
    this.scanlines.className = 'dungeon-scanlines';

    this.vignette = document.createElement('div');
    this.vignette.className = 'dungeon-vignette';

    const fragment = document.createDocumentFragment();
    fragment.append(this.bgCanvas, this.sparkCanvas, this.scanlines, this.vignette);
    this.host.appendChild(fragment);

    this.drawBackgroundFrame();
    this.startTorchLoop();
  }

  destroy(): void {
    if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
    this.sparks = [];
    this.bgCanvas.remove();
    this.sparkCanvas.remove();
    this.scanlines.remove();
    this.vignette.remove();
  }

  private startTorchLoop(): void {
    const loop = (): void => {
      this.phase += 0.08;
      this.frame += 1;
      this.drawBackgroundFrame();
      this.drawTorches();
      this.drawSparks();
      this.animationFrame = requestAnimationFrame(loop);
    };
    loop();
  }

  private drawBackgroundFrame(): void {
    if (!this.bgCtx) return;
    const ctx = this.bgCtx;
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    const VOID = '#030108';
    ctx.fillStyle = VOID;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    for (let row = 0; row < 12; row += 1) {
      for (let col = 0; col < 42; col += 1) {
        const offset = row % 2 ? 5 : 0;
        const x = col * 10 + offset - 10;
        const y = CANVAS_H - 72 + row * 6;
        if (y > CANVAS_H) continue;
        const shades = ['#0e0b1a', '#161328', '#1e1a34'];
        ctx.fillStyle = shades[(row * 3 + col) % shades.length];
        ctx.fillRect(x, y, 9, 5);
        ctx.fillStyle = '#05030a';
        ctx.fillRect(x, y, 9, 1);
        ctx.fillRect(x, y, 1, 5);
      }
    }

    for (let row = 0; row < 24; row += 1) {
      const offset = row % 2 ? 6 : 0;
      for (let col = 0; col < 5; col += 1) {
        const x = col * 13 + offset;
        const y = row * 9;
        const shades = ['#0e0b1a', '#161328', '#1e1a34'];
        ctx.fillStyle = shades[(row + col * 2) % shades.length];
        ctx.fillRect(x, y, 12, 8);
        ctx.fillStyle = '#05030a';
        ctx.fillRect(x, y, 12, 1);
        ctx.fillRect(x, y, 1, 8);
      }
    }

    for (let row = 0; row < 24; row += 1) {
      const offset = row % 2 ? 6 : 0;
      for (let col = 0; col < 5; col += 1) {
        const x = CANVAS_W - col * 13 - offset - 12;
        const y = row * 9;
        const shades = ['#161328', '#0e0b1a', '#1e1a34'];
        ctx.fillStyle = shades[(row + col * 2) % shades.length];
        ctx.fillRect(x, y, 12, 8);
        ctx.fillStyle = '#05030a';
        ctx.fillRect(x + 11, y, 1, 8);
        ctx.fillRect(x, y, 12, 1);
      }
    }

    const archShapes: Array<[number, number, number, number]> = [
      [155, 14, 74, 3],
      [147, 17, 90, 2],
      [141, 19, 102, 2],
      [137, 21, 110, 2],
      [134, 23, 116, 55],
    ];
    ctx.fillStyle = '#262240';
    archShapes.forEach(([x, y, w, h]) => ctx.fillRect(x, y, w, h));
    ctx.fillStyle = '#030108';
    ctx.fillRect(138, 25, 108, 51);

    const glow = ctx.createRadialGradient(192, 54, 0, 192, 54, 48);
    glow.addColorStop(0, 'rgba(80,30,160,0.38)');
    glow.addColorStop(0.5, 'rgba(50,10,110,0.16)');
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.fillRect(138, 25, 108, 51);

    const chainColor = ['#261d36', '#1b1528'];
    [[76, 0], [CANVAS_W - 80, 0]].forEach(([cx]) => {
      for (let i = 0; i < 10; i += 1) {
        ctx.fillStyle = chainColor[i % 2];
        ctx.fillRect(cx + (i % 2 ? 1 : 0), i * 5, 2, 4);
      }
    });

    this.torchPositions.forEach(({ x, y }) => {
      ctx.fillStyle = '#2b1a10';
      ctx.fillRect(x - 3, y - 2, 6, 34);
      ctx.fillStyle = '#3a2314';
      ctx.fillRect(x - 2, y - 2, 4, 34);
      ctx.fillStyle = '#4f2e18';
      for (let i = 0; i < 4; i += 1) {
        ctx.fillRect(x - 4, y + 4 + i * 6, 8, 3);
      }
      ctx.fillStyle = '#1a0f07';
      ctx.fillRect(x - 5, y + 30, 10, 4);
    });

    const ceiling = ctx.createLinearGradient(0, 0, 0, 20);
    ceiling.addColorStop(0, 'rgba(0,0,0,0.9)');
    ceiling.addColorStop(1, 'transparent');
    ctx.fillStyle = ceiling;
    ctx.fillRect(0, 0, CANVAS_W, 20);

    const fog = ctx.createLinearGradient(0, CANVAS_H - 16, 0, CANVAS_H);
    fog.addColorStop(0, 'transparent');
    fog.addColorStop(1, 'rgba(0,0,0,0.6)');
    ctx.fillStyle = fog;
    ctx.fillRect(0, CANVAS_H - 16, CANVAS_W, 16);
  }

  private drawTorches(): void {
    if (!this.bgCtx) return;
    const ctx = this.bgCtx;
    this.torchPositions.forEach(({ x, y }, idx) => {
      this.drawTorchFlame(ctx, x, y, idx);
    });
  }

  private drawTorchFlame(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    idx: number,
  ): void {
    const pattern = [
      { height: 2, width: 5, color: '#fff7d4' },
      { height: 3, width: 7, color: '#ffe07c' },
      { height: 3, width: 10, color: '#ffb347' },
      { height: 3, width: 12, color: '#ff7a1e' },
      { height: 2, width: 10, color: '#e04a14' },
      { height: 2, width: 7, color: '#a8290a' },
    ];

    let currentY = y - 4;
    const wobble = Math.sin(this.phase * 1.6 + idx * 0.9);

    pattern.forEach((row, rowIdx) => {
      currentY -= row.height;
      const width = row.width + wobble * (1.8 - rowIdx * 0.25);
      const left = Math.round(x - width / 2);
      ctx.fillStyle = row.color;
      ctx.fillRect(left, Math.round(currentY), Math.max(2, Math.round(width)), row.height);
    });

    ctx.fillStyle = '#fffce6';
    ctx.fillRect(x - 1, Math.round(currentY) - 2, 2, 3);

    for (let i = 0; i < 3; i += 1) {
      const sparkX = Math.round(x + Math.sin(this.phase * 2 + idx + i) * 3);
      const sparkY = Math.round(currentY - 4 - i * 4 - Math.abs(Math.sin(this.phase + i)) * 2);
      ctx.fillStyle = ['#ffd46f', '#ff9c32', '#ff7120'][i % 3];
      ctx.fillRect(sparkX, sparkY, 1, 2);
    }

    ctx.fillStyle = 'rgba(255,180,90,0.18)';
    ctx.fillRect(x - 6, Math.round(currentY) - 2, 12, 6);
  }

  private drawSparks(): void {
    if (!this.sparkCtx) return;
    const ctx = this.sparkCtx;
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    if (this.frame % 9 === 0) {
      this.torchPositions.forEach(({ x, y }) => this.spawnSpark(x, y));
    }

    for (let i = this.sparks.length - 1; i >= 0; i -= 1) {
      const spark = this.sparks[i];
      spark.x += spark.vx;
      spark.y += spark.vy;
      spark.life -= spark.decay;
      if (spark.life <= 0) {
        this.sparks.splice(i, 1);
        continue;
      }
      ctx.globalAlpha = spark.life * 0.9;
      ctx.fillStyle = spark.color;
      ctx.fillRect(Math.round(spark.x), Math.round(spark.y), spark.size, spark.size);
    }
    ctx.globalAlpha = 1;
  }

  private spawnSpark(x: number, y: number): void {
    this.sparks.push({
      x: x + (Math.random() - 0.5) * 8,
      y: y - 4,
      vx: (Math.random() - 0.5) * 0.8,
      vy: -(Math.random() * 1.3 + 0.4),
      life: 1,
      decay: 0.02 + Math.random() * 0.02,
      size: Math.random() < 0.4 ? 2 : 1,
      color: Math.random() < 0.5 ? '#f0c040' : '#ff8840',
    });
  }
}
