import type { CadGeomEntity, CadViewTransform } from './cad-file.utils';
import { renderCadDrawing, resolveCadCanvasTheme } from './cad-file.utils';
import type { FpLevel, FpSpace } from '../types/building-floor-plan-viewer.types';

export function fpTypeColor(type: string, index: number): string {
  const t = type.toLowerCase();
  if (t === 'room' || t === 'lwpolyline') return '#38bdf8';
  if (t === 'column' || t === 'circle') return '#fbbf24';
  if (t === 'aisle' || t === 'line') return '#67e8f9';
  if (t === 'text') return '#4ade80';
  if (t === 'level') return '#c4b5fd';
  const colors = ['#67e8f9', '#38bdf8', '#fbbf24', '#4ade80', '#c4b5fd'];
  return colors[index % colors.length];
}

export function toFpCadGeom(spaces: FpSpace[]): CadGeomEntity[] {
  return spaces.map((e) => ({
    id: e.id,
    type: e.drawType,
    layer: e.level,
    colorHex: e.colorHex || fpTypeColor(e.kind, e.index),
    x: e.x,
    y: e.y,
    x2: e.x2,
    y2: e.y2,
    r: e.r,
    text: e.text || e.name,
    points: e.points
  }));
}

export function renderFpPlan(canvas: HTMLCanvasElement, spaces: FpSpace[], selectedId: string | null, view: CadViewTransform): void {
  renderCadDrawing(canvas, toFpCadGeom(spaces), selectedId, view, 'rgba(8, 145, 178, 0.35)');
}

export function renderFpLevels(canvas: HTMLCanvasElement, items: FpLevel[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const theme = resolveCadCanvasTheme();
  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!items.length) {
    ctx.fillStyle = theme.muted;
    ctx.font = '13px sans-serif';
    ctx.fillText('No levels in this floor-plan dump.', 16, 28);
    return;
  }
  const visible = items.slice(0, 24);
  const rowH = Math.min(28, Math.max(18, (canvas.height - 24) / visible.length));
  visible.forEach((item, i) => {
    const y = 14 + i * rowH;
    if (item.id === selectedId) {
      ctx.fillStyle = 'rgba(8, 145, 178, 0.55)';
      ctx.fillRect(8, y - 4, canvas.width - 16, rowH - 2);
    }
    ctx.fillStyle = fpTypeColor('level', i);
    ctx.fillRect(16, y, 10, 10);
    ctx.fillStyle = theme.text;
    ctx.font = '12px sans-serif';
    ctx.fillText(`${item.name} · z ${item.elevation} · ${item.roomCount} rooms · ${item.description || '—'}`.slice(0, 84), 32, y + 10);
  });
}
