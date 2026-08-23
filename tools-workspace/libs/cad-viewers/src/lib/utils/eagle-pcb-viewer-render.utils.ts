import type { CadGeomEntity, CadViewTransform } from './cad-file.utils';
import { renderCadDrawing, resolveCadCanvasTheme } from './cad-file.utils';
import type { EgBoardItem, EgLayer, EgSchItem } from '../types/eagle-pcb-viewer.types';

export function egTypeColor(type: string, index: number): string {
  const t = type.toLowerCase();
  if (t === 'wire' || t === 'schwire') return '#22d3ee';
  if (t === 'via' || t === 'pad' || t === 'pin') return '#fbbf24';
  if (t === 'rect') return '#fb7185';
  if (t === 'instance') return '#fb923c';
  if (t === 'text' || t === 'label') return '#e2e8f0';
  if (t === 'ground') return '#4ade80';
  if (t === 'power') return '#f87171';
  if (t === 'signal') return '#c4b5fd';
  if (t === 'copper') return '#f59e0b';
  if (t === 'silk') return '#e2e8f0';
  if (t === 'mask') return '#16a34a';
  if (t === 'layer' || t === 'stack') return '#fdba74';
  if (t === 'net') return '#c4b5fd';
  if (t === 'board') return '#67e8f9';
  if (t === 'schematic') return '#fb923c';
  const colors = ['#fdba74', '#22d3ee', '#fbbf24', '#fb7185', '#fb923c'];
  return colors[index % colors.length];
}

function geomType(type: string): CadGeomEntity['type'] {
  if (type === 'wire' || type === 'schwire') return 'line';
  if (type === 'via' || type === 'pad' || type === 'pin') return 'circle';
  if (type === 'rect') return 'polyline';
  if (type === 'text' || type === 'label' || type === 'instance') return 'text';
  return 'point';
}

export function toEgBoardGeom(items: EgBoardItem[]): CadGeomEntity[] {
  return items.map((t) => ({
    id: t.id,
    type: geomType(t.type),
    layer: t.layer,
    colorHex: t.colorHex || egTypeColor(t.type, t.index),
    x: t.x,
    y: t.y,
    x2: t.x2,
    y2: t.y2,
    r: t.r,
    text: t.text || t.name,
    points: t.points
  }));
}

export function toEgSchGeom(items: EgSchItem[]): CadGeomEntity[] {
  return items.map((t) => ({
    id: t.id,
    type: geomType(t.type),
    layer: 'schematic',
    colorHex: t.colorHex || egTypeColor(t.type, t.index),
    x: t.x,
    y: t.y,
    x2: t.x2,
    y2: t.y2,
    r: t.r,
    text: t.text || t.name,
    points: t.points
  }));
}

export function renderEgBoard(
  canvas: HTMLCanvasElement,
  items: EgBoardItem[],
  selectedId: string | null,
  view: CadViewTransform
): void {
  renderCadDrawing(canvas, toEgBoardGeom(items), selectedId, view, 'rgba(234, 88, 12, 0.35)');
}

export function renderEgSch(
  canvas: HTMLCanvasElement,
  items: EgSchItem[],
  selectedId: string | null,
  view: CadViewTransform
): void {
  renderCadDrawing(canvas, toEgSchGeom(items), selectedId, view, 'rgba(234, 88, 12, 0.35)');
}

export function renderEgStack(canvas: HTMLCanvasElement, layers: EgLayer[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const theme = resolveCadCanvasTheme();
  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!layers.length) {
    ctx.fillStyle = theme.muted;
    ctx.font = '13px sans-serif';
    ctx.fillText('No layer stack in this Eagle dump.', 16, 28);
    return;
  }
  const visible = layers.slice(0, 24);
  const rowH = Math.min(28, Math.max(18, (canvas.height - 24) / visible.length));
  visible.forEach((layer, i) => {
    const y = 14 + i * rowH;
    if (layer.id === selectedId) {
      ctx.fillStyle = 'rgba(234, 88, 12, 0.55)';
      ctx.fillRect(8, y - 4, canvas.width - 16, rowH - 2);
    }
    ctx.fillStyle = layer.colorHex || egTypeColor(layer.function, i);
    ctx.fillRect(16, y, 10, 10);
    ctx.fillStyle = theme.text;
    ctx.font = '12px sans-serif';
    ctx.fillText(`${layer.stackIndex} · ${layer.name} · ${layer.function} · ${layer.itemCount} items`.slice(0, 84), 32, y + 10);
  });
}

export function renderEgPreview(canvas: HTMLCanvasElement, rows: Array<Record<string, string>>, selectedIndex: number | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const theme = resolveCadCanvasTheme();
  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!rows.length) {
    ctx.fillStyle = theme.muted;
    ctx.font = '13px sans-serif';
    ctx.fillText('No preview rows in this Eagle dump.', 16, 28);
    return;
  }
  const rowH = Math.min(36, Math.max(22, (canvas.height - 24) / rows.length));
  rows.forEach((row, i) => {
    const y = 16 + i * rowH;
    if (i === selectedIndex) {
      ctx.fillStyle = 'rgba(234, 88, 12, 0.55)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = egTypeColor(row.type || 'other', i);
    ctx.fillRect(16, y, 8, 12);
    ctx.fillStyle = theme.text;
    ctx.font = '12px sans-serif';
    ctx.fillText(`${row.name || ''} · ${row.type || ''} · ${row.layer || ''} · ${row.net || ''}`.slice(0, 72), 32, y + 11);
  });
}
