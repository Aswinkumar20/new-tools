import type { Cad3dSolid, Cad3dView } from './cad-3d.utils';
import { renderCad3d, resolveCadCanvasTheme } from './cad-3d.utils';
import type { IgEntity, IgSurface } from '../types/iges-viewer.types';

export function igTypeColor(type: string, index: number): string {
  const t = type.toLowerCase();
  if (t === 'plane' || t === 'surface') return '#fbbf24';
  if (t === 'cylinder') return '#f59e0b';
  if (t === 'sphere' || t === 'nurbs') return '#34d399';
  if (t === 'line' || t === 'curve') return '#38bdf8';
  if (t === 'point') return '#c4b5fd';
  const colors = ['#fbbf24', '#f59e0b', '#34d399', '#38bdf8', '#c4b5fd'];
  return colors[index % colors.length];
}

export function toCad3dSurfaces(surfaces: IgSurface[]): Cad3dSolid[] {
  return surfaces.map((s) => ({
    id: s.id,
    name: s.name,
    kind: s.kind === 'nurbs' ? 'box' : s.kind,
    colorHex: s.colorHex || igTypeColor(s.kind, s.index),
    cx: s.cx,
    cy: s.cy,
    cz: s.cz,
    sx: s.sx || (s.kind === 'plane' ? 2 : 0),
    sy: s.sy || (s.kind === 'plane' ? 1.5 : 0),
    sz: s.sz,
    r: s.r,
    h: s.h
  }));
}

export function renderIgSurfaces(canvas: HTMLCanvasElement, surfaces: IgSurface[], selectedId: string | null, view: Cad3dView): void {
  renderCad3d(canvas, toCad3dSurfaces(surfaces), selectedId, view, 'No IGES surfaces in this dump.');
}

export function renderIgEntities(canvas: HTMLCanvasElement, entities: IgEntity[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const theme = resolveCadCanvasTheme();
  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!entities.length) {
    ctx.fillStyle = theme.muted;
    ctx.font = '13px sans-serif';
    ctx.fillText('No IGES entities in this dump.', 16, 28);
    return;
  }
  const visible = entities.slice(0, 24);
  const rowH = Math.min(28, Math.max(18, (canvas.height - 24) / visible.length));
  visible.forEach((item, i) => {
    const y = 14 + i * rowH;
    if (item.id === selectedId) {
      ctx.fillStyle = 'rgba(202, 138, 4, 0.55)';
      ctx.fillRect(8, y - 4, canvas.width - 16, rowH - 2);
    }
    ctx.fillStyle = igTypeColor(item.type, i);
    ctx.fillRect(16, y, 10, 10);
    ctx.fillStyle = theme.text;
    ctx.font = '12px sans-serif';
    ctx.fillText(`${item.name} · ${item.type} · ${item.surface || '—'}`.slice(0, 84), 32, y + 10);
  });
}
