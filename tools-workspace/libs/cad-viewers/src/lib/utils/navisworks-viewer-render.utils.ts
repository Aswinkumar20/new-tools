import type { Cad3dSolid, Cad3dView } from './cad-3d.utils';
import { renderCad3d, resolveCadCanvasTheme } from './cad-3d.utils';
import type { NwItem, NwModel } from '../types/navisworks-viewer.types';

export function nwTypeColor(type: string, index: number): string {
  const t = type.toLowerCase();
  if (t === 'box' || t === 'architecture') return '#60a5fa';
  if (t === 'cylinder' || t === 'structure') return '#fbbf24';
  if (t === 'mep' || t === 'duct') return '#34d399';
  if (t === 'hard' || t === 'clash') return '#f87171';
  if (t === 'clearance' || t === 'model') return '#c4b5fd';
  const colors = ['#60a5fa', '#fbbf24', '#34d399', '#c4b5fd', '#38bdf8'];
  return colors[index % colors.length];
}

export function toNwCad3d(items: NwItem[]): Cad3dSolid[] {
  return items.map((e) => ({
    id: e.id,
    name: e.name,
    kind: e.kind,
    colorHex: e.colorHex || nwTypeColor(e.kind, e.index),
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

export function renderNwNavigate(canvas: HTMLCanvasElement, items: NwItem[], selectedId: string | null, view: Cad3dView): void {
  renderCad3d(canvas, toNwCad3d(items), selectedId, view, 'No Navisworks items in this dump.');
}

export function renderNwModels(canvas: HTMLCanvasElement, items: NwModel[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const theme = resolveCadCanvasTheme();
  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!items.length) {
    ctx.fillStyle = theme.muted;
    ctx.font = '13px sans-serif';
    ctx.fillText('No Navisworks models in this dump.', 16, 28);
    return;
  }
  const visible = items.slice(0, 24);
  const rowH = Math.min(28, Math.max(18, (canvas.height - 24) / visible.length));
  visible.forEach((item, i) => {
    const y = 14 + i * rowH;
    if (item.id === selectedId) {
      ctx.fillStyle = 'rgba(21, 94, 117, 0.55)';
      ctx.fillRect(8, y - 4, canvas.width - 16, rowH - 2);
    }
    ctx.fillStyle = nwTypeColor(item.name, i);
    ctx.fillRect(16, y, 10, 10);
    ctx.fillStyle = theme.text;
    ctx.font = '12px sans-serif';
    ctx.fillText(`${item.name} · ${item.itemCount} items · ${item.description || '—'}`.slice(0, 84), 32, y + 10);
  });
}
