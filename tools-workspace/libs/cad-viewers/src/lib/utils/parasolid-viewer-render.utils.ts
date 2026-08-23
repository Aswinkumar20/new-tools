import type { Cad3dSolid, Cad3dView } from './cad-3d.utils';
import { renderCad3d, resolveCadCanvasTheme } from './cad-3d.utils';
import type { PxMeasurement, PxSolid } from '../types/parasolid-viewer.types';

export function pxTypeColor(type: string, index: number): string {
  const t = type.toLowerCase();
  if (t === 'box' || t === 'solid' || t === 'body') return '#818cf8';
  if (t === 'cylinder') return '#38bdf8';
  if (t === 'sphere') return '#34d399';
  if (t === 'plane') return '#c4b5fd';
  if (t === 'distance' || t === 'volume' || t === 'angle') return '#fbbf24';
  const colors = ['#818cf8', '#38bdf8', '#34d399', '#fbbf24', '#c4b5fd'];
  return colors[index % colors.length];
}

export function toCad3dSolids(solids: PxSolid[]): Cad3dSolid[] {
  return solids.map((s) => ({
    id: s.id,
    name: s.name,
    kind: s.kind,
    colorHex: s.colorHex || pxTypeColor(s.kind, s.index),
    cx: s.cx,
    cy: s.cy,
    cz: s.cz,
    sx: s.sx,
    sy: s.sy,
    sz: s.sz,
    r: s.r,
    h: s.h
  }));
}

export function renderPxSolids(canvas: HTMLCanvasElement, solids: PxSolid[], selectedId: string | null, view: Cad3dView): void {
  renderCad3d(canvas, toCad3dSolids(solids), selectedId, view, 'No Parasolid solids in this dump.');
}

export function renderPxMeasurements(canvas: HTMLCanvasElement, items: PxMeasurement[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const theme = resolveCadCanvasTheme();
  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!items.length) {
    ctx.fillStyle = theme.muted;
    ctx.font = '13px sans-serif';
    ctx.fillText('No measurements in this Parasolid dump.', 16, 28);
    return;
  }
  const visible = items.slice(0, 24);
  const rowH = Math.min(28, Math.max(18, (canvas.height - 24) / visible.length));
  visible.forEach((item, i) => {
    const y = 14 + i * rowH;
    if (item.id === selectedId) {
      ctx.fillStyle = 'rgba(67, 56, 202, 0.55)';
      ctx.fillRect(8, y - 4, canvas.width - 16, rowH - 2);
    }
    ctx.fillStyle = pxTypeColor(item.type, i);
    ctx.fillRect(16, y, 10, 10);
    ctx.fillStyle = theme.text;
    ctx.font = '12px sans-serif';
    ctx.fillText(`${item.name} · ${item.label || item.value} ${item.unit}`.slice(0, 84), 32, y + 10);
  });
}
