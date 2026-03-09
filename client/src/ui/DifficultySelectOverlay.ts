import type { Difficulty } from '../systems/DifficultyManager';
import { DungeonBackdrop } from './DungeonBackdrop';

export interface DifficultyStat {
  label: string;
  value: string;
}

export interface DifficultyOption {
  key: Difficulty;
  rank: string;
  name: string;
  tagline: string;
  tag: string;
  icon: string;
  accentHex: string;
  stats: DifficultyStat[];
}

interface DifficultySelectOverlayOptions {
  options: DifficultyOption[];
  initialIndex: number;
  onSelect: (index: number) => void;
  onConfirm: () => void;
  onBack: () => void;
}

const ensureStyles = (): void => {
  if (document.getElementById('difficulty-select-redesign')) return;
  const style = document.createElement('style');
  style.id = 'difficulty-select-redesign';
  style.textContent = `
    .difficulty-ui { position:absolute; inset:0; font-family:'Press Start 2P', monospace; color:#f4f0ff; pointer-events:none; }
    .difficulty-ui *, .difficulty-ui *::before, .difficulty-ui *::after { box-sizing:border-box; }
    .difficulty-screen {
      position:relative; z-index:5;
      width:min(1080px, 96vw);
      margin:0 auto;
      min-height:100%;
      display:flex; flex-direction:column; align-items:center; gap:32px;
      padding:48px 24px 36px;
      pointer-events:auto;
      animation:difficulty-fadeUp 0.6s cubic-bezier(0.22,1,0.36,1) both;
    }
    @keyframes difficulty-fadeUp {
      from { opacity:0; transform:translateY(16px); }
      to   { opacity:1; transform:translateY(0); }
    }
    .difficulty-header { display:flex; flex-direction:column; align-items:center; gap:10px; text-transform:uppercase; }
    .difficulty-header-title {
      font-size:clamp(18px, 2.4vw, 28px);
      letter-spacing:8px;
      color:#f0eaff;
      text-shadow:0 0 10px rgba(210,170,80,0.65), 0 0 30px rgba(180,110,20,0.35), 3px 3px 0 #08040a;
      animation:difficulty-flicker 5s ease-in-out infinite alternate;
    }
    @keyframes difficulty-flicker {
      0%,85% { opacity:1; }
      87% { opacity:0.85; }
      89% { opacity:1; }
      92% { opacity:0.9; }
      100% { opacity:1; text-shadow:0 0 14px rgba(220,185,90,0.9),0 0 40px rgba(190,130,30,0.5),3px 3px 0 #08040a; }
    }
    .difficulty-header-rule {
      display:flex; align-items:center; gap:0; width:400px; max-width:80vw;
    }
    .difficulty-rule-line { flex:1; height:1px; background: linear-gradient(90deg, transparent, rgba(80,72,104,0.9)); }
    .difficulty-rule-line-right { background: linear-gradient(90deg, rgba(80,72,104,0.9), transparent); }
    .difficulty-rule-gem {
      width:10px; height:10px; background:#c8a050;
      transform:rotate(45deg);
      box-shadow:0 0 10px rgba(200,160,80,0.8);
      animation:difficulty-gemPulse 2s ease-in-out infinite alternate;
    }
    @keyframes difficulty-gemPulse {
      from { box-shadow:0 0 6px rgba(200,160,80,0.5); }
      to { box-shadow:0 0 16px rgba(220,180,90,1), 0 0 30px rgba(200,140,40,0.4); }
    }
    .difficulty-header-sub {
      font-size:9px; letter-spacing:7px; color:#504868; margin-top:-2px;
    }
    .difficulty-cards {
      display:grid;
      grid-template-columns:repeat(auto-fit,minmax(260px,1fr));
      gap:20px;
      width:100%;
    }
    .difficulty-card {
      position:relative;
      border:none;
      border-radius:20px;
      cursor:pointer;
      padding:0;
      background:transparent;
      transition:transform 0.2s cubic-bezier(0.22,1,0.36,1);
      color:inherit;
      text-align:left;
    }
    .difficulty-card-shell {
      position:absolute; inset:-2px;
      border-radius:22px;
      opacity:0;
      transition:opacity 0.25s;
      pointer-events:none;
      box-shadow:0 0 0 1.5px rgba(255,255,255,0.08);
    }
    .difficulty-card.active .difficulty-card-shell,
    .difficulty-card:hover .difficulty-card-shell { opacity:1; }
    .difficulty-card-body {
      position:relative;
      border-radius:20px;
      border:1px solid rgba(255,255,255,0.08);
      background:#0e0b1c;
      overflow:hidden;
      display:flex;
      flex-direction:column;
      padding:26px 24px 30px;
      gap:20px;
      min-height:320px;
      background-image:repeating-conic-gradient(rgba(255,255,255,0.01) 0% 25%, transparent 0% 50%);
      background-size:6px 6px;
      box-shadow:0 10px 24px rgba(0,0,0,0.55);
      font-family:'Press Start 2P', monospace;
    }
    .difficulty-card-line {
      height:3px;
      opacity:0.35;
      background:linear-gradient(90deg, transparent, currentColor 30%, currentColor 70%, transparent);
    }
    .difficulty-card-title {
      text-align:center;
      letter-spacing:4px;
      font-size:20px;
      margin-top:-10px;
      color:currentColor;
      text-transform:uppercase;
      opacity:0.45;
      transition:opacity 0.25s, text-shadow 0.25s;
    }
    .difficulty-card.active .difficulty-card-title,
    .difficulty-card:hover .difficulty-card-title {
      opacity:1;
      text-shadow:0 0 20px currentColor, 0 0 40px currentColor;
    }
    .difficulty-card-rank {
      text-align:center;
      font-size:10px;
      letter-spacing:4px;
      color:#665c80;
      margin-top:-6px;
      text-transform:uppercase;
    }
    .difficulty-card-divider {
      width:100%;
      height:1px;
      background:linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent);
    }
    .difficulty-card-lore {
      font-size:12px;
      letter-spacing:0.5px;
      color:#9f96b6;
      line-height:1.6;
      text-transform:none;
      min-height:40px;
    }
    .difficulty-card-stats {
      display:flex;
      flex-direction:column;
      gap:10px;
    }
    .difficulty-card-stat {
      display:flex;
      gap:10px;
      align-items:flex-start;
      font-size:11px;
      letter-spacing:0.3px;
      color:#b0a8c8;
    }
    .difficulty-card-stat::before {
      content:'';
      width:6px; height:6px;
      clip-path:polygon(50% 0%,100% 50%,50% 100%,0% 50%);
      background:currentColor;
      margin-top:4px;
    }
    .difficulty-card-stat-label {
      color:#f6f4ff;
      flex:1;
      text-transform:none;
      font-size:11px;
    }
    .difficulty-card-stat-value {
      color:#dbd4f7;
      text-align:right;
      flex:1;
      font-size:11px;
    }
    .difficulty-card.active,
    .difficulty-card:hover { transform:translateY(-6px); }
    .difficulty-card[class*='easy'] .difficulty-card-shell { box-shadow:0 0 0 1.5px rgba(61,220,132,0.5), 0 0 40px rgba(61,220,132,0.18), 0 12px 48px rgba(61,220,132,0.12); }
    .difficulty-card[class*='medium'] .difficulty-card-shell { box-shadow:0 0 0 1.5px rgba(240,192,64,0.5), 0 0 40px rgba(240,192,64,0.18), 0 12px 48px rgba(240,192,64,0.12); }
    .difficulty-card[class*='hard'] .difficulty-card-shell { box-shadow:0 0 0 1.5px rgba(232,64,64,0.5), 0 0 40px rgba(232,64,64,0.18), 0 12px 48px rgba(232,64,64,0.12); }
    .difficulty-card[class*='easy'] { color:#3ddc84; }
    .difficulty-card[class*='medium'] { color:#f0c040; }
    .difficulty-card[class*='hard'] { color:#e84040; }
    .difficulty-card-sprite {
      width:96px; height:96px;
      image-rendering:pixelated;
      margin:0 auto 8px;
      display:block;
    }
    .difficulty-footer {
      width:100%;
      display:flex;
      justify-content:space-between;
      align-items:center;
      padding-top:6px;
      margin-top:-18px;
      border-top:1px solid rgba(46,36,80,0.5);
      gap:16px;
      flex-wrap:wrap;
    }
    .difficulty-footer-hint {
      font-size:8px;
      letter-spacing:3px;
      color:#2f2546;
      flex:1;
      text-align:center;
    }
    .difficulty-btn {
      font-family:'Press Start 2P', monospace;
      font-size:9px;
      letter-spacing:2px;
      padding:12px 22px;
      border-radius:10px;
      cursor:pointer;
      transition:all 0.15s;
      text-transform:uppercase;
    }
    .difficulty-btn-back {
      border:1px solid #2c2240;
      color:#3e3058;
      background:transparent;
    }
    .difficulty-btn-back:hover { border-color:#62549a; color:#8a82b8; }
    .difficulty-btn-confirm {
      border:1px solid rgba(0,230,160,0.4);
      color:#00e8a8;
      background:transparent;
      text-shadow:0 0 10px rgba(0,230,160,0.55);
      box-shadow:0 0 20px rgba(0,230,160,0.08);
      margin-top:-14px;
      position:relative;
      overflow:hidden;
    }
    .difficulty-btn-confirm::after {
      content:'';
      position:absolute;
      inset:0;
      background:linear-gradient(105deg, transparent 40%, rgba(0,230,160,0.1) 50%, transparent 60%);
      transform:translateX(-100%);
      animation:difficulty-sheen 3s ease-in-out infinite;
    }
    @keyframes difficulty-sheen { to { transform:translateX(200%); } }
    .difficulty-btn-confirm:hover { box-shadow:0 0 32px rgba(0,230,160,0.2); background:rgba(0,230,160,0.05); }
    @media (max-width:768px) {
      .difficulty-footer { flex-direction:column; align-items:stretch; }
      .difficulty-footer-hint { order:3; width:100%; }
      .difficulty-btn { width:100%; text-align:center; }
    }
  `;
  document.head.appendChild(style);
};

export class DifficultySelectOverlay {
  private root: HTMLDivElement;
  private cards: HTMLButtonElement[] = [];
  private confirmBtn: HTMLButtonElement;
  private options: DifficultyOption[];
  private backdrop?: DungeonBackdrop;

  constructor(parent: HTMLElement, options: DifficultySelectOverlayOptions) {
    ensureStyles();
    parent.querySelectorAll<HTMLDivElement>('[data-difficulty-overlay="true"]').forEach((node) => node.remove());
    this.options = options.options;

    this.root = document.createElement('div');
    this.root.dataset.difficultyOverlay = 'true';
    this.root.className = 'difficulty-ui';

    this.backdrop = new DungeonBackdrop(this.root);

    const screen = document.createElement('div');
    screen.className = 'difficulty-screen';
    this.root.appendChild(screen);

    const header = document.createElement('div');
    header.className = 'difficulty-header';
    header.innerHTML = `
      <div class="difficulty-header-title">CHOOSE YOUR FATE</div>
      <div class="difficulty-header-rule">
        <div class="difficulty-rule-line"></div>
        <div class="difficulty-rule-gem"></div>
        <div class="difficulty-rule-line difficulty-rule-line-right"></div>
      </div>
      <div class="difficulty-header-sub">SELECT DIFFICULTY</div>
    `;
    screen.appendChild(header);

    const cardsRow = document.createElement('div');
    cardsRow.className = 'difficulty-cards';
    screen.appendChild(cardsRow);

    this.options.forEach((option, index) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = `difficulty-card difficulty-card-${option.key}`;
      card.addEventListener('click', () => options.onSelect(index));

      const shell = document.createElement('div');
      shell.className = 'difficulty-card-shell';
      card.appendChild(shell);

      const body = document.createElement('div');
      body.className = 'difficulty-card-body';
      body.style.borderColor = option.accentHex + '33';
      card.style.setProperty('--accent', option.accentHex);
      card.appendChild(body);

      const line = document.createElement('div');
      line.className = 'difficulty-card-line';
      line.style.background = `linear-gradient(90deg, transparent, ${option.accentHex} 30%, ${option.accentHex} 70%, transparent)`;
      body.appendChild(line);

      const sprite = document.createElement('canvas');
      sprite.width = 24;
      sprite.height = 24;
      sprite.className = 'difficulty-card-sprite';
      this.drawCardSprite(sprite, option.key);
      body.appendChild(sprite);

      const title = document.createElement('div');
      title.className = 'difficulty-card-title';
      title.textContent = option.tag;
      body.appendChild(title);

      const rank = document.createElement('div');
      rank.className = 'difficulty-card-rank';
      rank.textContent = `${option.rank} · ${option.name}`;
      body.appendChild(rank);

      const divider = document.createElement('div');
      divider.className = 'difficulty-card-divider';
      body.appendChild(divider);

      const lore = document.createElement('div');
      lore.className = 'difficulty-card-lore';
      lore.textContent = option.tagline.replace(/(^"|"$)/g, '');
      body.appendChild(lore);

      const stats = document.createElement('div');
      stats.className = 'difficulty-card-stats';
      option.stats.forEach((stat) => {
        const statRow = document.createElement('div');
        statRow.className = 'difficulty-card-stat';
        const label = document.createElement('div');
        label.className = 'difficulty-card-stat-label';
        label.textContent = stat.label;
        const value = document.createElement('div');
        value.className = 'difficulty-card-stat-value';
        value.textContent = stat.value;
        statRow.append(label, value);
        stats.appendChild(statRow);
      });
      body.appendChild(stats);

      cardsRow.appendChild(card);
      this.cards.push(card);
    });

    const footer = document.createElement('div');
    footer.className = 'difficulty-footer';
    screen.appendChild(footer);

    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'difficulty-btn difficulty-btn-back';
    backBtn.textContent = '← BACK';
    backBtn.addEventListener('click', options.onBack);
    footer.appendChild(backBtn);

    const hint = document.createElement('div');
    hint.className = 'difficulty-footer-hint';
    hint.textContent = '← → MOVE · ENTER SELECT';
    footer.appendChild(hint);

    this.confirmBtn = document.createElement('button');
    this.confirmBtn.type = 'button';
    this.confirmBtn.className = 'difficulty-btn difficulty-btn-confirm';
    this.confirmBtn.textContent = 'DESCEND →';
    this.confirmBtn.addEventListener('click', options.onConfirm);
    footer.appendChild(this.confirmBtn);

    parent.appendChild(this.root);

    this.render(options.initialIndex);
  }

  render(selectedIndex: number): void {
    this.cards.forEach((card, idx) => {
      card.classList.toggle('active', idx === selectedIndex);
    });

    const option = this.options[selectedIndex];
    if (!option) return;

    this.confirmBtn.style.borderColor = option.accentHex;
    this.confirmBtn.style.color = option.accentHex;
    this.confirmBtn.style.setProperty('--accent', option.accentHex);
  }

  destroy(): void {
    this.backdrop?.destroy();
    this.root.remove();
  }
  private drawCardSprite(canvas: HTMLCanvasElement, key: Difficulty): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;

    const paint = (x: number, y: number, w: number, h: number, color: string): void => {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, w, h);
    };

    switch (key) {
      case 'easy': {
        const outline = '#1f4e2f';
        const fill = '#3ddc84';
        const core = '#aef0c6';
        for (let i = 0; i < 5; i++) {
          paint(5 - i, 2 + i, 2, 1, outline);
          paint(17 + i, 2 + i, 2, 1, outline);
        }
        paint(7, 5, 10, 10, fill);
        paint(9, 7, 6, 6, core);
        paint(11, 8, 2, 5, fill);
        break;
      }
      case 'medium': {
        const blade = '#f0c040';
        const guard = '#c38818';
        const grip = '#5a3b10';
        for (let i = 0; i < 10; i++) {
          paint(4 + i, 3 + i, 2, 2, blade);
          paint(16 - i, 3 + i, 2, 2, blade);
        }
        paint(9, 10, 6, 2, guard);
        paint(11, 12, 2, 6, grip);
        paint(10, 18, 4, 2, guard);
        break;
      }
      case 'hard':
      default: {
        const shell = '#f4d9c4';
        const eye = '#e84040';
        const shadow = '#7c5f4f';
        paint(5, 4, 14, 8, shell);
        paint(5, 12, 14, 3, shadow);
        paint(7, 6, 4, 4, eye);
        paint(13, 6, 4, 4, eye);
        paint(11, 12, 2, 3, '#000');
        break;
      }
    }
  }
}