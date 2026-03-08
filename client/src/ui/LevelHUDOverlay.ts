import { INTERNAL_HEIGHT, INTERNAL_WIDTH } from '../config/constants';
import { DASH_MAX_CHARGES } from '../config/constants';

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
  private dashEl: HTMLDivElement;
  private shieldEl: HTMLDivElement;
  private shieldReadyEl: HTMLDivElement;
  private telemetryEl: HTMLSpanElement;
  private companionEl: HTMLDivElement;
  private healthContainer: HTMLDivElement;
  private dashResetTimer: number | null = null;
  private lastDashCharges = 0;
  private resizeObserver: ResizeObserver;
  private canvas: HTMLCanvasElement;
  private parent: HTMLElement;

  constructor(parent: HTMLElement, canvas: HTMLCanvasElement) {
    this.parent = parent;
    this.canvas = canvas;
    parent.querySelectorAll<HTMLDivElement>('[data-level-hud="true"]').forEach((node) => node.remove());

    // ── Outer container (covers parent, no interaction) ────────────────────────
    this.container = document.createElement('div');
    this.container.setAttribute('data-level-hud', 'true');
    Object.assign(this.container.style, {
      position: 'absolute', inset: '0',
      pointerEvents: 'none', zIndex: '40',
    });

    // ── Stage (720p-base div, scaled to match canvas) ──────────────────────────
    this.stage = document.createElement('div');
    Object.assign(this.stage.style, {
      position: 'absolute',
      transformOrigin: 'top left',
      pointerEvents: 'none',
    });

    // ── Content (fills stage, holds all HUD elements) ──────────────────────────
    this.content = document.createElement('div');
    Object.assign(this.content.style, {
      position: 'absolute', inset: '0',
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      padding: '20px 28px 16px 28px',
      fontFamily: "'Press Start 2P', monospace",
      fontSize: '16px', color: '#fef3c7',
      textTransform: 'uppercase', letterSpacing: '0',
      textShadow: '2px 2px 0 #000',
      pointerEvents: 'none',
    });

    // ────────────────────────────── HTML LAYOUT ────────────────────────────────
    this.content.innerHTML = `
      <!-- ═══ TOP ROW ═══ -->
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <!-- Left: Stats -->
        <div style="display:flex;flex-direction:column;gap:8px;">
          <div data-stat="level" style="white-space:nowrap;"></div>
          <div data-stat="kills" style="white-space:nowrap;"></div>
          <div data-stat="lives" style="white-space:nowrap;"></div>
          <div data-stat="coins" style="white-space:nowrap;"></div>
        </div>
        <!-- Right: Score / Weapon -->
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px;">
          <div data-stat="score" style="white-space:nowrap;color:#fee2b3;"></div>
          <div data-stat="weapon" style="white-space:nowrap;color:#fef08a;"></div>
          <span data-stat="telemetry" style="margin-top:6px;color:#bef264;font-size:12px;"></span>
          <div data-companion style="margin-top:4px;font-size:14px;color:#c084fc;display:none;"></div>
        </div>
      </div>

      <!-- ═══ BOTTOM BAR ═══ -->
      <div style="display:flex;align-items:flex-end;gap:20px;">
        <!-- Hearts -->
        <div data-health style="display:flex;gap:6px;align-items:center;"></div>

        <!-- Dash -->
        <div style="display:flex;align-items:center;gap:8px;">
          <div data-dash style="display:flex;gap:4px;align-items:center;"></div>
          <div style="font-size:11px;color:#7dd3fc;white-space:nowrap;">DASH [SPACE]</div>
        </div>

        <!-- Shield -->
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="width:220px;height:14px;background:rgba(20,10,40,0.8);border:2px solid #4c1d95;border-radius:3px;position:relative;overflow:hidden;">
            <div data-shield-fill style="position:absolute;top:0;bottom:0;left:0;width:100%;background:linear-gradient(90deg,#7c3aed,#c084fc);transition:width 0.12s linear;"></div>
            <div data-shield-glow style="position:absolute;inset:0;box-shadow:inset 0 0 10px #e879f9;opacity:0;transition:opacity 0.25s;"></div>
          </div>
          <div style="font-size:11px;color:#c4b5fd;white-space:nowrap;">SHIELD [SHIFT]</div>
        </div>
      </div>

      <!-- Hint (hidden by default) -->
      <div style="position:absolute;bottom:40px;left:50%;transform:translateX(-50%);display:none;" data-hint-container>
        <div data-hint></div>
      </div>
    `;

    this.stage.appendChild(this.content);
    this.container.appendChild(this.stage);
    parent.appendChild(this.container);

    this.resizeObserver = new ResizeObserver(() => this.updateStage());
    this.resizeObserver.observe(this.canvas);
    this.updateStage();

    // ── Query elements ─────────────────────────────────────────────────────────
    this.levelEl = this.content.querySelector('[data-stat="level"]') as HTMLSpanElement;
    this.killsEl = this.content.querySelector('[data-stat="kills"]') as HTMLSpanElement;
    this.livesEl = this.content.querySelector('[data-stat="lives"]') as HTMLSpanElement;
    this.coinsEl = this.content.querySelector('[data-stat="coins"]') as HTMLSpanElement;
    this.scoreEl = this.content.querySelector('[data-stat="score"]') as HTMLSpanElement;
    this.weaponEl = this.content.querySelector('[data-stat="weapon"]') as HTMLSpanElement;
    this.hintEl = this.content.querySelector('[data-hint-container]') as HTMLDivElement;
    this.dashEl = this.content.querySelector('[data-dash]') as HTMLDivElement;
    this.shieldEl = this.content.querySelector('[data-shield-fill]') as HTMLDivElement;
    this.shieldReadyEl = this.content.querySelector('[data-shield-glow]') as HTMLDivElement;
    this.telemetryEl = this.content.querySelector('[data-stat="telemetry"]') as HTMLSpanElement;
    this.companionEl = this.content.querySelector('[data-companion]') as HTMLDivElement;
    this.healthContainer = this.content.querySelector('[data-health]') as HTMLDivElement;

    // Initial render
    this.setDashCharges(DASH_MAX_CHARGES);
  }

  // ── Public API ──────────────────────────────────────────────────────────────

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
    this.dashEl.innerHTML = '';
    for (let i = 0; i < DASH_MAX_CHARGES; i++) {
      const seg = document.createElement('div');
      Object.assign(seg.style, {
        width: '18px', height: '14px',
        borderRadius: '2px',
      });
      if (i < charges) {
        seg.style.background = '#06b6d4';
        seg.style.boxShadow = '0 0 4px #06b6d4, inset 0 1px 0 rgba(255,255,255,0.3)';
      } else {
        seg.style.background = 'rgba(15,23,42,0.7)';
        seg.style.border = '1px solid #1e293b';
      }
      this.dashEl.appendChild(seg);
    }
  }

  flashDashWarning(): void {
    if (this.dashResetTimer) {
      window.clearTimeout(this.dashResetTimer);
      this.dashResetTimer = null;
    }
    // Flash all segments red briefly
    const segs = this.dashEl.children;
    for (let i = 0; i < segs.length; i++) {
      (segs[i] as HTMLElement).style.background = '#ef4444';
    }
    this.dashEl.animate?.(
      [{ opacity: 1 }, { opacity: 0.3 }, { opacity: 1 }],
      { duration: 260, easing: 'ease-in-out' },
    );
    this.dashResetTimer = window.setTimeout(() => this.setDashCharges(this.lastDashCharges), 280);
  }

  updateHealth(hp: number, maxHp: number): void {
    this.healthContainer.innerHTML = '';
    const maxHearts = Math.ceil(maxHp / 2);

    for (let i = 0; i < maxHearts; i++) {
      const heartVal = (i + 1) * 2;
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', '24');
      svg.setAttribute('height', '24');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.style.filter = 'drop-shadow(2px 2px 0 rgba(0,0,0,0.9))';

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z');

      if (hp >= heartVal) {
        // Full heart
        path.setAttribute('fill', '#ef4444');
        path.setAttribute('stroke', '#991b1b');
        path.setAttribute('stroke-width', '1');
      } else if (hp === heartVal - 1) {
        // Half heart
        const uid = 'hh' + i;
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        const grad = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
        grad.setAttribute('id', uid);
        grad.innerHTML = '<stop offset="50%" stop-color="#ef4444"/><stop offset="50%" stop-color="#1e293b"/>';
        defs.appendChild(grad);
        svg.appendChild(defs);
        path.setAttribute('fill', 'url(#' + uid + ')');
        path.setAttribute('stroke', '#991b1b');
        path.setAttribute('stroke-width', '1');
      } else {
        // Empty heart
        path.setAttribute('fill', '#1e293b');
        path.setAttribute('stroke', '#475569');
        path.setAttribute('stroke-width', '1');
        svg.style.opacity = '0.5';
      }

      svg.appendChild(path);
      this.healthContainer.appendChild(svg);
    }
  }

  updateShield(pct: number, active: boolean): void {
    if (active) {
      this.shieldEl.style.width = '100%';
      this.shieldEl.style.background = 'linear-gradient(90deg,#a855f7,#e879f9)';
      this.shieldReadyEl.style.opacity = '1';
    } else {
      const w = Math.max(0, Math.min(100, pct * 100));
      this.shieldEl.style.width = w + '%';
      this.shieldEl.style.background = pct >= 1
        ? 'linear-gradient(90deg,#7c3aed,#c084fc)'
        : 'linear-gradient(90deg,#4c1d95,#6d28d9)';
      this.shieldReadyEl.style.opacity = pct >= 1 ? '0.8' : '0';
    }
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

  // ── Private ─────────────────────────────────────────────────────────────────

  private updateStage(): void {
    const canvasRect = this.canvas.getBoundingClientRect();
    const parentRect = this.parent.getBoundingClientRect();

    const left = canvasRect.left - parentRect.left;
    const top = canvasRect.top - parentRect.top;

    const baseHeight = 720;
    const aspect = INTERNAL_WIDTH / INTERNAL_HEIGHT;
    const baseWidth = baseHeight * aspect;

    this.stage.style.width = baseWidth + 'px';
    this.stage.style.height = baseHeight + 'px';

    const scaleX = canvasRect.width / baseWidth;
    const scaleY = canvasRect.height / baseHeight;

    this.stage.style.left = left + 'px';
    this.stage.style.top = top + 'px';
    this.stage.style.transform = 'scale(' + scaleX + ',' + scaleY + ')';
    this.stage.style.transformOrigin = 'top left';
  }
}
