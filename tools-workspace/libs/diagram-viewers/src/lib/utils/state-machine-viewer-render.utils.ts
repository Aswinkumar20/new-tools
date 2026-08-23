import type { SmState, SmTransition } from '../types/state-machine-viewer.types';

export function smStateColor(kind: string, index: number): string {
  if (kind === 'initial') return '#67e8f9';
  if (kind === 'final') return '#6ee7b7';
  if (kind === 'parallel') return '#fcd34d';
  const colors = ['#7dd3fc', '#38bdf8', '#0ea5e9', '#bae6fd', '#0284c7'];
  return colors[index % colors.length];
}

export function renderSmDiagram(
  canvas: HTMLCanvasElement,
  states: SmState[],
  transitions: SmTransition[],
  selectedId: string | null
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!states.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No states in this state machine.', 16, 28);
    return;
  }
  const xs = states.map((s) => s.x);
  const ys = states.map((s) => s.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);
  const pad = 48;
  const mapX = (x: number) => pad + ((x - minX) / spanX) * (canvas.width - pad * 2);
  const mapY = (y: number) => pad + ((y - minY) / spanY) * (canvas.height - pad * 2);
  const pos = new Map(states.map((s) => [s.id, { x: mapX(s.x), y: mapY(s.y) }] as const));
  ctx.lineWidth = 1.4;
  for (const t of transitions) {
    const a = pos.get(t.source);
    const b = pos.get(t.target);
    if (!a || !b) continue;
    ctx.strokeStyle = '#64748b';
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.fillStyle = '#bae6fd';
    ctx.font = '10px sans-serif';
    ctx.fillText((t.event || 'ε').slice(0, 16), (a.x + b.x) / 2 - 10, (a.y + b.y) / 2 - 4);
  }
  states.forEach((s, i) => {
    const p = pos.get(s.id);
    if (!p) return;
    ctx.fillStyle = s.id === selectedId ? '#e0f2fe' : smStateColor(s.kind, i);
    if (s.kind === 'final') {
      ctx.fillRect(p.x - 60, p.y - 20, 120, 40);
      ctx.strokeStyle = '#0f172a';
      ctx.strokeRect(p.x - 54, p.y - 14, 108, 28);
    } else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, s.kind === 'initial' ? 22 : 20, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(s.name.slice(0, 14), p.x - 36, p.y + 4);
  });
}

export function renderSmStates(canvas: HTMLCanvasElement, states: SmState[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!states.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No matching states in this view.', 16, 28);
    return;
  }
  const rowH = Math.min(36, Math.max(22, (canvas.height - 24) / states.length));
  states.forEach((s, i) => {
    const y = 16 + i * rowH;
    if (s.id === selectedId) {
      ctx.fillStyle = 'rgba(7, 89, 133, 0.45)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = smStateColor(s.kind, i);
    ctx.fillRect(16, y, 12, 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${s.name} · ${s.kind}`, 36, y + 11);
  });
}

export function renderSmTransitions(canvas: HTMLCanvasElement, transitions: SmTransition[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!transitions.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No matching transitions in this view.', 16, 28);
    return;
  }
  const rowH = Math.min(36, Math.max(22, (canvas.height - 24) / transitions.length));
  transitions.forEach((t, i) => {
    const y = 16 + i * rowH;
    if (t.id === selectedId) {
      ctx.fillStyle = 'rgba(7, 89, 133, 0.45)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = '#7dd3fc';
    ctx.fillRect(16, y, 8, 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${t.sourceName} —${t.event || 'ε'}→ ${t.targetName}`, 32, y + 11);
  });
}
