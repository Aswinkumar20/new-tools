import type { Cad3dSolid, Cad3dView } from './cad-3d.utils';
import { renderCad3d, resolveCadCanvasTheme } from './cad-3d.utils';
import type { RvFamily, RvInstance } from '../types/revit-viewer.types';

export function rvTypeColor(type: string, index: number): string {
  const t = type.toLowerCase();
  if (t === 'box' || t === 'floors' || t === 'floor') return '#fb923c';
  if (t === 'cylinder' || t === 'columns' || t === 'column') return '#f87171';
  if (t === 'furniture' || t === 'family') return '#34d399';
  if (t === 'type' || t === 'generic') return '#38bdf8';
  if (t === 'instance' || t === 'walls') return '#c4b5fd';
  const colors = ['#fb923c', '#f87171', '#34d399', '#38bdf8', '#c4b5fd'];
  return colors[index % colors.length];
}

export function toRvCad3d(instances: RvInstance[]): Cad3dSolid[] {
  return instances.map((inst) => ({
    id: inst.id,
    name: inst.name,
    kind: inst.kind,
    colorHex: inst.colorHex || rvTypeColor(inst.kind, inst.index),
    cx: inst.cx,
    cy: inst.cy,
    cz: inst.cz,
    sx: inst.sx,
    sy: inst.sy,
    sz: inst.sz,
    r: inst.r,
    h: inst.h
  }));
}

export function renderRvNavigate(canvas: HTMLCanvasElement, instances: RvInstance[], selectedId: string | null, view: Cad3dView): void {
  renderCad3d(canvas, toRvCad3d(instances), selectedId, view, 'No Revit instances in this dump.');
}

export function renderRvFamilies(canvas: HTMLCanvasElement, items: RvFamily[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const theme = resolveCadCanvasTheme();
  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!items.length) {
    ctx.fillStyle = theme.muted;
    ctx.font = '13px sans-serif';
    ctx.fillText('No Revit families in this dump.', 16, 28);
    return;
  }
  const visible = items.slice(0, 24);
  const rowH = Math.min(28, Math.max(18, (canvas.height - 24) / visible.length));
  visible.forEach((item, i) => {
    const y = 14 + i * rowH;
    if (item.id === selectedId) {
      ctx.fillStyle = 'rgba(194, 65, 12, 0.55)';
      ctx.fillRect(8, y - 4, canvas.width - 16, rowH - 2);
    }
    ctx.fillStyle = rvTypeColor(item.category, i);
    ctx.fillRect(16, y, 10, 10);
    ctx.fillStyle = theme.text;
    ctx.font = '12px sans-serif';
    ctx.fillText(`${item.name} · ${item.category} · ${item.instanceCount} inst`.slice(0, 84), 32, y + 10);
  });
}
