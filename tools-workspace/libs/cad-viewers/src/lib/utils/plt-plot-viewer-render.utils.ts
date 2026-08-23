import type { CadGeomEntity, CadViewTransform } from './cad-file.utils';
import { renderCadDrawing, resolveCadCanvasTheme } from './cad-file.utils';
import type { PlCommand, PlPen } from '../types/plt-plot-viewer.types';

export function plTypeColor(type: string, index: number): string {
  const t = type.toLowerCase();
  if (t === 'line') return '#a8a29e';
  if (t === 'circle' || t === 'arc') return '#fbbf24';
  if (t === 'polyline') return '#fb7185';
  if (t === 'text') return '#4ade80';
  if (t === 'point') return '#c4b5fd';
  if (t === 'pen') return '#d6d3d1';
  const colors = ['#d6d3d1', '#a8a29e', '#fbbf24', '#4ade80', '#c4b5fd'];
  return colors[index % colors.length];
}

export function toCadGeom(commands: PlCommand[]): CadGeomEntity[] {
  return commands.map((c) => ({
    id: c.id,
    type: c.type,
    layer: c.pen,
    colorHex: c.colorHex || plTypeColor(c.type, c.index),
    x: c.x,
    y: c.y,
    x2: c.x2,
    y2: c.y2,
    r: c.r,
    text: c.text || c.name,
    points: c.points
  }));
}

export function renderPlPlot(
  canvas: HTMLCanvasElement,
  commands: PlCommand[],
  selectedId: string | null,
  view: CadViewTransform
): void {
  renderCadDrawing(canvas, toCadGeom(commands), selectedId, view, 'rgba(87, 83, 78, 0.35)');
}

export function renderPlPens(canvas: HTMLCanvasElement, pens: PlPen[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const theme = resolveCadCanvasTheme();
  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!pens.length) {
    ctx.fillStyle = theme.muted;
    ctx.font = '13px sans-serif';
    ctx.fillText('No pens in this PLT dump.', 16, 28);
    return;
  }
  const visible = pens.slice(0, 24);
  const rowH = Math.min(28, Math.max(18, (canvas.height - 24) / visible.length));
  visible.forEach((pen, i) => {
    const y = 14 + i * rowH;
    if (pen.id === selectedId) {
      ctx.fillStyle = 'rgba(87, 83, 78, 0.55)';
      ctx.fillRect(8, y - 4, canvas.width - 16, rowH - 2);
    }
    ctx.fillStyle = pen.colorHex || plTypeColor('pen', i);
    ctx.fillRect(16, y, 10, 10);
    ctx.fillStyle = theme.text;
    ctx.font = '12px sans-serif';
    ctx.fillText(`${pen.name} · ${pen.commandCount} cmds · pen ${pen.color}`.slice(0, 84), 32, y + 10);
  });
}

export function renderPlPreview(canvas: HTMLCanvasElement, rows: Array<Record<string, string>>, selectedIndex: number | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const theme = resolveCadCanvasTheme();
  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!rows.length) {
    ctx.fillStyle = theme.muted;
    ctx.font = '13px sans-serif';
    ctx.fillText('No preview rows in this PLT dump.', 16, 28);
    return;
  }
  const rowH = Math.min(36, Math.max(22, (canvas.height - 24) / rows.length));
  rows.forEach((row, i) => {
    const y = 16 + i * rowH;
    if (i === selectedIndex) {
      ctx.fillStyle = 'rgba(87, 83, 78, 0.55)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = plTypeColor(row.type || 'other', i);
    ctx.fillRect(16, y, 8, 12);
    ctx.fillStyle = theme.text;
    ctx.font = '12px sans-serif';
    ctx.fillText(`${row.name || ''} · ${row.type || ''} · ${row.pen || ''}`.slice(0, 72), 32, y + 11);
  });
}
