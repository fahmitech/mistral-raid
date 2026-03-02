import Phaser from 'phaser';
import { CoopState } from './CoopState';

/**
 * F9 debug overlay for AI Co-Op Mode.
 * Reads runtime data written into the Phaser registry by LevelScene:
 *   registry key: 'companion_debug'  (updated every frame when overlay is open)
 */
export interface CompanionDebugData {
  personality: string;
  lastMovement: string;
  lastAttack: boolean;
  lastDash: boolean;
  lastProtect: boolean;
  lastSpeak: string | null;
  decisionLatencyMs: number;
  fallbackActive: boolean;
  companionHp: string;
  requestCount: number;
}

export class AICompanionDebugOverlay extends Phaser.Scene {
  private panel?: Phaser.GameObjects.Graphics;
  private lines: Phaser.GameObjects.Text[] = [];

  constructor() {
    super({ key: 'AICompanionDebugOverlay', active: false });
  }

  create(): void {
    const panelX = 4;
    const panelY = 4;
    const panelW = 148;
    const panelH = 112;

    this.panel = this.add.graphics();
    this.panel.fillStyle(0x000000, 0.78);
    this.panel.fillRoundedRect(panelX, panelY, panelW, panelH, 4);
    this.panel.lineStyle(1, 0x8844ff, 0.9);
    this.panel.strokeRoundedRect(panelX, panelY, panelW, panelH, 4);

    const style = {
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
      fontSize: '9px',
      color: '#ccddff',
      resolution: 2,
    };

    const baseX = panelX + 5;
    let baseY = panelY + 5;

    // Header
    this.add.text(baseX, baseY, '[F9] AI COMPANION DEBUG', { ...style, color: '#8844ff' });
    baseY += 12;
    this.add.graphics().lineStyle(1, 0x8844ff, 0.4).lineBetween(panelX, baseY, panelX + panelW, baseY);
    baseY += 4;

    const labels = [
      'Personality:', 'Movement:   ', 'Attack:     ',
      'Dash:       ', 'Protect:    ', 'Last speak: ',
      'Latency:    ', 'Fallback:   ', 'Comp HP:    ',
      'Requests:   ',
    ];

    labels.forEach((label) => {
      const t = this.add.text(baseX, baseY, label, style);
      this.lines.push(t);
      baseY += 10;
    });

    // Poll registry every 100ms
    this.time.addEvent({
      delay: 100,
      loop: true,
      callback: this.updateDisplay,
      callbackScope: this,
    });

    // Close on F9
    this.input.keyboard?.once('keydown-F9', () => {
      this.scene.stop();
    });
  }

  private updateDisplay(): void {
    const data = this.registry.get('companion_debug') as CompanionDebugData | undefined;
    if (!data) return;

    const values = [
      `${data.personality}`,
      `${data.lastMovement}`,
      `${data.lastAttack ? 'YES' : 'NO'}`,
      `${data.lastDash ? 'YES' : 'NO'}`,
      `${data.lastProtect ? 'YES' : 'NO'}`,
      data.lastSpeak ? `"${data.lastSpeak.substring(0, 14)}"` : '(silent)',
      `${data.decisionLatencyMs}ms`,
      data.fallbackActive ? '⚠ YES (heuristic)' : 'NO (Mistral)',
      `${data.companionHp}`,
      `${data.requestCount}`,
    ];

    this.lines.forEach((line, i) => {
      if (values[i] !== undefined) {
        // Re-render line with label + value
        const labels = [
          'Personality:', 'Movement:   ', 'Attack:     ',
          'Dash:       ', 'Protect:    ', 'Last speak: ',
          'Latency:    ', 'Fallback:   ', 'Comp HP:    ',
          'Requests:   ',
        ];
        const isFallback = i === 7 && data.fallbackActive;
        const color = isFallback ? '#ffaa44' : '#ccddff';
        line.setText(`${labels[i]} ${values[i]}`);
        line.setColor(color);
      }
    });
  }
}
