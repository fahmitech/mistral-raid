import type { CompanionGuide } from '../config/companionGuides';

export type CoopSection = 'hero' | 'companion' | 'personality';

interface CharacterOption {
  label: string;
  image?: string | null;
}

interface PersonalityOption {
  key: string;
  label: string;
  color: string;
  icon: string;
}

interface CoopSelectOverlayOptions {
  heroes: CharacterOption[];
  companions: CharacterOption[];
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

const ensureStyles = (): void => {
  if (document.getElementById('coop-select-redesign')) return;
  const style = document.createElement('style');
  style.id = 'coop-select-redesign';
  style.textContent = `
    .coop-ui { position:absolute; inset:0; font-family:'Press Start 2P', monospace; text-transform:uppercase; color:#cfd8ff; pointer-events:none; }
    .coop-bg { position:absolute; inset:0; background:radial-gradient(circle at 50% 15%, rgba(255,255,255,0.05), transparent 45%), linear-gradient(180deg,#04001a 0%,#050427 40%,#080835 100%); }
    .coop-frame { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; padding:32px 32px 24px; gap:24px; }
    .coop-header { text-align:center; letter-spacing:0.2em; color:#f5d0fe; text-shadow:0 1px 0 #130022, 0 0 24px rgba(245,208,254,0.7); font-size:17px; margin-top:12px; }
    .coop-header small { display:block; margin-top:8px; font-size:10px; color:#fde68a; letter-spacing:0.25em; opacity:0.95; }
    .coop-panel { position:relative; width:740px; min-height:420px; background:rgba(5,12,24,0.95); border:2px solid rgba(80,110,170,0.85); border-radius:12px; padding:34px 44px; display:flex; flex-direction:column; gap:32px; box-shadow:0 0 52px rgba(10,0,40,0.7); pointer-events:auto; }
    .coop-panel::before,.coop-panel::after { content:''; position:absolute; width:8px; height:8px; border:1px solid rgba(80,110,180,0.6); }
    .coop-panel::before { top:-1px; left:-1px; border-right:none; border-bottom:none; }
    .coop-panel::after { bottom:-1px; right:-1px; border-left:none; border-top:none; }
    .coop-section { display:flex; flex-direction:column; gap:10px; }
    .coop-section + .coop-section { border-top:1px solid rgba(80,100,150,0.4); padding-top:16px; }
    .coop-section-title { font-size:11px; letter-spacing:0.25em; color:#facc15; font-family:'Press Start 2P', monospace; }
    .coop-section-title.secondary { color:#94a3b8; }
    .coop-portrait-row { display:flex; justify-content:center; gap:52px; padding:0 20px; }
    .coop-portrait { flex:1; display:flex; flex-direction:column; align-items:center; gap:6px; padding:6px 0; border:none; background:none; cursor:pointer; pointer-events:auto; }
    .coop-portrait .frame { width:92px; height:92px; border:3px solid rgba(40,60,90,0.45); border-radius:10px; display:flex; align-items:center; justify-content:center; background:#091023; box-shadow:inset 0 3px 8px rgba(0,0,0,0.65); transition:border-color 0.15s, box-shadow 0.15s; }
    .coop-portrait img { width:52px; height:58px; image-rendering:pixelated; }
    .coop-portrait .placeholder { width:34px; height:42px; background:rgba(255,255,255,0.15); border-radius:3px; }
    .coop-portrait span { font-size:9px; color:#7f8db2; letter-spacing:0.12em; font-family:'Press Start 2P', monospace; }
    .coop-portrait.selected .frame.hero { border-color:#ffdd00; box-shadow:0 0 8px rgba(255,221,0,0.5); }
    .coop-portrait.selected .frame.companion { border-color:#a855f7; box-shadow:0 0 8px rgba(168,85,247,0.5); }
    .coop-portrait.selected span { color:#f8fafc; }
    .coop-personality-row { display:flex; justify-content:space-between; gap:24px; padding:0 24px; }
    .coop-personality-btn { flex:1; border:none; background:none; text-align:center; cursor:pointer; opacity:0.45; color:#94a3b8; font-size:9px; display:flex; flex-direction:column; gap:7px; align-items:center; letter-spacing:0.12em; font-family:'Press Start 2P', monospace; }
    .coop-personality-btn .icon { font-size:14px; line-height:1; }
    .coop-companion-card { position:absolute; width:240px; background:rgba(8,12,28,0.95); border:2px solid rgba(80,110,170,0.85); border-radius:10px; padding:16px 18px; box-shadow:0 12px 28px rgba(0,0,0,0.55); opacity:0; transform:translateY(6px); transition:opacity 0.2s ease, transform 0.2s ease; pointer-events:none; z-index:5; }
    .coop-companion-card.visible { opacity:1; transform:translateY(0); }
    .coop-companion-card h4 { font-size:11px; margin-bottom:4px; letter-spacing:0.16em; }
    .coop-companion-card .subtitle { font-size:7px; color:#9facd8; letter-spacing:0.24em; margin-bottom:8px; }
    .coop-companion-card p { font-size:7px; line-height:1.6; color:#dbe8ff; }
    .coop-companion-card .ability { margin-top:10px; padding-top:10px; border-top:1px solid rgba(90,120,180,0.35); }
    .coop-companion-card .ability strong { display:block; font-size:8px; letter-spacing:0.18em; margin-bottom:4px; }
    .coop-companion-card .stats { margin-top:12px; display:grid; grid-template-columns:repeat(3,1fr); gap:8px; }
    .coop-companion-card .stat label { font-size:6px; color:#9facd8; letter-spacing:0.18em; display:block; margin-bottom:2px; }
    .coop-companion-card .stat .value { font-size:7px; color:#f8fafc; letter-spacing:0.1em; display:block; margin-bottom:2px; }
    .coop-companion-card .stat .bar { width:100%; height:5px; background:#0b1424; border:1px solid rgba(255,255,255,0.15); position:relative; }
    .coop-companion-card .stat .bar::after { content:''; position:absolute; top:0; left:0; height:100%; background:var(--bar-color, #94a3b8); width:var(--bar-fill,50%); }
    .coop-personality-btn.selected { opacity:1; text-shadow:0 0 8px currentColor; }
    .coop-bottom { border-top:1px solid rgba(80,100,150,0.4); padding-top:16px; display:flex; flex-direction:column; gap:10px; align-items:center; }
    .coop-desc { font-size:8px; color:#e3ebff; letter-spacing:0.12em; text-align:center; }
    .coop-instructions { font-size:7px; color:#9ea9d1; letter-spacing:0.1em; text-align:center; }
    .coop-buttons { width:86%; display:flex; justify-content:space-between; gap:24px; }
    .coop-btn { flex:1; font-family:'Press Start 2P', monospace; font-size:10px; padding:10px 0; background:rgba(8,12,28,0.95); border:2px solid rgba(90,120,190,0.95); color:#f0f4ff; box-shadow:0 4px 14px rgba(0,0,0,0.65); cursor:pointer; letter-spacing:0.16em; }
    .coop-btn:hover { background:rgba(12,18,38,0.95); }
  `;
  document.head.appendChild(style);
};

export class CoopSelectOverlay {
  private root: HTMLDivElement;
  private descEl: HTMLDivElement;
  private instructionEl: HTMLDivElement;
  private sectionTitleMap: Record<CoopSection, HTMLDivElement>;
  private heroButtons: HTMLButtonElement[] = [];
  private companionButtons: HTMLButtonElement[] = [];
  private personalityButtons: HTMLButtonElement[] = [];
  private panelEl: HTMLDivElement;
  private companionCard?: HTMLDivElement;
  private companionDetails: CompanionGuide[];
  private pinnedCompanionIndex: number | null = null;
  private hoverCompanionIndex: number | null = null;

  constructor(parent: HTMLElement, options: CoopSelectOverlayOptions) {
    parent.querySelectorAll<HTMLDivElement>('[data-coop-overlay="true"]').forEach((node) => node.remove());
    ensureStyles();
    this.root = document.createElement('div');
    this.root.dataset.coopOverlay = 'true';
    this.root.className = 'coop-ui';
    this.companionDetails = options.companionDetails;

    const bg = document.createElement('div');
    bg.className = 'coop-bg';
    this.root.appendChild(bg);

    const frame = document.createElement('div');
    frame.className = 'coop-frame';
    const header = document.createElement('div');
    header.className = 'coop-header';
    header.innerHTML = 'AI CO-OP MODE<small>AI COMPANION POWERED BY MISTRAL</small>';
    frame.appendChild(header);

    const panel = document.createElement('div');
    panel.className = 'coop-panel';
    frame.appendChild(panel);
    this.panelEl = panel;

    const heroSection = panel.appendChild(this.buildSection('YOUR HERO', 'hero'));
    heroSection.appendChild(this.buildRow('hero', options.heroes, this.heroButtons, options.onSelect));

    const companionSection = panel.appendChild(this.buildSection('AI COMPANION', 'companion', true));
    companionSection.appendChild(this.buildRow('companion', options.companions, this.companionButtons, options.onSelect));
    this.companionCard = document.createElement('div');
    this.companionCard.className = 'coop-companion-card';
    panel.appendChild(this.companionCard);

    const personalitySection = panel.appendChild(this.buildSection('PERSONALITY', 'personality', true));
    personalitySection.appendChild(this.buildPersonalityRow(options.personalities, this.personalityButtons, options.onSelect));

    const bottom = document.createElement('div');
    bottom.className = 'coop-bottom';
    panel.appendChild(bottom);

    this.descEl = document.createElement('div');
    this.descEl.className = 'coop-desc';
    bottom.appendChild(this.descEl);

    this.instructionEl = document.createElement('div');
    this.instructionEl.className = 'coop-instructions';
    bottom.appendChild(this.instructionEl);

    const buttons = document.createElement('div');
    buttons.className = 'coop-buttons';
    const backBtn = document.createElement('button');
    backBtn.className = 'coop-btn';
    backBtn.textContent = '[ BACK ]';
    backBtn.addEventListener('click', options.onBack);
    const startBtn = document.createElement('button');
    startBtn.className = 'coop-btn';
    startBtn.textContent = '[ START ]';
    startBtn.addEventListener('click', options.onConfirm);
    buttons.append(backBtn, startBtn);
    bottom.appendChild(buttons);

    this.root.appendChild(frame);

    this.sectionTitleMap = {
      hero: heroSection.querySelector('.coop-section-title') as HTMLDivElement,
      companion: companionSection.querySelector('.coop-section-title') as HTMLDivElement,
      personality: personalitySection.querySelector('.coop-section-title') as HTMLDivElement,
    };

    parent.appendChild(this.root);
  }

  render(state: CoopSelectOverlayState): void {
    this.heroButtons.forEach((btn, idx) => btn.classList.toggle('selected', idx === state.heroIndex));
    this.companionButtons.forEach((btn, idx) => btn.classList.toggle('selected', idx === state.companionIndex));
    this.personalityButtons.forEach((btn, idx) => btn.classList.toggle('selected', idx === state.personalityIndex));
    Object.entries(this.sectionTitleMap).forEach(([section, el]) => {
      el.classList.toggle('focused', section === state.focused);
    });
    this.descEl.textContent = state.description;
    this.instructionEl.textContent = `SELECTING: ${state.focused.toUpperCase()}   ▲▼ SWITCH   ◄► CHANGE   ENTER CONFIRM`;
    this.pinnedCompanionIndex = state.focused === 'companion' ? state.companionIndex : null;
    this.updateCompanionCard();
  }

  private updateCompanionCard(): void {
    if (!this.companionCard) return;
    const index = this.hoverCompanionIndex ?? this.pinnedCompanionIndex;
    if (index === null || !this.companionDetails[index]) {
      this.companionCard.classList.remove('visible');
      return;
    }
    const detail = this.companionDetails[index];
    const btn = this.companionButtons[index];
    if (!btn) {
      this.companionCard.classList.remove('visible');
      return;
    }
    const rect = btn.getBoundingClientRect();
    const panelRect = this.panelEl.getBoundingClientRect();
    const top = rect.bottom - panelRect.top + 6;
    const left = rect.left - panelRect.left + rect.width / 2 - 120;
    this.companionCard.style.top = `${top}px`;
    this.companionCard.style.left = `${left}px`;
    this.companionCard.innerHTML = this.buildCompanionCard(detail);
    this.companionCard.classList.add('visible');
  }

  private buildCompanionCard(detail: CompanionGuide): string {
    const statsOrder: Array<{ key: keyof CompanionGuide['stats']; label: string }> = [
      { key: 'offense', label: 'OFFENSE' },
      { key: 'defense', label: 'DEFENSE' },
      { key: 'support', label: 'SUPPORT' },
    ];
    const statsHtml = statsOrder
      .map(({ key, label }) => {
        const value = detail.stats[key];
        const percent = Math.min(100, Math.round((value / 10) * 100));
        return `
          <div class="stat" style="--bar-fill:${percent}%; --bar-color:${detail.color};">
            <label>${label}</label>
            <span class="value">${value}/10</span>
            <div class="bar"></div>
          </div>
        `;
      })
      .join('');

    return `
      <h4 style="color:${detail.color}">${detail.label}</h4>
      <div class="subtitle">${detail.title.toUpperCase()}</div>
      <p>${detail.backstory}</p>
      <div class="ability">
        <strong style="color:${detail.color}">${detail.abilityName}</strong>
        <p>${detail.abilityDescription}</p>
      </div>
      <div class="stats">${statsHtml}</div>
    `;
  }

  destroy(): void {
    this.root.remove();
  }

  private buildSection(title: string, section: CoopSection, subdued = false): HTMLDivElement {
    const sectionEl = document.createElement('div');
    sectionEl.className = 'coop-section';
    const label = document.createElement('div');
    label.className = 'coop-section-title';
    if (subdued) label.classList.add('secondary');
    label.textContent = title;
    sectionEl.appendChild(label);
    return sectionEl;
  }

  private buildRow(
    section: CoopSection,
    options: CharacterOption[],
    bucket: HTMLButtonElement[],
    onSelect: (section: CoopSection, index: number) => void
  ): HTMLDivElement {
    const row = document.createElement('div');
    row.className = 'coop-portrait-row';
    options.forEach((opt, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'coop-portrait';
      btn.dataset.index = idx.toString();
      btn.innerHTML = `
        <div class="frame ${section === 'companion' ? 'companion' : 'hero'}">
          ${opt.image ? `<img src="${opt.image}" alt="${opt.label}" />` : '<div class="placeholder"></div>'}
        </div>
        <span>${opt.label}</span>
      `;
      btn.addEventListener('click', () => onSelect(section, idx));
      if (section === 'companion') {
        btn.addEventListener('mouseenter', () => {
          this.hoverCompanionIndex = idx;
          this.updateCompanionCard();
        });
        btn.addEventListener('mouseleave', () => {
          this.hoverCompanionIndex = null;
          this.updateCompanionCard();
        });
      }
      row.appendChild(btn);
      bucket.push(btn);
    });
    return row;
  }

  private buildPersonalityRow(
    options: PersonalityOption[],
    bucket: HTMLButtonElement[],
    onSelect: (section: CoopSection, index: number) => void
  ): HTMLDivElement {
    const row = document.createElement('div');
    row.className = 'coop-personality-row';
    options.forEach((opt, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'coop-personality-btn';
      btn.style.color = opt.color;
      btn.innerHTML = `<span class="icon">${opt.icon}</span>${opt.label}`;
      btn.addEventListener('click', () => onSelect('personality', idx));
      row.appendChild(btn);
      bucket.push(btn);
    });
    return row;
  }
}
