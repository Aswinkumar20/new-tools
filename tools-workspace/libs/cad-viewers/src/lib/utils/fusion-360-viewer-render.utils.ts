import type { Cad3dSolid, Cad3dView } from './cad-3d.utils';
import { renderCad3d, resolveCadCanvasTheme } from './cad-3d.utils';
import type { FuComponent, FuInstance, FuBody } from '../types/fusion-360-viewer.types';

export function fuTypeColor(type: string, index: number): string {
  const t = type.toLowerCase();
  if (t === 'box' || t === 'body') return '#2dd4bf';
  if (t === 'cylinder') return '#fb923c';
  if (t === 'sphere' || t === 'component') return '#34d399';
  if (t === 'instance') return '#38bdf8';
  const colors = ['#2dd4bf', '#fb923c', '#34d399', '#38bdf8', '#c4b5fd'];
  return colors[index % colors.length];
}

export function toCad3dBodies(parts: FuBody[]): Cad3dSolid[] {
  return parts.map((p) => ({
    id: p.id,
    name: p.name,
    kind: p.kind,
    colorHex: p.colorHex || fuTypeColor(p.kind, p.index),
    cx: p.cx,
    cy: p.cy,
    cz: p.cz,
    sx: p.sx,
    sy: p.sy,
    sz: p.sz,
    r: p.r,
    h: p.h
  }));
}

export function toCad3dInstances(parts: FuBody[], instances: FuInstance[]): Cad3dSolid[] {
  if (!instances.length) return toCad3dBodies(parts);
  return instances.map((inst, i) => {
    const part = parts.find((p) => p.id === inst.body || p.name === inst.body);
    return {
      id: inst.id,
      name: inst.name,
      kind: part?.kind || 'box',
      colorHex: part?.colorHex || fuTypeColor(part?.kind || 'instance', i),
      cx: inst.cx || part?.cx || 0,
      cy: inst.cy || part?.cy || 0,
      cz: inst.cz || part?.cz || 0,
      sx: part?.sx || 1,
      sy: part?.sy || 1,
      sz: part?.sz || 1,
      r: part?.r || 0,
      h: part?.h || 0
    };
  });
}

export function renderFuBodies(canvas: HTMLCanvasElement, parts: FuBody[], selectedId: string | null, view: Cad3dView): void {
  renderCad3d(canvas, toCad3dBodies(parts), selectedId, view, 'No Fusion bodies in this dump.');
}

export function renderFuInstances(
  canvas: HTMLCanvasElement,
  parts: FuBody[],
  instances: FuInstance[],
  selectedId: string | null,
  view: Cad3dView
): void {
  renderCad3d(canvas, toCad3dInstances(parts, instances), selectedId, view, 'No Fusion instances in this dump.');
}

export function renderFuComponents(canvas: HTMLCanvasElement, items: FuComponent[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const theme = resolveCadCanvasTheme();
  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!items.length) {
    ctx.fillStyle = theme.muted;
    ctx.font = '13px sans-serif';
    ctx.fillText('No Fusion components in this dump.', 16, 28);
    return;
  }
  const visible = items.slice(0, 24);
  const rowH = Math.min(28, Math.max(18, (canvas.height - 24) / visible.length));
  visible.forEach((item, i) => {
    const y = 14 + i * rowH;
    if (item.id === selectedId) {
      ctx.fillStyle = 'rgba(13, 148, 136, 0.55)';
      ctx.fillRect(8, y - 4, canvas.width - 16, rowH - 2);
    }
    ctx.fillStyle = fuTypeColor('component', i);
    ctx.fillRect(16, y, 10, 10);
    ctx.fillStyle = theme.text;
    ctx.font = '12px sans-serif';
    ctx.fillText(`${item.name} · ${item.instanceCount} inst · ${item.description || '—'}`.slice(0, 84), 32, y + 10);
  });
}
