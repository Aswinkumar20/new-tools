import type { Cad3dSolid, Cad3dView } from './cad-3d.utils';
import { renderCad3d, resolveCadCanvasTheme } from './cad-3d.utils';
import type { SkComponent, SkInstance, SkGroup } from '../types/sketchup-viewer.types';

export function skTypeColor(type: string, index: number): string {
  const t = type.toLowerCase();
  if (t === 'box' || t === 'group') return '#fb7185';
  if (t === 'cylinder') return '#f59e0b';
  if (t === 'sphere' || t === 'component') return '#34d399';
  if (t === 'instance') return '#38bdf8';
  const colors = ['#fb7185', '#f59e0b', '#34d399', '#38bdf8', '#c4b5fd'];
  return colors[index % colors.length];
}

export function toCad3dGroups(parts: SkGroup[]): Cad3dSolid[] {
  return parts.map((p) => ({
    id: p.id,
    name: p.name,
    kind: p.kind,
    colorHex: p.colorHex || skTypeColor(p.kind, p.index),
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

export function toCad3dInstances(parts: SkGroup[], instances: SkInstance[]): Cad3dSolid[] {
  if (!instances.length) return toCad3dGroups(parts);
  return instances.map((inst, i) => {
    const part = parts.find((p) => p.id === inst.group || p.name === inst.group);
    return {
      id: inst.id,
      name: inst.name,
      kind: part?.kind || 'box',
      colorHex: part?.colorHex || skTypeColor(part?.kind || 'instance', i),
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

export function renderSkGroups(canvas: HTMLCanvasElement, parts: SkGroup[], selectedId: string | null, view: Cad3dView): void {
  renderCad3d(canvas, toCad3dGroups(parts), selectedId, view, 'No SketchUp parts in this dump.');
}

export function renderSkInstances(
  canvas: HTMLCanvasElement,
  parts: SkGroup[],
  instances: SkInstance[],
  selectedId: string | null,
  view: Cad3dView
): void {
  renderCad3d(canvas, toCad3dInstances(parts, instances), selectedId, view, 'No SketchUp instances in this dump.');
}

export function renderSkComponents(canvas: HTMLCanvasElement, items: SkComponent[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const theme = resolveCadCanvasTheme();
  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!items.length) {
    ctx.fillStyle = theme.muted;
    ctx.font = '13px sans-serif';
    ctx.fillText('No SketchUp assemblies in this dump.', 16, 28);
    return;
  }
  const visible = items.slice(0, 24);
  const rowH = Math.min(28, Math.max(18, (canvas.height - 24) / visible.length));
  visible.forEach((item, i) => {
    const y = 14 + i * rowH;
    if (item.id === selectedId) {
      ctx.fillStyle = 'rgba(225, 29, 72, 0.55)';
      ctx.fillRect(8, y - 4, canvas.width - 16, rowH - 2);
    }
    ctx.fillStyle = skTypeColor('component', i);
    ctx.fillRect(16, y, 10, 10);
    ctx.fillStyle = theme.text;
    ctx.font = '12px sans-serif';
    ctx.fillText(`${item.name} · ${item.instanceCount} inst · ${item.description || '—'}`.slice(0, 84), 32, y + 10);
  });
}
