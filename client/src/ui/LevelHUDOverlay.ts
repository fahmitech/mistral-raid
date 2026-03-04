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

  constructor(parent: HTMLElement) {
    parent.querySelectorAll<HTMLDivElement>('[data-level-hud="true"]').forEach((node) => node.remove());

    this.container = document.createElement('div');
    this.container.setAttribute('data-level-hud', 'true');
    this.container.style.position = 'absolute';
    this.container.style.inset = '0';
    this.container.style.pointerEvents = 'none';
    this.container.style.display = 'flex';
    this.container.style.flexDirection = 'column';
    this.container.style.justifyContent = 'space-between';
    this.container.style.padding = '8px 10px';
    this.container.style.fontFamily = 'system-ui, -apple-system, "Segoe UI", "Roboto", Arial';
    this.container.style.fontSize = '9px';
    this.container.style.color = '#d5e0ff';
    this.container.style.textTransform = 'uppercase';
    this.container.style.letterSpacing = '0.04em';
    this.container.style.zIndex = '40';

    this.container.innerHTML = `
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
          background:rgba(5,10,22,0.75);
          border:2px solid rgba(9,14,28,0.9);
            padding:4px 8px;
            font-family:'Press Start 2P', monospace;
            color:#fee2b3;
            letter-spacing:0;
          " data-stat="score"></div>
          <div style="
            min-width:160px;
            background:rgba(5,10,22,0.7);
            border:2px solid rgba(9,14,28,0.9);
            padding:4px 8px;
            font-family:'Press Start 2P', monospace;
          color:#fef08a;
          letter-spacing:0;
        " data-stat="weapon"></div>
        <span data-stat="telemetry" style="margin-top:6px;color:#bef264;"></span>
        <div data-companion style="
          margin-top:4px;
          padding:4px 8px;
          font-family:'Press Start 2P', monospace;
          font-size:15px;
          color:#c084fc;
          background:rgba(10,4,24,0.75);
          border:2px solid rgba(32,16,52,0.9);
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
          background:rgba(8,16,31,0.75);
          border:2px solid rgba(24,40,68,0.7);
          box-shadow:0 4px 14px rgba(0,0,0,0.4);
          display:none;
        ">[E] Pick up</div>
        <div style="display:flex;justify-content:center;gap:48px;margin-top:-35px;">
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

    parent.appendChild(this.container);

    const applyPixelStyle = (el: HTMLElement | null) => {
      if (!el) return;
      el.style.fontFamily = "'Press Start 2P', monospace";
      el.style.fontSize = '12px';
      el.style.letterSpacing = '0';
      el.style.color = '#fef3c7';
      el.style.textShadow = '0 1px 0 rgba(0,0,0,0.6)';
    };

    this.levelEl = this.container.querySelector('[data-stat="level"]') as HTMLSpanElement;
    this.killsEl = this.container.querySelector('[data-stat="kills"]') as HTMLSpanElement;
    this.livesEl = this.container.querySelector('[data-stat="lives"]') as HTMLSpanElement;
    this.coinsEl = this.container.querySelector('[data-stat="coins"]') as HTMLSpanElement;
    [this.levelEl, this.killsEl, this.livesEl, this.coinsEl].forEach(applyPixelStyle);
    this.scoreEl = this.container.querySelector('[data-stat="score"]') as HTMLSpanElement;
    this.weaponEl = this.container.querySelector('[data-stat="weapon"]') as HTMLSpanElement;
    this.hintEl = this.container.querySelector('[data-hint]') as HTMLDivElement;
    this.dashEl = this.container.querySelector('[data-dash]') as HTMLSpanElement;
    this.shieldEl = this.container.querySelector('[data-shield]') as HTMLSpanElement;
    this.telemetryEl = this.container.querySelector('[data-stat="telemetry"]') as HTMLSpanElement;
    this.companionEl = this.container.querySelector('[data-companion]') as HTMLDivElement;
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
    this.container.remove();
  }
}
