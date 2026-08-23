import type { FpIconGroup, FpNode } from '../types/freeplane-viewer.types';

export function fpDepthColor(depth: number): string {
  const colors = ['#93c5fd', '#60a5fa', '#38bdf8', '#818cf8', '#a5b4fc', '#c4b5fd', '#f9a8d4'];
  return colors[Math.max(0, depth) % colors.length];
}

export function fpIconColor(index: number): string {
  const colors = ['#93c5fd', '#fbbf24', '#86efac', '#f9a8d4', '#fdba74', '#c4b5fd', '#7dd3fc', '#fca5a5'];
  return colors[index % colors.length];
}

export function renderFpDiagram(canvas: HTMLCanvasElement, nodes: FpNode[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!nodes.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No visible nodes in this Freeplane map.', 16, 28);
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
    ctx.moveTo(parent.x + 78, parent.y + 14);
    ctx.lineTo(n.x, n.y + 14);
    ctx.stroke();
  }
  for (const n of nodes) {
    const w = Math.min(160, 56 + n.label.length * 7);
    ctx.fillStyle = n.id === selectedId ? '#dbeafe' : n.color || fpDepthColor(n.depth);
    roundRect(ctx, n.x, n.y, w, 30, 8);
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.font = '12px sans-serif';
    ctx.fillText(n.label.slice(0, 16), n.x + 8, n.y + 19);
    if (n.icons.length) {
      ctx.fillStyle = '#1e3a8a';
      ctx.font = '10px sans-serif';
      ctx.fillText(n.icons[0].slice(0, 8), n.x + 8, n.y + 42);
    }
    if (n.childIds.length) {
      ctx.fillStyle = '#1e3a8a';
      ctx.font = '11px sans-serif';
      ctx.fillText(n.collapsed ? '+' : '−', n.x + w - 12, n.y + 19);
    }
  }
}

export function renderFpIcons(canvas: HTMLCanvasElement, icons: FpIconGroup[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!icons.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No icons in this Freeplane map.', 16, 28);
    return;
  }
  const colW = Math.max(120, (canvas.width - 40) / Math.min(icons.length, 4));
  icons.forEach((icon, i) => {
    const x = 20 + (i % 4) * colW;
    const y = 28 + Math.floor(i / 4) * 70;
    ctx.fillStyle = icon.id === selectedId || icon.name === selectedId ? '#dbeafe' : fpIconColor(i);
    ctx.fillRect(x, y, colW - 16, 52);
    ctx.fillStyle = '#0f172a';
    ctx.font = '12px sans-serif';
    ctx.fillText(icon.name.slice(0, 16), x + 8, y + 22);
    ctx.fillText(`${icon.count} nodes`, x + 8, y + 40);
  });
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
