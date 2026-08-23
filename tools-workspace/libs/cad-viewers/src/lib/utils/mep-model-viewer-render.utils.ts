import type { Cad3dSolid, Cad3dView } from './cad-3d.utils';
import { renderCad3d, resolveCadCanvasTheme } from './cad-3d.utils';
import type { MeDiscipline, MeElement } from '../types/mep-model-viewer.types';

export function meTypeColor(type: string, index: number): string {
  const t = type.toLowerCase();
  if (t === 'mechanical' || t === 'duct' || t === 'ahu') return '#34d399';
  if (t === 'electrical' || t === 'tray' || t === 'lighting') return '#fbbf24';
  if (t === 'plumbing' || t === 'pipe') return '#60a5fa';
  if (t === 'box') return '#6ee7b7';
  if (t === 'system' || t === 'discipline') return '#c4b5fd';
  const colors = ['#34d399', '#fbbf24', '#60a5fa', '#c4b5fd', '#38bdf8'];
  return colors[index % colors.length];
}

export function toMeCad3d(elements: MeElement[]): Cad3dSolid[] {
  return elements.map((e) => ({
    id: e.id,
    name: e.name,
    kind: e.kind,
    colorHex: e.colorHex || meTypeColor(String(e.discipline), e.index),
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

export function renderMePreview(canvas: HTMLCanvasElement, elements: MeElement[], selectedId: string | null, view: Cad3dView): void {
  renderCad3d(canvas, toMeCad3d(elements), selectedId, view, 'No MEP elements in this dump.');
}

export function renderMeDisciplines(canvas: HTMLCanvasElement, items: MeDiscipline[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const theme = resolveCadCanvasTheme();
  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!items.length) {
    ctx.fillStyle = theme.muted;
    ctx.font = '13px sans-serif';
    ctx.fillText('No MEP disciplines in this dump.', 16, 28);
    return;
  }
  const visible = items.slice(0, 24);
  const rowH = Math.min(28, Math.max(18, (canvas.height - 24) / visible.length));
  visible.forEach((item, i) => {
    const y = 14 + i * rowH;
    if (item.id === selectedId) {
      ctx.fillStyle = 'rgba(4, 120, 87, 0.55)';
      ctx.fillRect(8, y - 4, canvas.width - 16, rowH - 2);
    }
    ctx.fillStyle = meTypeColor(item.name, i);
    ctx.fillRect(16, y, 10, 10);
    ctx.fillStyle = theme.text;
    ctx.font = '12px sans-serif';
    ctx.fillText(`${item.name} · ${item.elementCount} elems · ${item.description || '—'}`.slice(0, 84), 32, y + 10);
  });
}
