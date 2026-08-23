import type { FmNode } from '../types/freemind-viewer.types';

export function fmDepthColor(depth: number): string {
  const colors = ['#fcd34d', '#fbbf24', '#fb923c', '#fdba74', '#86efac', '#7dd3fc', '#c4b5fd'];
  return colors[Math.max(0, depth) % colors.length];
}

export function renderFmDiagram(canvas: HTMLCanvasElement, nodes: FmNode[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!nodes.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No visible topics in this FreeMind map.', 16, 28);
    return;
  }
  const byId = new Map(nodes.map((n) => [n.id, n] as const));
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = '#64748b';
  for (const n of nodes) {
    if (!n.parentId) continue;
    const parent = byId.get(n.parentId);
    if (!parent) continue;
    ctx.beginPath();
    ctx.moveTo(parent.x + 70, parent.y + 12);
    ctx.lineTo(n.x, n.y + 12);
    ctx.stroke();
  }
  for (const n of nodes) {
    const w = Math.min(148, 52 + n.label.length * 7);
    ctx.fillStyle = n.id === selectedId ? '#fef3c7' : fmDepthColor(n.depth);
    roundRect(ctx, n.x, n.y, w, 28, 8);
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.font = '12px sans-serif';
    ctx.fillText(n.label.slice(0, 18), n.x + 8, n.y + 18);
    if (n.note) {
      ctx.fillStyle = '#92400e';
      ctx.font = '10px sans-serif';
      ctx.fillText('N', n.x + w - (n.childIds.length ? 24 : 12), n.y + 18);
    }
    if (n.childIds.length) {
      ctx.fillStyle = '#78350f';
      ctx.font = '11px sans-serif';
      ctx.fillText(n.collapsed ? '+' : '−', n.x + w - 12, n.y + 18);
    }
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}
