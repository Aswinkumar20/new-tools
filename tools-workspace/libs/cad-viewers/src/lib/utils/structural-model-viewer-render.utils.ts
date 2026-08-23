import type { Cad3dSolid, Cad3dView } from './cad-3d.utils';
import { renderCad3d, resolveCadCanvasTheme } from './cad-3d.utils';
import type { SrMember, SrSection } from '../types/structural-model-viewer.types';

export function srTypeColor(type: string, index: number): string {
  const t = type.toLowerCase();
  if (t === 'beam' || t === 'beams') return '#f59e0b';
  if (t === 'column' || t === 'columns') return '#60a5fa';
  if (t === 'slab' || t === 'slabs') return '#34d399';
  if (t === 'footing' || t === 'member') return '#f87171';
  if (t === 'box') return '#fbbf24';
  if (t === 'cylinder') return '#93c5fd';
  if (t === 'section' || t === 'property') return '#c4b5fd';
  const colors = ['#fbbf24', '#60a5fa', '#34d399', '#f87171', '#c4b5fd'];
  return colors[index % colors.length];
}

export function toSrCad3d(members: SrMember[]): Cad3dSolid[] {
  return members.map((m) => ({
    id: m.id,
    name: m.name,
    kind: m.kind,
    colorHex: m.colorHex || srTypeColor(m.memberType, m.index),
    cx: m.cx,
    cy: m.cy,
    cz: m.cz,
    sx: m.sx,
    sy: m.sy,
    sz: m.sz,
    r: m.r,
    h: m.h
  }));
}

export function renderSrPreview(canvas: HTMLCanvasElement, members: SrMember[], selectedId: string | null, view: Cad3dView): void {
  renderCad3d(canvas, toSrCad3d(members), selectedId, view, 'No structural members in this dump.');
}

export function renderSrSections(canvas: HTMLCanvasElement, items: SrSection[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const theme = resolveCadCanvasTheme();
  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!items.length) {
    ctx.fillStyle = theme.muted;
    ctx.font = '13px sans-serif';
    ctx.fillText('No structural sections in this dump.', 16, 28);
    return;
  }
  const visible = items.slice(0, 24);
  const rowH = Math.min(28, Math.max(18, (canvas.height - 24) / visible.length));
  visible.forEach((item, i) => {
    const y = 14 + i * rowH;
    if (item.id === selectedId) {
      ctx.fillStyle = 'rgba(161, 98, 7, 0.55)';
      ctx.fillRect(8, y - 4, canvas.width - 16, rowH - 2);
    }
    ctx.fillStyle = srTypeColor(item.name, i);
    ctx.fillRect(16, y, 10, 10);
    ctx.fillStyle = theme.text;
    ctx.font = '12px sans-serif';
    ctx.fillText(`${item.name} · ${item.memberCount} members · ${item.description || '—'}`.slice(0, 84), 32, y + 10);
  });
}
