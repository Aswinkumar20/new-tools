import type { Cad3dSolid, Cad3dView } from './cad-3d.utils';
import { renderCad3d, resolveCadCanvasTheme } from './cad-3d.utils';
import type { IcDiscipline, IcElement } from '../types/ifc-viewer.types';

export function icTypeColor(type: string, index: number): string {
  const t = type.toLowerCase();
  if (t === 'box' || t === 'ifcslab' || t === 'ifcwall' || t === 'architecture') return '#60a5fa';
  if (t === 'cylinder' || t === 'ifccolumn' || t === 'structure') return '#fbbf24';
  if (t === 'ifcflowsegment' || t === 'mep') return '#34d399';
  if (t === 'ifcfurnishingelement' || t === 'property') return '#c4b5fd';
  if (t === 'discipline') return '#38bdf8';
  const colors = ['#60a5fa', '#fbbf24', '#34d399', '#c4b5fd', '#38bdf8'];
  return colors[index % colors.length];
}

export function toIcCad3d(elements: IcElement[]): Cad3dSolid[] {
  return elements.map((e) => ({
    id: e.id,
    name: e.name,
    kind: e.kind,
    colorHex: e.colorHex || icTypeColor(e.kind, e.index),
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

export function renderIcBuilding(canvas: HTMLCanvasElement, elements: IcElement[], selectedId: string | null, view: Cad3dView): void {
  renderCad3d(canvas, toIcCad3d(elements), selectedId, view, 'No IFC elements in this dump.');
}

export function renderIcDisciplines(canvas: HTMLCanvasElement, items: IcDiscipline[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const theme = resolveCadCanvasTheme();
  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!items.length) {
    ctx.fillStyle = theme.muted;
    ctx.font = '13px sans-serif';
    ctx.fillText('No IFC disciplines in this dump.', 16, 28);
    return;
  }
  const visible = items.slice(0, 24);
  const rowH = Math.min(28, Math.max(18, (canvas.height - 24) / visible.length));
  visible.forEach((item, i) => {
    const y = 14 + i * rowH;
    if (item.id === selectedId) {
      ctx.fillStyle = 'rgba(30, 64, 175, 0.55)';
      ctx.fillRect(8, y - 4, canvas.width - 16, rowH - 2);
    }
    ctx.fillStyle = icTypeColor(item.name, i);
    ctx.fillRect(16, y, 10, 10);
    ctx.fillStyle = theme.text;
    ctx.font = '12px sans-serif';
    ctx.fillText(`${item.name} · ${item.elementCount} elems · ${item.description || '—'}`.slice(0, 84), 32, y + 10);
  });
}
