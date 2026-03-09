// -----------------------------------------------------------------------------
// CoopSelectOverlay.ts — Dungeon-style dual-card coop selector
// -----------------------------------------------------------------------------

import type { CompanionGuide } from '../config/companionGuides';
import { DungeonBackdrop } from './DungeonBackdrop';

export type CoopSection = 'hero' | 'companion' | 'personality';

export interface CoopHeroOption {
  label: string;
  role: string;
  shortDescription: string;
  accentHex: string;
  image?: string | null;
  stats: {
    health: number;
    speed: number;
    power: number;
    attackSpeed: number;
  };
  difficulty: string;
}

export interface CoopCompanionOption {
  label: string;
  image?: string | null;
}

export interface PersonalityOption {
  key: string;
  label: string;
  color: string;
  icon: string;
  desc: string;
}

export interface CoopSelectOverlayOptions {
  heroes: CoopHeroOption[];
  companions: CoopCompanionOption[];
  companionDetails: CompanionGuide[];
  personalities: PersonalityOption[];
  onSelect: (section: CoopSection, index: number) => void;
  onBack: () => void;
  onConfirm: () => void;
}

export interface CoopSelectOverlayState {
  heroIndex: number;
  companionIndex: number;
  personalityIndex: number;
  focused: CoopSection;
  description: string;
  companionDetail: CompanionGuide;
}

type StatKey = 'health' | 'speed' | 'power' | 'attackSpeed';

const STAT_ICONS: Record<StatKey, { filled: string; label: string }> = {
  health: { filled: '♥', label: 'HP' },
  speed: { filled: '⚡', label: 'SPD' },
  power: { filled: '⚔', label: 'PWR' },
  attackSpeed: { filled: '✦', label: 'ATK' },
};

const COMPANION_STAT_ICONS: Record<string, { filled: string; label: string }> = {
  offense: { filled: '⚔', label: 'OFF' },
  defense: { filled: '🛡', label: 'DEF' },
  support: { filled: '✚', label: 'SUP' },
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

const buildStatIcons = (value: number, filled: string): string => {
  const count = Math.round(value * 5);
  return filled.repeat(count);
};

const buildCompanionStatIcons = (value: number, filled: string): string => {
  const count = Math.round((value / 10) * 5);
  return filled.repeat(count);
};

const ensureStyles = (): void => {
  const existing = document.getElementById('coop-dungeon-ui');
  if (existing) existing.remove();

  const style = document.createElement('style');
  style.id = 'coop-dungeon-ui';
  style.textContent = `
    .coop-ui {
      position: absolute;
      inset: 0;
      font-family: 'Press Start 2P', monospace;
      color: #c8c0e8;
      background: #03010a;
      pointer-events: none;
      overflow: hidden;
    }

    .coop-ui .coop-screen {
      position: relative;
      z-index: 5;
      box-shadow: inset 0 0 220px #000, inset 0 0 80px rgba(40,20,80,0.15);
      animation: coop-torch-dim 12s infinite alternate;
    }

    @keyframes coop-torch-dim {
      0%,100% { box-shadow: inset 0 0 220px #000, inset 0 0 80px rgba(40,20,80,0.15); }
      50%     { box-shadow: inset 0 0 260px #000, inset 0 0 100px rgba(60,20,100,0.2); }
    }

    .coop-screen {
      width: 100%;
      max-width: 900px;
      margin: 0 auto;
      padding: 20px 24px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      pointer-events: auto;
      min-height: 100vh;
      box-sizing: border-box;
      justify-content: center;
    }

    .coop-header {
      text-align: center;
      margin-bottom: 8px;
    }

    .coop-header-title {
      font-size: 32px;
      letter-spacing: 6px;
      color: #e0d8ff;
      text-shadow: 0 0 20px rgba(80,40,140,0.8), 0 0 40px rgba(120,20,80,0.5), 4px 4px 0 #03010a;
    }

    /* Center box between thumbnails */
    .coop-mistral-box {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 12px 20px;
      background: linear-gradient(180deg, #0a0612 0%, #050308 100%);
      border: 2px solid #2a1a4c;
      border-radius: 8px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.8), inset 0 0 20px rgba(0,0,0,0.5);
    }

    .coop-mistral-box span {
      font-size: 9px;
      letter-spacing: 2px;
      color: #fde68a;
      text-shadow: 0 0 8px rgba(253,230,138,0.4), 2px 2px 0 rgba(0,0,0,0.9);
      text-align: center;
      line-height: 1.4;
    }

    /* Thumbnail rows */
    .coop-thumb-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
    }

    .coop-thumb-label {
      font-size: 9px;
      letter-spacing: 3px;
      color: #a080b0;
      text-shadow: 2px 2px 0 rgba(0,0,0,0.9);
    }

    .coop-thumb-label.focused {
      color: #ffdd00;
      text-shadow: 0 0 8px rgba(255,221,0,0.5);
    }

    .coop-thumbs {
      display: flex;
      justify-content: center;
      gap: 12px;
    }

    .coop-thumb {
      width: 60px;
      height: 60px;
      border-radius: 8px;
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

    .coop-thumb img {
      width: 85%;
      height: 85%;
      image-rendering: pixelated;
      object-fit: contain;
    }

    .coop-thumb:hover {
      border-color: #4a3a7c;
      transform: scale(1.08);
    }

    .coop-thumb.active {
      border-color: var(--thumb-accent, #a080c0);
      box-shadow: 0 0 16px var(--thumb-accent, rgba(160,128,192,0.4)), 0 6px 16px rgba(0,0,0,0.8);
      transform: scale(1.12);
    }

    /* Dual cards container */
    .coop-cards {
      display: flex;
      gap: 20px;
      flex: 1;
      max-height: 320px;
    }

    .coop-card {
      flex: 1;
      background: linear-gradient(135deg, #1a1428 0%, #12101c 50%, #0a0814 100%);
      border: 3px solid var(--card-accent, #3a2a5c);
      border-radius: 12px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      box-shadow: 0 10px 32px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.03);
      overflow: hidden;
      transition: all 0.3s ease;
    }

    .coop-card.focused {
      border-width: 4px;
      box-shadow: 0 0 20px var(--card-accent, rgba(160,128,192,0.4)), 0 10px 32px rgba(0,0,0,0.9);
    }

    .coop-card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 10px;
      border-bottom: 2px solid rgba(255,255,255,0.07);
    }

    .coop-card-type {
      font-size: 8px;
      letter-spacing: 2px;
      color: #706890;
    }

    .coop-card-name {
      font-size: 13px;
      letter-spacing: 2px;
      text-shadow: 2px 2px 0 rgba(0,0,0,0.9);
    }

    .coop-card-role-badge {
      font-size: 8px;
      padding: 3px 8px;
      border-radius: 4px;
      border: 2px solid var(--card-accent);
      background: rgba(0,0,0,0.7);
      color: var(--card-accent);
    }

    .coop-card-body {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      flex: 1;
    }

    .coop-card-left {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .coop-card-right {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .coop-card-art {
      aspect-ratio: 1;
      background: linear-gradient(180deg, #0a0615 0%, #040410 100%);
      border-radius: 6px;
      border: 2px solid rgba(255,255,255,0.1);
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      box-shadow: inset 0 0 20px rgba(0,0,0,0.8);
      max-height: 100px;
    }

    .coop-card-art img {
      width: 80%;
      height: 80%;
      image-rendering: pixelated;
      object-fit: contain;
      filter: drop-shadow(0 4px 8px rgba(0,0,0,0.9));
    }

    .coop-card-peril {
      text-align: center;
      font-size: 14px;
      text-shadow: 0 0 8px black;
      padding: 4px;
      background: rgba(0,0,0,0.5);
      border-radius: 4px;
    }

    .coop-card-stats {
      background: rgba(0,0,0,0.5);
      border-radius: 5px;
      padding: 8px;
      border: 1px solid rgba(255,255,255,0.06);
    }

    .coop-card-stat {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 9px;
      line-height: 1.5;
    }

    .coop-card-stat-label {
      width: 28px;
      color: #a0a0a0;
      letter-spacing: 1px;
    }

    .coop-card-stat-icons {
      flex: 1;
      letter-spacing: 3px;
      color: var(--card-accent);
      font-size: 12px;
      text-shadow: 0 0 6px currentColor;
    }

    .coop-card-desc {
      font-size: 8px;
      color: #b8b0d8;
      text-transform: none;
      line-height: 1.5;
      letter-spacing: 0.3px;
    }

    .coop-card-ability {
      font-size: 8px;
      color: #ffeb99;
      text-transform: none;
      line-height: 1.5;
      letter-spacing: 0.3px;
      padding: 6px 8px;
      background: rgba(255,220,100,0.06);
      border-radius: 4px;
      border-left: 3px solid #ffeb99;
    }

    .coop-card-ability strong {
      display: block;
      margin-bottom: 4px;
      letter-spacing: 1px;
    }

    /* Personality section - boxed panel */
    .coop-personality-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 16px 24px;
      margin-top: 8px;
      background: linear-gradient(135deg, #1a1428 0%, #12101c 50%, #0a0814 100%);
      border: 3px solid #3a2a5c;
      border-radius: 12px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.03);
      transition: all 0.3s ease;
    }

    .coop-personality-section.focused {
      border-color: #ffdd00;
      box-shadow: 0 0 20px rgba(255,221,0,0.3), 0 8px 24px rgba(0,0,0,0.8);
    }

    .coop-personality-label {
      font-size: 10px;
      letter-spacing: 3px;
      color: #a080b0;
      text-shadow: 2px 2px 0 rgba(0,0,0,0.9);
    }

    .coop-personality-label.focused {
      color: #ffdd00;
      text-shadow: 0 0 8px rgba(255,221,0,0.5), 2px 2px 0 rgba(0,0,0,0.9);
    }

    .coop-personality-row {
      display: flex;
      justify-content: center;
      gap: 16px;
    }

    .coop-personality-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      padding: 12px 20px;
      background: linear-gradient(180deg, #0f0a1a 0%, #080510 100%);
      border: 2px solid #2a1a4c;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
      opacity: 0.5;
      min-width: 90px;
    }

    .coop-personality-btn .icon {
      font-size: 22px;
    }

    .coop-personality-btn .label {
      font-size: 8px;
      letter-spacing: 1px;
      font-family: 'Press Start 2P', monospace;
    }

    .coop-personality-btn:hover {
      opacity: 0.8;
      transform: scale(1.05);
      background: linear-gradient(180deg, #1a1428 0%, #0e0a14 100%);
    }

    .coop-personality-btn.active {
      opacity: 1;
      border-color: var(--pers-color, #a080c0);
      box-shadow: 0 0 16px var(--pers-color, rgba(160,128,192,0.5)), inset 0 0 20px rgba(0,0,0,0.3);
      background: linear-gradient(180deg, #1a1428 0%, #0e0a14 100%);
    }

    .coop-personality-desc {
      font-size: 9px;
      color: #e0d8ff;
      text-align: center;
      letter-spacing: 1px;
      padding: 8px 16px;
      background: rgba(0,0,0,0.4);
      border-radius: 6px;
      border: 1px solid rgba(255,255,255,0.08);
      min-height: 18px;
    }

    /* Controls */
    .coop-controls {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding-top: 8px;
    }

    .coop-instructions {
      text-align: center;
      font-size: 8px;
      letter-spacing: 2px;
      color: #706890;
    }

    .coop-buttons {
      display: flex;
      justify-content: center;
      gap: 12px;
    }

    .coop-btn {
      font-family: 'Press Start 2P', monospace;
      font-size: 9px;
      padding: 10px 20px;
      background: linear-gradient(180deg, #2a1f50 0%, #1a1438 50%, #0f0b24 100%);
      border: 2px solid #4a3a8e;
      border-radius: 6px;
      color: #d0c8f0;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .coop-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(80,60,140,0.5);
    }

    .coop-btn.primary {
      background: linear-gradient(180deg, #6a2030 0%, #4a1520 50%, #2a0a10 100%);
      border-color: #c03040;
      color: #ff6070;
      box-shadow: 0 0 16px rgba(180,40,60,0.5);
    }

    .coop-btn.primary:hover {
      transform: scale(1.05);
      box-shadow: 0 0 28px rgba(200,50,70,0.7), 0 0 50px rgba(140,20,40,0.4);
    }
  `;
  document.head.appendChild(style);
};

export class CoopSelectOverlay {
  private root: HTMLDivElement;
  private heroThumbs: HTMLButtonElement[] = [];
  private companionThumbs: HTMLButtonElement[] = [];
  private heroCard!: HTMLDivElement;
  private companionCard!: HTMLDivElement;
  private personalityBtns: HTMLButtonElement[] = [];
  private personalityDescEl!: HTMLDivElement;
  private instructionsEl!: HTMLDivElement;
  private confirmBtn!: HTMLButtonElement;
  private heroThumbLabel!: HTMLDivElement;
  private companionThumbLabel!: HTMLDivElement;
  private personalityLabel!: HTMLDivElement;
  private personalitySectionEl!: HTMLDivElement;

  private options: CoopSelectOverlayOptions;
  private ambientAudio: HTMLAudioElement;
  private backdrop?: DungeonBackdrop;

  constructor(parent: HTMLElement, options: CoopSelectOverlayOptions) {
    parent.querySelectorAll<HTMLDivElement>('[data-coop-overlay="true"]').forEach((node) => node.remove());
    ensureStyles();

    this.options = options;

    this.root = document.createElement('div');
    this.root.className = 'coop-ui';
    this.root.dataset.coopOverlay = 'true';
    this.backdrop = new DungeonBackdrop(this.root);

    // Dungeon ambient audio
    this.ambientAudio = new Audio('/audio/ambient/dungeon_ambient.mp3');
    this.ambientAudio.loop = true;
    this.ambientAudio.volume = 0.2;
    this.ambientAudio.play().catch(() => {});

    const screen = document.createElement('div');
    screen.className = 'coop-screen';
    this.root.appendChild(screen);

    // Header
    const header = document.createElement('div');
    header.className = 'coop-header';
    header.innerHTML = `<div class="coop-header-title">AI CO-OP MODE</div>`;
    screen.appendChild(header);

    // Thumbnail sections container - spread with Mistral box in center
    const thumbContainer = document.createElement('div');
    thumbContainer.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin: 8px 0; padding: 0 20px;';
    screen.appendChild(thumbContainer);

    // Hero thumbnails
    const heroThumbSection = document.createElement('div');
    heroThumbSection.className = 'coop-thumb-section';
    this.heroThumbLabel = document.createElement('div');
    this.heroThumbLabel.className = 'coop-thumb-label';
    this.heroThumbLabel.textContent = 'YOUR HERO';
    heroThumbSection.appendChild(this.heroThumbLabel);

    const heroThumbRow = document.createElement('div');
    heroThumbRow.className = 'coop-thumbs';
    options.heroes.forEach((hero, idx) => {
      const thumb = document.createElement('button');
      thumb.type = 'button';
      thumb.className = 'coop-thumb';
      thumb.style.setProperty('--thumb-accent', hero.accentHex);
      if (hero.image) {
        thumb.innerHTML = `<img src="${hero.image}" alt="${hero.label}" />`;
      }
      thumb.addEventListener('click', () => options.onSelect('hero', idx));
      heroThumbRow.appendChild(thumb);
      this.heroThumbs.push(thumb);
    });
    heroThumbSection.appendChild(heroThumbRow);
    thumbContainer.appendChild(heroThumbSection);

    // Center Mistral box
    const mistralBox = document.createElement('div');
    mistralBox.className = 'coop-mistral-box';
    mistralBox.innerHTML = '<span>AI COMPANION<br/>POWERED BY MISTRAL</span>';
    thumbContainer.appendChild(mistralBox);

    // Companion thumbnails
    const companionThumbSection = document.createElement('div');
    companionThumbSection.className = 'coop-thumb-section';
    this.companionThumbLabel = document.createElement('div');
    this.companionThumbLabel.className = 'coop-thumb-label';
    this.companionThumbLabel.textContent = 'AI COMPANION';
    companionThumbSection.appendChild(this.companionThumbLabel);

    const companionThumbRow = document.createElement('div');
    companionThumbRow.className = 'coop-thumbs';
    options.companions.forEach((companion, idx) => {
      const thumb = document.createElement('button');
      thumb.type = 'button';
      thumb.className = 'coop-thumb';
      const detail = options.companionDetails[idx];
      thumb.style.setProperty('--thumb-accent', detail?.color ?? '#a855f7');
      if (companion.image) {
        thumb.innerHTML = `<img src="${companion.image}" alt="${companion.label}" />`;
      }
      thumb.addEventListener('click', () => options.onSelect('companion', idx));
      companionThumbRow.appendChild(thumb);
      this.companionThumbs.push(thumb);
    });
    companionThumbSection.appendChild(companionThumbRow);
    thumbContainer.appendChild(companionThumbSection);

    // Dual cards
    const cardsContainer = document.createElement('div');
    cardsContainer.className = 'coop-cards';
    screen.appendChild(cardsContainer);

    this.heroCard = document.createElement('div');
    this.heroCard.className = 'coop-card';
    cardsContainer.appendChild(this.heroCard);

    this.companionCard = document.createElement('div');
    this.companionCard.className = 'coop-card';
    cardsContainer.appendChild(this.companionCard);

    // Personality section
    this.personalitySectionEl = document.createElement('div');
    this.personalitySectionEl.className = 'coop-personality-section';
    screen.appendChild(this.personalitySectionEl);

    this.personalityLabel = document.createElement('div');
    this.personalityLabel.className = 'coop-personality-label';
    this.personalityLabel.textContent = 'COMPANION PERSONALITY';
    this.personalitySectionEl.appendChild(this.personalityLabel);

    const personalityRow = document.createElement('div');
    personalityRow.className = 'coop-personality-row';
    options.personalities.forEach((pers, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'coop-personality-btn';
      btn.style.setProperty('--pers-color', pers.color);
      btn.innerHTML = `
        <span class="icon">${pers.icon}</span>
        <span class="label" style="color: ${pers.color}">${pers.label}</span>
      `;
      btn.addEventListener('click', () => options.onSelect('personality', idx));
      personalityRow.appendChild(btn);
      this.personalityBtns.push(btn);
    });
    this.personalitySectionEl.appendChild(personalityRow);

    this.personalityDescEl = document.createElement('div');
    this.personalityDescEl.className = 'coop-personality-desc';
    this.personalitySectionEl.appendChild(this.personalityDescEl);

    // Controls
    const controls = document.createElement('div');
    controls.className = 'coop-controls';
    screen.appendChild(controls);

    this.instructionsEl = document.createElement('div');
    this.instructionsEl.className = 'coop-instructions';
    controls.appendChild(this.instructionsEl);

    const buttons = document.createElement('div');
    buttons.className = 'coop-buttons';
    controls.appendChild(buttons);

    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'coop-btn';
    backBtn.textContent = '◄ RETREAT';
    backBtn.addEventListener('click', options.onBack);
    buttons.appendChild(backBtn);

    this.confirmBtn = document.createElement('button');
    this.confirmBtn.type = 'button';
    this.confirmBtn.className = 'coop-btn primary';
    this.confirmBtn.textContent = 'DESCEND ▼';
    this.confirmBtn.addEventListener('click', options.onConfirm);
    buttons.appendChild(this.confirmBtn);

    parent.appendChild(this.root);
  }

  render(state: CoopSelectOverlayState): void {
    const hero = this.options.heroes[state.heroIndex];
    const companion = this.options.companions[state.companionIndex];
    const companionDetail = state.companionDetail;
    const personality = this.options.personalities[state.personalityIndex];

    // Update hero thumbs
    this.heroThumbs.forEach((thumb, i) => {
      thumb.classList.toggle('active', i === state.heroIndex);
    });

    // Update companion thumbs
    this.companionThumbs.forEach((thumb, i) => {
      thumb.classList.toggle('active', i === state.companionIndex);
    });

    // Update personality buttons
    this.personalityBtns.forEach((btn, i) => {
      btn.classList.toggle('active', i === state.personalityIndex);
    });

    // Update section labels for focus
    this.heroThumbLabel.classList.toggle('focused', state.focused === 'hero');
    this.companionThumbLabel.classList.toggle('focused', state.focused === 'companion');
    this.personalityLabel.classList.toggle('focused', state.focused === 'personality');
    this.personalitySectionEl.classList.toggle('focused', state.focused === 'personality');

    // Update hero card
    this.heroCard.style.setProperty('--card-accent', hero.accentHex);
    this.heroCard.classList.toggle('focused', state.focused === 'hero');
    this.heroCard.innerHTML = `
      <div class="coop-card-header">
        <div>
          <div class="coop-card-type">YOUR HERO</div>
          <span class="coop-card-name">${hero.label}</span>
        </div>
        <span class="coop-card-role-badge">${hero.role}</span>
      </div>
      <div class="coop-card-body">
        <div class="coop-card-left">
          <div class="coop-card-stats">
            ${this.renderHeroStat('health', hero.stats.health)}
            ${this.renderHeroStat('power', hero.stats.power)}
            ${this.renderHeroStat('speed', hero.stats.speed)}
            ${this.renderHeroStat('attackSpeed', hero.stats.attackSpeed)}
          </div>
          <div class="coop-card-desc">${hero.shortDescription}</div>
        </div>
        <div class="coop-card-right">
          <div class="coop-card-art">
            ${hero.image ? `<img src="${hero.image}" alt="${hero.label}" />` : ''}
          </div>
          <div class="coop-card-peril">${buildSkullDisplay(hero.difficulty)}</div>
        </div>
      </div>
    `;

    // Update companion card
    this.companionCard.style.setProperty('--card-accent', companionDetail.color);
    this.companionCard.classList.toggle('focused', state.focused === 'companion');
    this.companionCard.innerHTML = `
      <div class="coop-card-header">
        <div>
          <div class="coop-card-type">AI COMPANION</div>
          <span class="coop-card-name">${companionDetail.label}</span>
        </div>
        <span class="coop-card-role-badge">${companionDetail.role}</span>
      </div>
      <div class="coop-card-body">
        <div class="coop-card-left">
          <div class="coop-card-stats">
            ${this.renderCompanionStat('offense', companionDetail.stats.offense, companionDetail.color)}
            ${this.renderCompanionStat('defense', companionDetail.stats.defense, companionDetail.color)}
            ${this.renderCompanionStat('support', companionDetail.stats.support, companionDetail.color)}
          </div>
          <div class="coop-card-ability">
            <strong style="color: ${companionDetail.color}">${companionDetail.abilityName}</strong>
            ${companionDetail.abilityDescription}
          </div>
        </div>
        <div class="coop-card-right">
          <div class="coop-card-art">
            ${companion.image ? `<img src="${companion.image}" alt="${companion.label}" />` : ''}
          </div>
          <div class="coop-card-desc" style="text-align: center; font-size: 7px;">${companionDetail.title}</div>
        </div>
      </div>
    `;

    // Update personality description
    this.personalityDescEl.textContent = state.description;

    // Update confirm button
    this.confirmBtn.textContent = `DESCEND AS ${hero.label} + ${companionDetail.label} ▼`;

    // Update instructions
    this.instructionsEl.textContent = `▲▼ SWITCH SECTION · ◄► CHANGE ${state.focused.toUpperCase()} · ENTER CONFIRM`;
  }

  private renderHeroStat(key: StatKey, value: number): string {
    const { filled, label } = STAT_ICONS[key];
    return `
      <div class="coop-card-stat">
        <span class="coop-card-stat-label">${label}</span>
        <span class="coop-card-stat-icons">${buildStatIcons(value, filled)}</span>
      </div>
    `;
  }

  private renderCompanionStat(key: string, value: number, color: string): string {
    const { filled, label } = COMPANION_STAT_ICONS[key] ?? { filled: '★', label: key.toUpperCase().slice(0, 3) };
    return `
      <div class="coop-card-stat">
        <span class="coop-card-stat-label">${label}</span>
        <span class="coop-card-stat-icons" style="color: ${color}">${buildCompanionStatIcons(value, filled)}</span>
      </div>
    `;
  }

  destroy(): void {
    this.ambientAudio.pause();
    this.ambientAudio.src = '';
    this.backdrop?.destroy();
    this.root.remove();
  }
}
