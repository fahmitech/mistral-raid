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
}

const ensureStyles = (): void => {
  if (document.getElementById('coop-select-redesign')) return;
  const style = document.createElement('style');
  style.id = 'coop-select-redesign';
  style.textContent = `
    .coop-ui { position:absolute; inset:0; font-family:'Press Start 2P', monospace; text-transform:uppercase; color:#cfd8ff; pointer-events:none; }
    .coop-bg { position:absolute; inset:0; background:radial-gradient(circle at 50% 15%, rgba(255,255,255,0.05), transparent 45%), linear-gradient(180deg,#04001a 0%,#050427 40%,#080835 100%); }
    .coop-frame { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; padding:16px 20px; gap:12px; }
    .coop-header { text-align:center; letter-spacing:0.12em; color:#f5d0fe; text-shadow:0 1px 0 #130022, 0 0 22px rgba(245,208,254,0.6); font-size:10px; }
    .coop-header small { display:block; margin-top:4px; font-size:6px; color:#fde68a; letter-spacing:0.15em; opacity:0.95; }
    .coop-panel { position:relative; width:520px; min-height:320px; background:rgba(5,12,24,0.94); border:2px solid rgba(80,110,170,0.8); border-radius:8px; padding:22px 26px; display:flex; flex-direction:column; gap:22px; box-shadow:0 0 40px rgba(10,0,40,0.6); pointer-events:auto; }
    .coop-panel::before,.coop-panel::after { content:''; position:absolute; width:8px; height:8px; border:1px solid rgba(80,110,180,0.6); }
    .coop-panel::before { top:-1px; left:-1px; border-right:none; border-bottom:none; }
    .coop-panel::after { bottom:-1px; right:-1px; border-left:none; border-top:none; }
    .coop-section { display:flex; flex-direction:column; gap:10px; }
    .coop-section + .coop-section { border-top:1px solid rgba(80,100,150,0.4); padding-top:16px; }
    .coop-section-title { font-size:8px; letter-spacing:0.2em; color:#facc15; }
    .coop-section-title.secondary { color:#94a3b8; }
    .coop-portrait-row { display:flex; justify-content:space-between; gap:34px; padding:0 8px; }
    .coop-portrait { flex:1; display:flex; flex-direction:column; align-items:center; gap:3px; padding:4px 0; border:none; background:none; cursor:pointer; pointer-events:auto; }
    .coop-portrait .frame { width:80px; height:80px; border:3px solid rgba(40,60,90,0.45); border-radius:8px; display:flex; align-items:center; justify-content:center; background:#091023; box-shadow:inset 0 3px 8px rgba(0,0,0,0.65); transition:border-color 0.15s, box-shadow 0.15s; }
    .coop-portrait img { width:46px; height:50px; image-rendering:pixelated; }
    .coop-portrait .placeholder { width:34px; height:42px; background:rgba(255,255,255,0.15); border-radius:3px; }
    .coop-portrait span { font-size:6px; color:#7f8db2; letter-spacing:0.08em; }
    .coop-portrait.selected .frame.hero { border-color:#ffdd00; box-shadow:0 0 8px rgba(255,221,0,0.5); }
    .coop-portrait.selected .frame.companion { border-color:#a855f7; box-shadow:0 0 8px rgba(168,85,247,0.5); }
    .coop-portrait.selected span { color:#f8fafc; }
    .coop-personality-row { display:flex; justify-content:space-between; gap:18px; padding:0 14px; }
    .coop-personality-btn { flex:1; border:none; background:none; text-align:center; cursor:pointer; opacity:0.35; color:#94a3b8; font-size:6px; display:flex; flex-direction:column; gap:4px; align-items:center; letter-spacing:0.07em; }
    .coop-personality-btn .icon { font-size:10px; line-height:1; }
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

  constructor(parent: HTMLElement, options: CoopSelectOverlayOptions) {
    parent.querySelectorAll<HTMLDivElement>('[data-coop-overlay="true"]').forEach((node) => node.remove());
    ensureStyles();
    this.root = document.createElement('div');
    this.root.dataset.coopOverlay = 'true';
    this.root.className = 'coop-ui';

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

    const heroSection = panel.appendChild(this.buildSection('YOUR HERO', 'hero'));
    heroSection.appendChild(this.buildRow('hero', options.heroes, this.heroButtons, options.onSelect));

    const companionSection = panel.appendChild(this.buildSection('AI COMPANION', 'companion', true));
    companionSection.appendChild(this.buildRow('companion', options.companions, this.companionButtons, options.onSelect));

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
