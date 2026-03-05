import { INTERNAL_HEIGHT, INTERNAL_WIDTH } from '../config/constants';

export interface LevelHUDStats {
  level: number;
  kills: number;
  killThreshold: number;
  lives: number;
  coins: number;
  score: number;
  weaponLabel: string;
}

export class LevelHUDOverlay {
  private container: HTMLDivElement;
  private stage: HTMLDivElement;
  private content: HTMLDivElement;
  private levelEl: HTMLSpanElement;
  private killsEl: HTMLSpanElement;
  private livesEl: HTMLSpanElement;
  private coinsEl: HTMLSpanElement;
  private scoreEl: HTMLSpanElement;
  private weaponEl: HTMLSpanElement;
  private hintEl: HTMLDivElement;
  private dashEl: HTMLSpanElement;
  private shieldEl: HTMLSpanElement;
  private telemetryEl: HTMLSpanElement;
  private companionEl: HTMLDivElement;
  private dashResetTimer: number | null = null;
  private lastDashCharges = 0;
  private resizeObserver: ResizeObserver;
  private canvas: HTMLCanvasElement;
  private parent: HTMLElement;

  constructor(parent: HTMLElement, canvas: HTMLCanvasElement) {
    this.parent = parent;
    this.canvas = canvas;
    parent.querySelectorAll<HTMLDivElement>('[data-level-hud="true"]').forEach((node) => node.remove());

    this.container = document.createElement('div');
    this.container.setAttribute('data-level-hud', 'true');
    this.container.style.position = 'absolute';
    this.container.style.inset = '0';
    this.container.style.pointerEvents = 'none';
    this.container.style.zIndex = '40';

    this.stage = document.createElement('div');
    Object.assign(this.stage.style, {
      position: 'absolute',
      width: `${INTERNAL_WIDTH}px`,
      height: `${INTERNAL_HEIGHT}px`,
      transformOrigin: 'top left',
      pointerEvents: 'none',
    });

    this.content = document.createElement('div');
    Object.assign(this.content.style, {
      position: 'absolute',
      inset: '0',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: '8px 10px',
      fontFamily: 'system-ui, -apple-system, "Segoe UI", "Roboto", Arial',
      fontSize: '9px',
      color: '#d5e0ff',
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
      pointerEvents: 'none',
    });

    this.content.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:18px;">
        <div style="display:flex;flex-direction:column;gap:6px;">
          <div data-stat="level" data-style="pixel"></div>
          <div data-stat="kills" data-style="pixel"></div>
          <div data-stat="lives" data-style="pixel"></div>
          <div data-stat="coins" data-style="pixel"></div>
        </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;">
        <div style="
          min-width:160px;
          padding:4px 8px;
          font-family:'Press Start 2P', monospace;
          color:#fee2b3;
          letter-spacing:0;
          background:transparent;
          border:none;
        " data-stat="score"></div>
        <div style="
          min-width:160px;
          padding:4px 8px;
          font-family:'Press Start 2P', monospace;
          color:#fef08a;
          letter-spacing:0;
          background:transparent;
          border:none;
        " data-stat="weapon"></div>
        <span data-stat="telemetry" style="margin-top:6px;color:#bef264;"></span>
        <div data-companion style="
          margin-top:4px;
          padding:4px 8px;
          font-family:'Press Start 2P', monospace;
          font-size:15px;
          color:#c084fc;
          letter-spacing:0;
          display:none;
        "></div>
      </div>
    </div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:8px;margin-bottom:6px;">
        <div data-hint style="
          font-family:'Press Start 2P', monospace;
          color:#bbf7d0;
          letter-spacing:0;
          padding:6px 10px;
          display:none;
        ">[E] Pick up</div>
        <div style="display:flex;justify-content:center;gap:48px;margin-top:-12px;">
          <span data-dash style="
            font-family:'Press Start 2P', monospace;
            color:#7dd3fc;
            letter-spacing:0;
            font-size:10px;
            text-align:center;
            min-width:180px;
            display:block;
          ">DASH [SPACE]</span>
          <span data-shield style="
            font-family:'Press Start 2P', monospace;
            color:#c4b5fd;
            letter-spacing:0;
            font-size:10px;
            text-align:center;
            min-width:200px;
            display:block;
          ">SHIELD [SHIFT]</span>
        </div>
      </div>
    `;

    this.stage.appendChild(this.content);
    this.container.appendChild(this.stage);
    parent.appendChild(this.container);

    this.resizeObserver = new ResizeObserver(() => this.updateStage());
    this.resizeObserver.observe(this.canvas);
    this.updateStage();

    const applyPixelStyle = (el: HTMLElement | null) => {
      if (!el) return;
      el.style.fontFamily = "'Press Start 2P', monospace";
      el.style.fontSize = '12px';
      el.style.letterSpacing = '0';
      el.style.color = '#fef3c7';
      el.style.textShadow = '0 1px 0 rgba(0,0,0,0.6)';
    };

    this.levelEl = this.content.querySelector('[data-stat="level"]') as HTMLSpanElement;
    this.killsEl = this.content.querySelector('[data-stat="kills"]') as HTMLSpanElement;
    this.livesEl = this.content.querySelector('[data-stat="lives"]') as HTMLSpanElement;
    this.coinsEl = this.content.querySelector('[data-stat="coins"]') as HTMLSpanElement;
    [this.levelEl, this.killsEl, this.livesEl, this.coinsEl].forEach(applyPixelStyle);
    this.scoreEl = this.content.querySelector('[data-stat="score"]') as HTMLSpanElement;
    this.weaponEl = this.content.querySelector('[data-stat="weapon"]') as HTMLSpanElement;
    this.hintEl = this.content.querySelector('[data-hint]') as HTMLDivElement;
    this.dashEl = this.content.querySelector('[data-dash]') as HTMLSpanElement;
    this.shieldEl = this.content.querySelector('[data-shield]') as HTMLSpanElement;
    this.telemetryEl = this.content.querySelector('[data-stat="telemetry"]') as HTMLSpanElement;
    this.companionEl = this.content.querySelector('[data-companion]') as HTMLDivElement;
  }

  updateStats(stats: LevelHUDStats): void {
    this.levelEl.textContent = `LEVEL ${stats.level}`;
    this.killsEl.textContent = `KILLS ${stats.kills} / ${stats.killThreshold}`;
    this.livesEl.textContent = `LIVES ${stats.lives}`;
    this.coinsEl.textContent = `COINS ${stats.coins}`;
    this.scoreEl.textContent = `SCORE: ${stats.score}`;
    this.weaponEl.textContent = `WEAPON [I]: ${stats.weaponLabel}`;
  }

  setHintVisible(visible: boolean): void {
    this.hintEl.style.display = visible ? 'inline-flex' : 'none';
  }

  setDashCharges(charges: number): void {
    this.lastDashCharges = charges;
    const ready = charges > 0;
    this.dashEl.style.color = ready ? '#7dd3fc' : '#94a3b8';
    this.dashEl.style.opacity = ready ? '1' : '0.5';
  }

  flashDashWarning(): void {
    if (this.dashResetTimer) {
      window.clearTimeout(this.dashResetTimer);
      this.dashResetTimer = null;
    }
    this.dashEl.style.color = '#f87171';
    this.dashEl.style.opacity = '1';
    this.dashEl.animate?.(
      [
        { opacity: 1 },
        { opacity: 0.2 },
        { opacity: 1 },
      ],
      { duration: 260, easing: 'ease-in-out' }
    );
    this.dashResetTimer = window.setTimeout(() => this.setDashCharges(this.lastDashCharges), 280);
  }

  setShieldReady(ready: boolean): void {
    this.shieldEl.style.color = ready ? '#c4b5fd' : '#94a3b8';
    this.shieldEl.style.opacity = ready ? '1' : '0.6';
  }

  setTelemetry(text: string, color: string): void {
    this.telemetryEl.textContent = text;
    this.telemetryEl.style.color = color;
  }

  setCompanionBadge(text: string | null): void {
    if (!text) {
      this.companionEl.style.display = 'none';
      this.companionEl.textContent = '';
      return;
    }
    this.companionEl.textContent = text;
    this.companionEl.style.display = 'inline-flex';
  }

  destroy(): void {
    if (this.dashResetTimer) {
      window.clearTimeout(this.dashResetTimer);
      this.dashResetTimer = null;
    }
    this.resizeObserver.disconnect();
    this.container.remove();
  }

  private updateStage(): void {
    const canvasRect = this.canvas.getBoundingClientRect();
    const parentRect = this.parent.getBoundingClientRect();
    const left = canvasRect.left - parentRect.left;
    const top = canvasRect.top - parentRect.top;
    this.stage.style.left = `${left}px`;
    this.stage.style.top = `${top}px`;
    this.stage.style.width = `${canvasRect.width}px`;
    this.stage.style.height = `${canvasRect.height}px`;
    this.stage.style.transform = 'none';
  }
}
