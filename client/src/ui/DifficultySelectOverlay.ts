import { INTERNAL_HEIGHT, INTERNAL_WIDTH } from '../config/constants';
import type { Difficulty } from '../systems/DifficultyManager';

export interface DifficultyOption {
    key: Difficulty;
    label: string;
    desc: string;
    color: string;
}

interface DifficultySelectOptions {
    options: DifficultyOption[];
    selectedIndex: number;
    onSelect: (index: number) => void;
    onConfirm: () => void;
    onBack: () => void;
}

const ensureStyles = (): void => {
    if (document.getElementById('difficulty-select-styles')) return;
    const style = document.createElement('style');
    style.id = 'difficulty-select-styles';
    style.textContent = `
    .diff-ui { position:absolute; inset:0; font-family:'Press Start 2P', monospace; text-transform:uppercase; color:#cfd8ff; pointer-events:none; -webkit-font-smoothing:none; font-smooth:never; image-render:pixelated; }
    .diff-bg { position:absolute; inset:0; background:radial-gradient(circle at 50% 20%, rgba(255,255,255,0.03), transparent 50%); }
    .diff-frame { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:40px; gap:48px; }
    .diff-header { text-align:center; letter-spacing:0.2em; color:#ffffff; font-size:32px; border-bottom:2px solid rgba(51,68,85,0.8); padding-bottom:12px; width:600px; }
    .diff-list { display:flex; flex-direction:column; gap:40px; width:650px; }
    .diff-item { font-family:inherit; border:none; background:none; cursor:pointer; color:#778899; display:flex; flex-direction:column; gap:12px; align-items:center; transition: all 0.2s; pointer-events:auto; }
    .diff-item.selected { color:var(--opt-color); transform: scale(1.05); }
    .diff-label { font-size:24px; letter-spacing:0.1em; }
    .diff-desc { font-size:14px; color:#556677; text-align:center; line-height:1.6; max-width:500px; letter-spacing:0.02em; }
    .diff-item.selected .diff-desc { color:#aabbcc; }
    .diff-footer { display:flex; justify-content:space-between; width:650px; margin-top:24px; pointer-events:auto; }
    .diff-btn { font-family:'Press Start 2P', monospace; font-size:18px; color:#778899; background:none; border:none; cursor:pointer; transition:all 0.2s; }
    .diff-btn:hover { transform: scale(1.1); }
    .diff-btn.confirm { color:#00ffcc; text-shadow: 0 0 10px rgba(0,255,204,0.3); }
  `;
    document.head.appendChild(style);
};

export class DifficultySelectOverlay {
    private root: HTMLDivElement;
    private stage: HTMLDivElement;
    private itemEls: HTMLButtonElement[] = [];

    constructor(private parent: HTMLElement, private canvas: HTMLCanvasElement, private options: DifficultySelectOptions) {
        this.parent.querySelectorAll<HTMLDivElement>('[data-diff-overlay="true"]').forEach((node) => node.remove());
        ensureStyles();

        this.root = document.createElement('div');
        this.root.dataset.diffOverlay = 'true';
        this.root.className = 'diff-ui';

        const bg = document.createElement('div');
        bg.className = 'diff-bg';
        this.root.appendChild(bg);

        this.stage = document.createElement('div');
        Object.assign(this.stage.style, {
            position: 'absolute',
            width: `${INTERNAL_WIDTH}px`,
            height: `${INTERNAL_HEIGHT}px`,
            transformOrigin: 'top left',
        });

        const frame = document.createElement('div');
        frame.className = 'diff-frame';

        const header = document.createElement('div');
        header.className = 'diff-header';
        header.textContent = 'SELECT DIFFICULTY';
        frame.appendChild(header);

        const list = document.createElement('div');
        list.className = 'diff-list';
        this.itemEls = options.options.map((opt, idx) => {
            const btn = document.createElement('button');
            btn.className = 'diff-item';
            btn.style.setProperty('--opt-color', opt.color);
            btn.innerHTML = `
        <div class="diff-label">${opt.label}</div>
        <div class="diff-desc">${opt.desc}</div>
      `;
            btn.addEventListener('mouseenter', () => options.onSelect(idx));
            btn.addEventListener('click', () => options.onConfirm());
            list.appendChild(btn);
            return btn;
        });
        frame.appendChild(list);

        const footer = document.createElement('div');
        footer.className = 'diff-footer';
        const backBtn = document.createElement('button');
        backBtn.className = 'diff-btn';
        backBtn.textContent = '[ BACK ]';
        backBtn.addEventListener('click', () => options.onBack());

        const confirmBtn = document.createElement('button');
        confirmBtn.className = 'diff-btn confirm';
        confirmBtn.textContent = '[ CONFIRM ]';
        confirmBtn.addEventListener('click', () => options.onConfirm());

        footer.append(backBtn, confirmBtn);
        frame.appendChild(footer);

        this.stage.appendChild(frame);
        this.root.appendChild(this.stage);
        this.parent.appendChild(this.root);

        new ResizeObserver(() => this.updateStage()).observe(canvas);
        this.updateStage();
    }

    render(selectedIndex: number): void {
        this.itemEls.forEach((el, idx) => {
            el.classList.toggle('selected', idx === selectedIndex);
        });
    }

    destroy(): void {
        this.root.remove();
    }

    private updateStage(): void {
        const canvasRect = this.canvas.getBoundingClientRect();
        const parentRect = this.parent.getBoundingClientRect();
        const left = canvasRect.left - parentRect.left;
        const top = canvasRect.top - parentRect.top;

        const baseHeight = 720;
        const aspect = INTERNAL_WIDTH / INTERNAL_HEIGHT;
        const baseWidth = baseHeight * aspect;

        this.stage.style.width = `${baseWidth}px`;
        this.stage.style.height = `${baseHeight}px`;
        this.stage.style.left = `${left}px`;
        this.stage.style.top = `${top}px`;
        this.stage.style.transform = `scale(${canvasRect.width / baseWidth}, ${canvasRect.height / baseHeight})`;
    }
}
