import type { Cad3dSolid, Cad3dView } from './cad-3d.utils';
import { renderCad3d, resolveCadCanvasTheme } from './cad-3d.utils';
import type { SwAssembly, SwInstance, SwPart } from '../types/solidworks-viewer.types';

export function swTypeColor(type: string, index: number): string {
  const t = type.toLowerCase();
  if (t === 'box' || t === 'part') return '#fb923c';
  if (t === 'cylinder') return '#fb923c';
  if (t === 'sphere' || t === 'assembly') return '#34d399';
  if (t === 'instance') return '#38bdf8';
  const colors = ['#fb923c', '#fb923c', '#34d399', '#38bdf8', '#c4b5fd'];
  return colors[index % colors.length];
}

export function toCad3dParts(parts: SwPart[]): Cad3dSolid[] {
  return parts.map((p) => ({
    id: p.id,
    name: p.name,
    kind: p.kind,
    colorHex: p.colorHex || swTypeColor(p.kind, p.index),
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

export function toCad3dInstances(parts: SwPart[], instances: SwInstance[]): Cad3dSolid[] {
  if (!instances.length) return toCad3dParts(parts);
  return instances.map((inst, i) => {
    const part = parts.find((p) => p.id === inst.part || p.name === inst.part);
    return {
      id: inst.id,
      name: inst.name,
      kind: part?.kind || 'box',
      colorHex: part?.colorHex || swTypeColor(part?.kind || 'instance', i),
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

export function renderSwParts(canvas: HTMLCanvasElement, parts: SwPart[], selectedId: string | null, view: Cad3dView): void {
  renderCad3d(canvas, toCad3dParts(parts), selectedId, view, 'No SolidWorks parts in this dump.');
}

export function renderSwInstances(
  canvas: HTMLCanvasElement,
  parts: SwPart[],
  instances: SwInstance[],
  selectedId: string | null,
  view: Cad3dView
): void {
  renderCad3d(canvas, toCad3dInstances(parts, instances), selectedId, view, 'No SolidWorks instances in this dump.');
}

export function renderSwAssemblies(canvas: HTMLCanvasElement, items: SwAssembly[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const theme = resolveCadCanvasTheme();
  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!items.length) {
    ctx.fillStyle = theme.muted;
    ctx.font = '13px sans-serif';
    ctx.fillText('No SolidWorks assemblies in this dump.', 16, 28);
    return;
  }
  const visible = items.slice(0, 24);
  const rowH = Math.min(28, Math.max(18, (canvas.height - 24) / visible.length));
  visible.forEach((item, i) => {
    const y = 14 + i * rowH;
    if (item.id === selectedId) {
      ctx.fillStyle = 'rgba(217, 119, 6, 0.55)';
      ctx.fillRect(8, y - 4, canvas.width - 16, rowH - 2);
    }
    ctx.fillStyle = swTypeColor('assembly', i);
    ctx.fillRect(16, y, 10, 10);
    ctx.fillStyle = theme.text;
    ctx.font = '12px sans-serif';
    ctx.fillText(`${item.name} · ${item.instanceCount} inst · ${item.description || '—'}`.slice(0, 84), 32, y + 10);
  });
}
