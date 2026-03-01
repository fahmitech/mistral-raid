import Phaser from 'phaser';
import { AudioManager } from './AudioManager';
import { AudioDebugInfo, MusicMood } from '../types/AudioTypes';

const PANEL_X = 4;
const PANEL_Y = 4;
const PANEL_W = 312;
const PANEL_H = 200; // expanded to fit credit stats section
const FONT = '"Press Start 2P"';

const SERVER_URL = 'http://localhost:3001';

interface AudioStats {
  totalApiCalls: number;
  totalEstimatedCredits: number;
  cachedCount: number;
}

const MOOD_COLOR: Record<MusicMood, string> = {
  calm: '#44cc88',
  tense: '#ffcc00',
  intense: '#ff8800',
  critical: '#ff3333',
};

const LAYER_COLOR: Record<string, string> = {
  menu: '#8899ff',
  hero_select: '#cc88ff',
  ambient: '#44ccaa',
  combat: '#ff8833',
  boss: '#ff4444',
  credits: '#aaddff',
  none: '#666666',
};

export class AudioDebugOverlay extends Phaser.Scene {
  private bg!: Phaser.GameObjects.Graphics;
  private titleText!: Phaser.GameObjects.Text;
  private lines: Phaser.GameObjects.Text[] = [];
  private bars: Phaser.GameObjects.Graphics[] = [];
  private stats: AudioStats = { totalApiCalls: 0, totalEstimatedCredits: 0, cachedCount: 0 };

  constructor() {
    super({ key: 'AudioDebugOverlay' });
  }

  create(): void {
    this.bg = this.add.graphics();
    void this.fetchStats();

    this.titleText = this.add
      .text(PANEL_X + PANEL_W / 2, PANEL_Y + 8, '🎵 AUDIO DEBUG  [F2]', {
        fontFamily: FONT,
        fontSize: '5px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setOrigin(0.5, 0)
      .setDepth(100);

    // Pre-create 22 text lines and 6 bar graphics (extra rows for credit stats)
    for (let i = 0; i < 22; i++) {
      this.lines.push(
        this.add
          .text(PANEL_X + 6, 0, '', {
            fontFamily: FONT,
            fontSize: '4px',
            color: '#cccccc',
          })
          .setDepth(100)
      );
    }
    for (let i = 0; i < 6; i++) {
      this.bars.push(this.add.graphics().setDepth(100));
    }

    // Close on F2
    this.input.keyboard?.on('keydown-F2', () => this.scene.stop());
    // Also allow ESC
    this.input.keyboard?.on('keydown-ESC', () => this.scene.stop());
  }

  update(): void {
    const d = AudioManager.get().getDebugInfo();
    this.redraw(d);
  }

  private redraw(d: AudioDebugInfo): void {
    // Background panel
    this.bg.clear();
    this.bg.fillStyle(0x050a18, 0.88);
    this.bg.fillRoundedRect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H, 5);
    this.bg.lineStyle(1, 0x1a3355, 0.95);
    this.bg.strokeRoundedRect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H, 5);
    // Header divider
    this.bg.lineStyle(1, 0x223355, 0.8);
    this.bg.lineBetween(PANEL_X + 4, PANEL_Y + 17, PANEL_X + PANEL_W - 4, PANEL_Y + 17);

    // ── Row layout ──────────────────────────────────────────────────────
    let row = 0;
    const ROW_H = 9;
    const startY = PANEL_Y + 20;

    const setText = (i: number, text: string, color = '#cccccc'): void => {
      if (!this.lines[i]) return;
      this.lines[i].setText(text);
      this.lines[i].setColor(color);
      this.lines[i].setY(startY + i * ROW_H);
    };

    const drawBar = (
      barIdx: number,
      rowIdx: number,
      labelX: number,
      barX: number,
      barW: number,
      value: number, // 0–1
      fillColor: number,
      label: string,
      valueStr: string
    ): void => {
      const g = this.bars[barIdx];
      if (!g) return;
      const y = startY + rowIdx * ROW_H - 1;
      g.clear();
      // background
      g.fillStyle(0x111111, 0.9);
      g.fillRect(barX, y, barW, 5);
      // fill
      g.fillStyle(fillColor, 1);
      g.fillRect(barX, y, Math.round(barW * Math.max(0, Math.min(1, value))), 5);
      // border
      g.lineStyle(1, 0x334455, 0.8);
      g.strokeRect(barX, y, barW, 5);

      this.lines[rowIdx]?.setText(`${label}`).setColor('#8899aa');
      // Value label on the right
      const valText = this.add.text(barX + barW + 3, y + 1, valueStr, {
        fontFamily: FONT, fontSize: '3px', color: '#ffffff',
      }).setDepth(101);
      // Auto-destroy after 1 frame — we redraw every frame so this is fine
      this.time.delayedCall(32, () => valText.destroy());
    };

    // ── Section 1: Music Layer + Mood ──────────────────────────────────
    const layerColor = LAYER_COLOR[d.layer] ?? '#cccccc';
    setText(row, `LAYER:  ${d.layer.toUpperCase().padEnd(11)} MOOD: ${d.intensityLevel.toUpperCase()}`, layerColor);
    row++;

    const trackStr = d.musicTracks.length ? d.musicTracks.join(', ') : 'none';
    setText(row, `TRACKS: ${trackStr}`, '#7799bb');
    row++;

    // Separator
    this.bg.lineStyle(1, 0x1a3355, 0.5);
    this.bg.lineBetween(PANEL_X + 4, startY + row * ROW_H, PANEL_X + PANEL_W - 4, startY + row * ROW_H);
    setText(row, '', '#333333');
    row++;

    // ── Section 2: Volume Bars ─────────────────────────────────────────
    const BAR_LABEL_W = 52;
    const BAR_X = PANEL_X + 6 + BAR_LABEL_W;
    const BAR_W = 130;

    drawBar(0, row, PANEL_X + 6, BAR_X, BAR_W, d.masterVolume, 0x44aaff, 'MASTER', `${Math.round(d.masterVolume * 100)}%`);
    row++;
    drawBar(1, row, PANEL_X + 6, BAR_X, BAR_W, d.musicVolume, 0xaa44ff, 'MUSIC ', `${Math.round(d.musicVolume * 100)}%`);
    row++;
    drawBar(2, row, PANEL_X + 6, BAR_X, BAR_W, d.sfxVolume, 0xff8844, 'SFX   ', `${Math.round(d.sfxVolume * 100)}%`);
    row++;

    // Separator
    this.bg.lineBetween(PANEL_X + 4, startY + row * ROW_H, PANEL_X + PANEL_W - 4, startY + row * ROW_H);
    setText(row, '', '#333333');
    row++;

    // ── Section 3: HP / Boss HP ────────────────────────────────────────
    const hpRatio = d.maxHp > 0 ? d.hp / d.maxHp : 0;
    const bossRatio = d.bossMaxHp > 0 ? d.bossHp / d.bossMaxHp : 0;

    drawBar(3, row, PANEL_X + 6, BAR_X, BAR_W, hpRatio, 0x33cc55, 'PLAYER', `${d.hp}/${d.maxHp}`);
    row++;
    const bossCol = bossRatio < 0.4 ? 0xff8800 : 0xff3333;
    drawBar(4, row, PANEL_X + 6, BAR_X, BAR_W, bossRatio, bossCol, 'BOSS  ', d.bossMaxHp > 0 ? `${Math.round(bossRatio * 100)}%` : 'N/A');
    row++;

    // Separator
    this.bg.lineBetween(PANEL_X + 4, startY + row * ROW_H, PANEL_X + PANEL_W - 4, startY + row * ROW_H);
    setText(row, '', '#333333');
    row++;

    // ── Section 4: State Flags ─────────────────────────────────────────
    const hb = d.heartbeat ? '♥ ON' : '○ off';
    const pre = d.presence ? '✓ ON' : '○ off';
    setText(row, `HEARTBEAT: ${hb}   PRESENCE: ${pre}   ENEMIES: ${d.enemyCount}`, MOOD_COLOR[d.intensityLevel]);
    row++;

    setText(row, `BUFFERS: ${d.loaded} loaded   ${d.loading} loading`, '#7799bb');
    row++;

    // Separator
    this.bg.lineBetween(PANEL_X + 4, startY + row * ROW_H, PANEL_X + PANEL_W - 4, startY + row * ROW_H);
    setText(row, '', '#333333');
    row++;

    // ── Section 5: Recent SFX ─────────────────────────────────────────
    setText(row, 'RECENT SFX:', '#8899aa');
    row++;
    const sfxLine = d.recent.slice(0, 4).join('  ›  ') || '—';
    setText(row, sfxLine, '#ffcc66');
    row++;

    // Separator
    this.bg.lineBetween(PANEL_X + 4, startY + row * ROW_H, PANEL_X + PANEL_W - 4, startY + row * ROW_H);
    setText(row, '', '#333333');
    row++;

    // ── Section 6: ElevenLabs Credit Stats ────────────────────────────
    setText(row, '⚡ ELEVENLABS CREDITS', '#ccaa44');
    row++;
    setText(
      row,
      `API CALLS: ${this.stats.totalApiCalls}   EST. CREDITS: ~${this.stats.totalEstimatedCredits}`,
      '#ffdd88'
    );
    row++;
    setText(row, `CACHED SOUNDS: ${this.stats.cachedCount} on disk`, '#88aacc');
    row++;

    // Hide remaining lines
    for (let i = row; i < this.lines.length; i++) {
      this.lines[i]?.setText('').setY(-100);
    }
  }

  private async fetchStats(): Promise<void> {
    try {
      const res = await fetch(`${SERVER_URL}/api/audio/stats`);
      if (res.ok) {
        this.stats = await res.json() as AudioStats;
      }
    } catch { /* server may not be running — stats will show zeros */ }
  }
}
