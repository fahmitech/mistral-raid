interface OptionsOverlayOptions {
  rows: string[];
  onSelect: (index: number) => void;
  onToggle: (index: number) => void;
  onReset: () => void;
  onBack: () => void;
}

interface OptionsOverlayState {
  rows: Array<{ label: string; value: string }>;
  selectedIndex: number;
  toast?: string;
}

const ensureStyles = (): void => {
  if (document.getElementById('options-overlay-styles')) return;
  const style = document.createElement('style');
  style.id = 'options-overlay-styles';
  style.textContent = `
    .options-ui { position:absolute; inset:0; pointer-events:none; font-family:'Press Start 2P', monospace; text-transform:uppercase; color:#cfd8ff; }
    .options-bg { position:absolute; inset:0; background:radial-gradient(circle at 50% 20%, rgba(255,255,255,0.08), transparent 45%), linear-gradient(180deg,#04001a 0%,#060128 45%,#090a2a 100%); }
    .options-frame { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; padding:32px 32px 24px; }
    .options-header { text-align:center; font-size:18px; letter-spacing:0.18em; color:#f5d0fe; text-shadow:0 1px 0 #130022, 0 0 20px rgba(245,208,254,0.7); margin-bottom:12px; }
    .options-header small { display:block; margin-top:6px; font-size:9px; color:#fde68a; letter-spacing:0.25em; opacity:0.92; }
    .options-panel { width:820px; background:rgba(6,14,30,0.95); border:2px solid rgba(80,110,170,0.9); border-radius:18px; padding:42px 64px 40px; display:flex; flex-direction:column; gap:30px; pointer-events:auto; box-shadow:0 0 56px rgba(8,2,40,0.75); position:relative; }
    .options-panel::before,.options-panel::after { content:''; position:absolute; width:8px; height:8px; border:1px solid rgba(80,110,170,0.6); }
    .options-panel::before { top:-1px; left:-1px; border-right:none; border-bottom:none; }
    .options-panel::after { bottom:-1px; right:-1px; border-left:none; border-top:none; }
    .options-list { display:flex; flex-direction:column; gap:12px; }
    .options-row { display:flex; align-items:center; justify-content:space-between; padding:18px 22px; border-radius:12px; border:2px solid rgba(42,62,108,0.65); background:#070e1d; color:#8fa0c8; cursor:pointer; letter-spacing:0.15em; font-size:12px; transition:border-color 0.15s, color 0.15s, box-shadow 0.15s; font-family:'Press Start 2P', monospace; }
    .options-row .value { color:#f0f4ff; }
    .options-row.selected { border-color:#ffdd00; color:#ffdd00; box-shadow:0 0 12px rgba(255,221,0,0.45); }
    .options-row.selected .value { color:#ffdd00; }
    .options-row:focus-visible { outline:none; border-color:#ffdd00; }
    .options-divider { border-top:1px solid rgba(90,110,150,0.5); margin-top:4px; }
    .options-instructions { text-align:center; font-size:10px; letter-spacing:0.2em; color:#9eaad6; font-family:'Press Start 2P', monospace; }
    .options-buttons { display:flex; gap:24px; }
    .options-btn { flex:1; font-family:'Press Start 2P', monospace; font-size:12px; padding:14px 0; background:rgba(8,12,28,0.95); border:2px solid rgba(90,120,190,0.95); color:#f0f4ff; letter-spacing:0.18em; cursor:pointer; text-transform:uppercase; box-shadow:0 4px 12px rgba(0,0,0,0.6); }
    .options-btn:hover { background:rgba(14,20,38,0.98); }
    .options-btn.reset { border-color:#ff5b5b; color:#ffbaba; }
    .options-toast { min-height:16px; text-align:center; font-size:10px; color:#cbd5ff; letter-spacing:0.18em; font-family:'Press Start 2P', monospace; }
  `;
  document.head.appendChild(style);
};

export class OptionsOverlay {
  private root: HTMLDivElement;
  private rowButtons: HTMLButtonElement[] = [];
  private toastEl: HTMLDivElement;
  private instructionsEl: HTMLDivElement;
  private options: OptionsOverlayOptions;

  constructor(parent: HTMLElement, options: OptionsOverlayOptions) {
    ensureStyles();
    this.options = options;
    this.root = document.createElement('div');
    this.root.dataset.optionsOverlay = 'true';
    this.root.className = 'options-ui';

    const bg = document.createElement('div');
    bg.className = 'options-bg';
    this.root.appendChild(bg);

    const frame = document.createElement('div');
    frame.className = 'options-frame';
    const header = document.createElement('div');
    header.className = 'options-header';
    header.innerHTML = 'OPTIONS<small>Adjust Your Experience</small>';
    frame.appendChild(header);

    const panel = document.createElement('div');
    panel.className = 'options-panel';

    const list = document.createElement('div');
    list.className = 'options-list';
    options.rows.forEach((label, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'options-row';
      btn.innerHTML = `<span class="label">${label}</span><span class="value"></span>`;
      btn.addEventListener('click', () => this.options.onToggle(idx));
      btn.addEventListener('mouseenter', () => this.options.onSelect(idx));
      btn.addEventListener('focus', () => this.options.onSelect(idx));
      list.appendChild(btn);
      this.rowButtons.push(btn);
    });
    panel.appendChild(list);

    const divider = document.createElement('div');
    divider.className = 'options-divider';
    panel.appendChild(divider);

    this.instructionsEl = document.createElement('div');
    this.instructionsEl.className = 'options-instructions';
    panel.appendChild(this.instructionsEl);

    this.toastEl = document.createElement('div');
    this.toastEl.className = 'options-toast';
    panel.appendChild(this.toastEl);

    const buttons = document.createElement('div');
    buttons.className = 'options-buttons';
    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'options-btn reset';
    resetBtn.textContent = '[ RESET SAVE DATA ]';
    resetBtn.addEventListener('click', () => this.options.onReset());
    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'options-btn';
    backBtn.textContent = '[ BACK ]';
    backBtn.addEventListener('click', () => this.options.onBack());
    buttons.append(resetBtn, backBtn);
    panel.appendChild(buttons);

    frame.appendChild(panel);
    this.root.appendChild(frame);
    parent.appendChild(this.root);
  }

  render(state: OptionsOverlayState): void {
    state.rows.forEach((row, idx) => {
      const btn = this.rowButtons[idx];
      if (!btn) return;
      (btn.querySelector('.label') as HTMLSpanElement | null)!.textContent = row.label;
      (btn.querySelector('.value') as HTMLSpanElement | null)!.textContent = row.value;
      btn.classList.toggle('selected', idx === state.selectedIndex);
    });
    this.instructionsEl.textContent = '▲▼ MOVE   ENTER/CLICK TOGGLE   ESC BACK';
    this.toastEl.textContent = state.toast ?? '';
  }

  destroy(): void {
    this.root.remove();
  }
}
