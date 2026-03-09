// -----------------------------------------------------------------------------
// SoloSelectOverlay.ts — Dungeon-style hero selector (carousel)
// -----------------------------------------------------------------------------

import { DungeonBackdrop } from './DungeonBackdrop';

export interface SoloHeroStats {
  health: number;
  speed: number;
  power: number;
  attackSpeed: number;
}

export interface SoloHeroOption {
  label: string;
  role: string;
  shortDescription: string;
  longDescription: string;
  accentHex: string;
  image?: string | null;
  stats: SoloHeroStats;
  special: string;
  difficulty: string;
}

export interface SoloSelectOverlayOptions {
  heroes: SoloHeroOption[];
  onSelect?: (index: number) => void;
  onConfirm: () => void;
  onBack: () => void;
}

type StatKey = keyof SoloHeroStats;

const STAT_ICONS: Record<StatKey, { filled: string; label: string }> = {
  health: { filled: '♥', label: 'HP' },
  speed: { filled: '⚡', label: 'SPD' },
  power: { filled: '⚔', label: 'PWR' },
  attackSpeed: { filled: '✦', label: 'ATK' },
};

const DIFFICULTY_SKULLS: Record<string, number> = {
  Forgiving: 1,
  Steady: 2,
  Advanced: 3,
  Expert: 4,
};

const buildSkullDisplay = (difficulty: string): string => {
  return '💀'.repeat(DIFFICULTY_SKULLS[difficulty] ?? 2);
};

const buildStatIcons = (key: StatKey, value: number): string => {
  const { filled } = STAT_ICONS[key];
  const count = Math.round(value * 5);
  return filled.repeat(count);
};

const ensureStyles = (): void => {
  const existing = document.getElementById('eerie-dungeon-ui');
  if (existing) existing.remove();

  const style = document.createElement('style');
  style.id = 'eerie-dungeon-ui';
  style.textContent = `
    .solo-ui {
      position: absolute;
      inset: 0;
      font-family: 'Press Start 2P', monospace;
      color: #c8c0e8;
      background: #03010a;
      pointer-events: none;
      overflow: hidden;
    }

    /* Strong vignette – like torchlight barely reaching the center */
    .solo-ui .solo-screen {
      position: relative;
      z-index: 5;
      box-shadow: inset 0 0 220px #000, inset 0 0 80px rgba(40,20,80,0.15);
      animation: torch-dim 12s infinite alternate;
    }

    @keyframes torch-dim {
      0%,100% { box-shadow: inset 0 0 220px #000, inset 0 0 80px rgba(40,20,80,0.15); }
      50%     { box-shadow: inset 0 0 260px #000, inset 0 0 100px rgba(60,20,100,0.2); }
    }

    .solo-screen {
      width: 100%;
      max-width: 700px;
      margin: 0 auto;
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      pointer-events: auto;
      min-height: 100vh;
      box-sizing: border-box;
      justify-content: center;
    }

    .solo-header {
      text-align: center;
      margin-bottom: -6px;
    }

    .solo-header-title {
      font-size: 24px;
      letter-spacing: 5px;
      color: #e0d8ff;
      text-shadow: 0 0 14px rgba(80,40,140,0.7), 0 0 28px rgba(120,20,80,0.4), 3px 3px 0 #03010a;
    }

    .solo-header-sub {
      font-size: 11px;
      letter-spacing: 3px;
      color: #a080b0;
      text-shadow: 2px 2px 0 rgba(0,0,0,0.9);
      margin-top: 15px;
    }

    /* Thumbnails – small, corrupted icons */
    .solo-thumbs {
      display: flex;
      justify-content: center;
      gap: 14px;
      margin-top: 40px;
      margin-bottom: 0;
    }

    .solo-thumb {
      width: 80px;
      height: 80px;
      border-radius: 10px;
      border: 3px solid #2a1a4c;
      background: linear-gradient(180deg, #1a1428 0%, #0e0a14 100%);
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      padding: 0;
      box-shadow: 0 4px 12px rgba(0,0,0,0.7);
    }

    .solo-thumb img {
      width: 85%;
      height: 85%;
      image-rendering: pixelated;
      object-fit: contain;
    }

    .solo-thumb:hover {
      border-color: #4a3a7c;
      transform: scale(1.08);
    }

    .solo-thumb.active {
      border-color: var(--thumb-accent, #a080c0);
      box-shadow: 0 0 16px var(--thumb-accent, rgba(160,128,192,0.4)), 0 6px 16px rgba(0,0,0,0.8);
      transform: scale(1.12);
    }

    /* Carousel & main card – darker, heavier */
    .solo-carousel {
      display: flex;
      align-items: center;
      gap: 16px;
      flex: 1;
      margin-top: -20px;
    }

    .solo-arrow {
      width: 56px;
      height: 100px;
      background: linear-gradient(180deg, #1a1428 0%, #0e0a14 100%);
      border: 3px solid #3a2a5c;
      border-radius: 10px;
      color: #a080c0;
      font-size: 28px;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      box-shadow: 0 4px 16px rgba(0,0,0,0.7);
    }

    .solo-arrow:hover {
      background: linear-gradient(180deg, #2a2040 0%, #1a1428 100%);
      border-color: #5a4a9e;
      color: #d0c8ff;
      box-shadow: 0 0 16px rgba(80,40,140,0.4);
    }

    .solo-arrow:active {
      transform: scale(0.95);
    }

    .solo-card {
      flex: 1;
      background: linear-gradient(135deg, #1a1428 0%, #12101c 50%, #0a0814 100%);
      border: 3px solid var(--card-accent, #3a2a5c);
      border-radius: 14px;
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      box-shadow: 0 10px 32px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.03);
      overflow: hidden;
      transition: all 0.3s ease;
    }

    .solo-card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 12px;
      border-bottom: 2px solid rgba(255,255,255,0.07);
    }

    .solo-card-name {
      font-size: 15px;
      letter-spacing: 2.8px;
      text-shadow: 2px 2px 0 rgba(0,0,0,0.9);
    }

    .solo-card-role-badge {
      font-size: 10px;
      padding: 4px 10px;
      border-radius: 5px;
      border: 2px solid var(--card-accent);
      background: rgba(0,0,0,0.7);
      color: var(--card-accent);
    }

    .solo-card-body {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
    }

    .solo-card-left {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .solo-card-right {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .solo-card-art {
      aspect-ratio: 1;
      background: linear-gradient(180deg, #0a0615 0%, #040410 100%);
      border-radius: 8px;
      border: 2px solid rgba(255,255,255,0.1);
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      box-shadow: inset 0 0 20px rgba(0,0,0,0.8);
    }

    .solo-card-art img {
      width: 85%;
      height: 85%;
      image-rendering: pixelated;
      object-fit: contain;
      filter: drop-shadow(0 4px 8px rgba(0,0,0,0.9));
    }

    .solo-card-peril {
      text-align: center;
      font-size: 18px;
      text-shadow: 0 0 8px black;
      padding: 6px;
      background: rgba(0,0,0,0.5);
      border-radius: 5px;
    }

    .solo-card-stats {
      background: rgba(0,0,0,0.5);
      border-radius: 6px;
      padding: 10px;
      border: 1px solid rgba(255,255,255,0.06);
    }

    .solo-card-stat {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 11px;
      line-height: 1.6;
    }

    .solo-card-stat-label {
      width: 32px;
      color: #a0a0a0;
      letter-spacing: 1px;
    }

    .solo-card-stat-icons {
      flex: 1;
      letter-spacing: 4px;
      color: var(--card-accent);
      font-size: 15px;
      text-shadow: 0 0 6px currentColor;
    }

    .solo-card-special {
      font-size: 10px;
      color: #ffeb99;
      text-transform: none;
      line-height: 1.6;
      letter-spacing: 0.4px;
      padding: 8px 10px;
      background: rgba(255,220,100,0.06);
      border-radius: 5px;
      border-left: 4px solid #ffeb99;
    }

    .solo-card-desc {
      font-size: 10px;
      color: #b8b0d8;
      text-transform: none;
      line-height: 1.6;
      letter-spacing: 0.4px;
    }

    /* Controls */
    .solo-controls {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-top: -20px;
    }

    .solo-instructions {
      text-align: center;
      font-size: 9px;
      letter-spacing: 2px;
      color: #706890;
    }

    .solo-buttons {
      display: flex;
      justify-content: center;
      gap: 10px;
    }

    .solo-btn {
      font-family: 'Press Start 2P', monospace;
      font-size: 10px;
      padding: 12px 24px;
      background: linear-gradient(180deg, #2a1f50 0%, #1a1438 50%, #0f0b24 100%);
      border: 2px solid #4a3a8e;
      border-radius: 6px;
      color: #d0c8f0;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .solo-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(80,60,140,0.5);
    }

    .solo-btn.primary {
      background: linear-gradient(180deg, #6a2030 0%, #4a1520 50%, #2a0a10 100%);
      border-color: #c03040;
      color: #ff6070;
      box-shadow: 0 0 16px rgba(180,40,60,0.5);
    }

    .solo-btn.primary:hover {
      transform: scale(1.05);
      box-shadow: 0 0 28px rgba(200,50,70,0.7), 0 0 50px rgba(140,20,40,0.4);
    }
  `;
  document.head.appendChild(style);
};

export class SoloSelectOverlay {
  private root: HTMLDivElement;
  private thumbs: HTMLButtonElement[] = [];
  private cardEl!: HTMLDivElement;
  private options: SoloHeroOption[];
  private instructionsEl!: HTMLDivElement;
  private confirmBtn!: HTMLButtonElement;
  private selectedIndex: number = 0;
  private onConfirm: () => void;
  private onSelectCb?: (index: number) => void;
  private ambientAudio: HTMLAudioElement;
  private backdrop?: DungeonBackdrop;

  constructor(parent: HTMLElement, options: SoloSelectOverlayOptions) {
    ensureStyles();
    this.options = options.heroes;
    this.onConfirm = options.onConfirm;
    this.onSelectCb = options.onSelect;

    this.root = document.createElement('div');
    this.root.className = 'solo-ui';
    this.root.dataset.soloOverlay = 'true';
    this.backdrop = new DungeonBackdrop(this.root);

    // Dungeon ambient audio
    this.ambientAudio = new Audio('/audio/ambient/dungeon_ambient.mp3');
    this.ambientAudio.loop = true;
    this.ambientAudio.volume = 0.2;
    this.ambientAudio.play().catch(() => {}); // autoplay may be blocked

    const screen = document.createElement('div');
    screen.className = 'solo-screen';
    this.root.appendChild(screen);

    // Header
    const header = document.createElement('div');
    header.className = 'solo-header';
    header.innerHTML = `
      <div class="solo-header-title">CHOOSE YOUR HERO</div>
      <div class="solo-header-sub">PREPARE FOR THE DESCENT</div>
    `;
    screen.appendChild(header);

    // Thumbnail row - 4 character boxes at top
    const thumbRow = document.createElement('div');
    thumbRow.className = 'solo-thumbs';
    screen.appendChild(thumbRow);

    options.heroes.forEach((hero, idx) => {
      const thumb = document.createElement('button');
      thumb.type = 'button';
      thumb.className = 'solo-thumb';
      thumb.style.setProperty('--thumb-accent', hero.accentHex);
      if (hero.image) {
        thumb.innerHTML = `<img src="${hero.image}" alt="${hero.label}" />`;
      }
      thumb.addEventListener('click', () => this.selectHero(idx));
      thumbRow.appendChild(thumb);
      this.thumbs.push(thumb);
    });

    // Carousel with arrows and big card
    const carousel = document.createElement('div');
    carousel.className = 'solo-carousel';
    screen.appendChild(carousel);

    // Left arrow
    const leftArrow = document.createElement('button');
    leftArrow.type = 'button';
    leftArrow.className = 'solo-arrow';
    leftArrow.innerHTML = '◄';
    leftArrow.addEventListener('click', () => this.navigate(-1));
    carousel.appendChild(leftArrow);

    // Main big card
    this.cardEl = document.createElement('div');
    this.cardEl.className = 'solo-card';
    carousel.appendChild(this.cardEl);

    // Right arrow
    const rightArrow = document.createElement('button');
    rightArrow.type = 'button';
    rightArrow.className = 'solo-arrow';
    rightArrow.innerHTML = '►';
    rightArrow.addEventListener('click', () => this.navigate(1));
    carousel.appendChild(rightArrow);

    // Controls
    const controls = document.createElement('div');
    controls.className = 'solo-controls';
    screen.appendChild(controls);

    this.instructionsEl = document.createElement('div');
    this.instructionsEl.className = 'solo-instructions';
    controls.appendChild(this.instructionsEl);

    const buttons = document.createElement('div');
    buttons.className = 'solo-buttons';
    controls.appendChild(buttons);

    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'solo-btn';
    backBtn.textContent = '◄ RETREAT';
    backBtn.addEventListener('click', options.onBack);
    buttons.appendChild(backBtn);

    this.confirmBtn = document.createElement('button');
    this.confirmBtn.type = 'button';
    this.confirmBtn.className = 'solo-btn primary';
    this.confirmBtn.textContent = 'DESCEND ▼';
    this.confirmBtn.addEventListener('click', this.onConfirm);
    buttons.appendChild(this.confirmBtn);

    parent.appendChild(this.root);

    // Initial render
    this.selectHero(0);
  }

  private navigate(dir: number): void {
    const newIndex = (this.selectedIndex + dir + this.options.length) % this.options.length;
    this.selectHero(newIndex);
  }

  private selectHero(index: number): void {
    this.selectedIndex = index;
    const hero = this.options[index];

    // Update thumbs
    this.thumbs.forEach((thumb, i) => {
      thumb.classList.toggle('active', i === index);
    });

    // Update card
    this.cardEl.style.setProperty('--card-accent', hero.accentHex);
    this.cardEl.innerHTML = `
      <div class="solo-card-header">
        <span class="solo-card-name">${hero.label}</span>
        <span class="solo-card-role-badge">${hero.role}</span>
      </div>
      <div class="solo-card-body">
        <div class="solo-card-left">
          <div class="solo-card-stats">
            ${this.renderStat('health', hero.stats.health)}
            ${this.renderStat('power', hero.stats.power)}
            ${this.renderStat('speed', hero.stats.speed)}
            ${this.renderStat('attackSpeed', hero.stats.attackSpeed)}
          </div>
          <div class="solo-card-special">${hero.special}</div>
          <div class="solo-card-desc">${hero.shortDescription}</div>
        </div>
        <div class="solo-card-right">
          <div class="solo-card-art">
            ${hero.image ? `<img src="${hero.image}" alt="${hero.label}" />` : ''}
          </div>
          <div class="solo-card-peril">${buildSkullDisplay(hero.difficulty)}</div>
        </div>
      </div>
    `;

    // Update confirm button text only (keep red styling)
    this.confirmBtn.textContent = `DESCEND AS ${hero.label} ▼`;

    // Update instructions
    this.instructionsEl.textContent = '◄ ► BROWSE HEROES · ENTER TO DESCEND';

    // Callback
    this.onSelectCb?.(index);
  }

  private renderStat(key: StatKey, value: number): string {
    return `
      <div class="solo-card-stat">
        <span class="solo-card-stat-label">${STAT_ICONS[key].label}</span>
        <span class="solo-card-stat-icons">${buildStatIcons(key, value)}</span>
      </div>
    `;
  }

  public render(index: number): void {
    this.selectHero(index);
  }

  public destroy(): void {
    this.ambientAudio.pause();
    this.ambientAudio.src = '';
    this.backdrop?.destroy();
    this.root.remove();
  }
}
