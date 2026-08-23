import type { Cad3dSolid, Cad3dView } from './cad-3d.utils';
import { renderCad3d, resolveCadCanvasTheme } from './cad-3d.utils';
import type { BcItem, BcTest } from '../types/bim-clash-viewer.types';

export function bcTypeColor(type: string, index: number): string {
  const t = type.toLowerCase();
  if (t === 'hard' || t === 'clash') return '#f87171';
  if (t === 'clearance') return '#fb923c';
  if (t === 'box' || t === 'item') return '#c4b5fd';
  if (t === 'cylinder') return '#fbbf24';
  if (t === 'test') return '#e879f9';
  const colors = ['#f87171', '#c4b5fd', '#60a5fa', '#34d399', '#fbbf24'];
  return colors[index % colors.length];
}

export function toBcCad3d(items: BcItem[]): Cad3dSolid[] {
  return items.map((e) => ({
    id: e.id,
    name: e.name,
    kind: e.kind,
    colorHex: e.colorHex || bcTypeColor(e.kind, e.index),
    cx: e.cx,
    cy: e.cy,
    cz: e.cz,
    sx: e.sx,
    sy: e.sy,
    sz: e.sz,
    r: e.r,
    h: e.h
  }));
}

export function renderBcFocus(canvas: HTMLCanvasElement, items: BcItem[], selectedId: string | null, view: Cad3dView): void {
  renderCad3d(canvas, toBcCad3d(items), selectedId, view, 'No clash items to focus in this dump.');
}

export function renderBcTests(canvas: HTMLCanvasElement, items: BcTest[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const theme = resolveCadCanvasTheme();
  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!items.length) {
    ctx.fillStyle = theme.muted;
    ctx.font = '13px sans-serif';
    ctx.fillText('No clash tests in this dump.', 16, 28);
    return;
  }
  const visible = items.slice(0, 24);
  const rowH = Math.min(28, Math.max(18, (canvas.height - 24) / visible.length));
  visible.forEach((item, i) => {
    const y = 14 + i * rowH;
    if (item.id === selectedId) {
      ctx.fillStyle = 'rgba(192, 38, 211, 0.55)';
      ctx.fillRect(8, y - 4, canvas.width - 16, rowH - 2);
    }
    ctx.fillStyle = bcTypeColor(item.name, i);
    ctx.fillRect(16, y, 10, 10);
    ctx.fillStyle = theme.text;
    ctx.font = '12px sans-serif';
    ctx.fillText(`${item.name} · ${item.clashCount} clashes · ${item.description || '—'}`.slice(0, 84), 32, y + 10);
  });
}
