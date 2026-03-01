export interface DirectorDecision {
  difficultyDelta: number;
  enemyBias: string;
  reason: string;
  timestamp: number;
}

export class DirectorPanel {
  private container: HTMLDivElement;
  private visible = false;
  private decision: DirectorDecision | null = null;

  constructor(parent: HTMLElement | string) {
    const host = typeof parent === 'string' ? document.getElementById(parent) : parent;
    if (!host) throw new Error(`DirectorPanel: parent not found (${String(parent)})`);

    const computedPos = window.getComputedStyle(host).position;
    if (computedPos === 'static') host.style.position = 'relative';

    this.container = document.createElement('div');
    this.container.style.position = 'absolute';
    this.container.style.right = '8px';
    this.container.style.top = '8px';
    this.container.style.width = '260px';
    this.container.style.zIndex = '80';
    this.container.style.padding = '10px 12px';
    this.container.style.background = 'rgba(10, 8, 16, 0.85)';
    this.container.style.border = '1px solid rgba(200, 120, 160, 0.4)';
    this.container.style.color = '#ffd6ee';
    this.container.style.font = '11px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace';
    this.container.style.display = 'none';
    this.container.style.pointerEvents = 'none';

    host.appendChild(this.container);
    this.render();
  }

  toggle(): void {
    this.setVisible(!this.visible);
  }

  setVisible(next: boolean): void {
    this.visible = next;
    this.container.style.display = next ? 'block' : 'none';
  }

  update(decision: DirectorDecision): void {
    this.decision = decision;
    this.render();
  }

  destroy(): void {
    this.container.remove();
  }

  private render(): void {
    const d = this.decision;
    this.container.innerHTML = `
      <div style="font-weight:600;color:#ffb4d9;margin-bottom:6px;">DIRECTOR [F5]</div>
      ${d ? `
        <div>difficultyDelta: <strong>${d.difficultyDelta}</strong></div>
        <div>enemyBias: <strong>${this.escape(d.enemyBias)}</strong></div>
        <div style="margin-top:4px;opacity:0.9;">${this.escape(d.reason)}</div>
        <div style="margin-top:6px;opacity:0.6;">${new Date(d.timestamp).toLocaleTimeString()}</div>
      ` : '<div style="opacity:0.6;">No decision yet.</div>'}
    `;
  }

  private escape(text: string): string {
    return text.replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[ch] ?? ch));
  }
}
