import type { SeqLifeline, SeqMessage } from '../types/sequence-diagram-viewer.types';

export function seqLifelineColor(kind: string, index: number): string {
  if (kind === 'actor') return '#34d399';
  if (kind === 'boundary') return '#38bdf8';
  if (kind === 'control') return '#fbbf24';
  if (kind === 'entity') return '#fb7185';
  const colors = ['#818cf8', '#a5b4fc', '#c4b5fd', '#93c5fd'];
  return colors[index % colors.length];
}

export function renderSeqDiagram(
  canvas: HTMLCanvasElement,
  lifelines: SeqLifeline[],
  messages: SeqMessage[],
  selectedId: string | null
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!lifelines.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No sequence lifelines in this diagram.', 16, 28);
    return;
  }
  const colW = Math.max(80, (canvas.width - 48) / lifelines.length);
  const xs = new Map<string, number>();
  lifelines.forEach((n, i) => {
    const x = 36 + i * colW + colW / 2;
    xs.set(n.id, x);
    ctx.fillStyle = n.id === selectedId ? '#c7d2fe' : seqLifelineColor(n.kind, i);
    if (n.kind === 'actor') {
      ctx.beginPath();
      ctx.arc(x, 22, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(x - 10, 32, 20, 12);
    } else {
      ctx.fillRect(x - 28, 14, 56, 28);
    }
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '11px sans-serif';
    ctx.fillText(n.name.slice(0, 12), x - 26, 58);
    ctx.strokeStyle = '#64748b';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(x, 66);
    ctx.lineTo(x, canvas.height - 12);
    ctx.stroke();
    ctx.setLineDash([]);
  });
  messages.forEach((m, i) => {
    const a = xs.get(m.source);
    const b = xs.get(m.target);
    if (a == null || b == null) return;
    const y = 78 + i * 32;
    ctx.strokeStyle = m.id === selectedId ? '#818cf8' : '#94a3b8';
    ctx.setLineDash(m.style === 'return' || m.style === 'async' ? [4, 4] : []);
    ctx.beginPath();
    ctx.moveTo(a, y);
    ctx.lineTo(b, y);
    ctx.stroke();
    ctx.setLineDash([]);
    const dir = b >= a ? 1 : -1;
    ctx.beginPath();
    ctx.moveTo(b, y);
    ctx.lineTo(b - 8 * dir, y - 4);
    ctx.lineTo(b - 8 * dir, y + 4);
    ctx.closePath();
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fill();
    if (m.label) {
      ctx.fillStyle = '#cbd5e1';
      ctx.font = '10px sans-serif';
      ctx.fillText(m.label.slice(0, 22), Math.min(a, b) + 8, y - 4);
    }
  });
}

export function renderSeqLifelines(canvas: HTMLCanvasElement, lifelines: SeqLifeline[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!lifelines.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No matching lifelines in this view.', 16, 28);
    return;
  }
  const rowH = Math.min(36, Math.max(22, (canvas.height - 24) / lifelines.length));
  lifelines.forEach((n, i) => {
    const y = 16 + i * rowH;
    if (n.id === selectedId) {
      ctx.fillStyle = 'rgba(67, 56, 202, 0.4)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = seqLifelineColor(n.kind, i);
    ctx.fillRect(16, y, 12, 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${n.name} · ${n.kind}`, 36, y + 11);
  });
}

export function renderSeqMessages(canvas: HTMLCanvasElement, messages: SeqMessage[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!messages.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No matching messages in this view.', 16, 28);
    return;
  }
  const rowH = Math.min(36, Math.max(22, (canvas.height - 24) / messages.length));
  messages.forEach((m, i) => {
    const y = 16 + i * rowH;
    if (m.id === selectedId) {
      ctx.fillStyle = 'rgba(67, 56, 202, 0.4)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = '#818cf8';
    ctx.fillRect(16, y, 8, 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${m.sourceName} → ${m.targetName}${m.label ? ` · ${m.label}` : ''}`, 32, y + 11);
  });
}
