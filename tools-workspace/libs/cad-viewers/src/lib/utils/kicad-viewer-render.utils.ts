import type { CadGeomEntity, CadViewTransform } from './cad-file.utils';
import { renderCadDrawing, resolveCadCanvasTheme } from './cad-file.utils';
import type { KcBoardItem, KcLayer, KcSchItem } from '../types/kicad-viewer.types';

export function kcTypeColor(type: string, index: number): string {
  const t = type.toLowerCase();
  if (t === 'track' || t === 'wire') return '#22d3ee';
  if (t === 'via' || t === 'pad' || t === 'pin') return '#fbbf24';
  if (t === 'zone') return '#fb7185';
  if (t === 'footprint' || t === 'symbol') return '#a78bfa';
  if (t === 'text' || t === 'label') return '#e2e8f0';
  if (t === 'ground') return '#4ade80';
  if (t === 'power') return '#f87171';
  if (t === 'signal') return '#c4b5fd';
  if (t === 'copper') return '#f59e0b';
  if (t === 'silk') return '#e2e8f0';
  if (t === 'mask') return '#16a34a';
  if (t === 'layer' || t === 'stack') return '#818cf8';
  if (t === 'net') return '#c4b5fd';
  if (t === 'board') return '#67e8f9';
  if (t === 'schematic') return '#a78bfa';
  const colors = ['#818cf8', '#22d3ee', '#fbbf24', '#fb7185', '#a78bfa'];
  return colors[index % colors.length];
}

function geomType(type: string): CadGeomEntity['type'] {
  if (type === 'track' || type === 'wire') return 'line';
  if (type === 'via' || type === 'pad' || type === 'pin') return 'circle';
  if (type === 'zone') return 'polyline';
  if (type === 'text' || type === 'label' || type === 'footprint' || type === 'symbol' || type === 'power') return 'text';
  return 'point';
}

export function toKcBoardGeom(items: KcBoardItem[]): CadGeomEntity[] {
  return items.map((t) => ({
    id: t.id,
    type: geomType(t.type),
    layer: t.layer,
    colorHex: t.colorHex || kcTypeColor(t.type, t.index),
    x: t.x,
    y: t.y,
    x2: t.x2,
    y2: t.y2,
    r: t.r,
    text: t.text || t.name,
    points: t.points
  }));
}

export function toKcSchGeom(items: KcSchItem[]): CadGeomEntity[] {
  return items.map((t) => ({
    id: t.id,
    type: geomType(t.type),
    layer: 'schematic',
    colorHex: t.colorHex || kcTypeColor(t.type, t.index),
    x: t.x,
    y: t.y,
    x2: t.x2,
    y2: t.y2,
    r: t.r,
    text: t.text || t.name,
    points: t.points
  }));
}

export function renderKcBoard(
  canvas: HTMLCanvasElement,
  items: KcBoardItem[],
  selectedId: string | null,
  view: CadViewTransform
): void {
  renderCadDrawing(canvas, toKcBoardGeom(items), selectedId, view, 'rgba(79, 70, 229, 0.35)');
}

export function renderKcSch(
  canvas: HTMLCanvasElement,
  items: KcSchItem[],
  selectedId: string | null,
  view: CadViewTransform
): void {
  renderCadDrawing(canvas, toKcSchGeom(items), selectedId, view, 'rgba(79, 70, 229, 0.35)');
}

export function renderKcStack(canvas: HTMLCanvasElement, layers: KcLayer[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const theme = resolveCadCanvasTheme();
  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!layers.length) {
    ctx.fillStyle = theme.muted;
    ctx.font = '13px sans-serif';
    ctx.fillText('No layer stack in this KiCad dump.', 16, 28);
    return;
  }
  const visible = layers.slice(0, 24);
  const rowH = Math.min(28, Math.max(18, (canvas.height - 24) / visible.length));
  visible.forEach((layer, i) => {
    const y = 14 + i * rowH;
    if (layer.id === selectedId) {
      ctx.fillStyle = 'rgba(79, 70, 229, 0.55)';
      ctx.fillRect(8, y - 4, canvas.width - 16, rowH - 2);
    }
    ctx.fillStyle = layer.colorHex || kcTypeColor(layer.function, i);
    ctx.fillRect(16, y, 10, 10);
    ctx.fillStyle = theme.text;
    ctx.font = '12px sans-serif';
    ctx.fillText(`${layer.stackIndex} · ${layer.name} · ${layer.function} · ${layer.itemCount} items`.slice(0, 84), 32, y + 10);
  });
}

export function renderKcPreview(canvas: HTMLCanvasElement, rows: Array<Record<string, string>>, selectedIndex: number | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const theme = resolveCadCanvasTheme();
  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!rows.length) {
    ctx.fillStyle = theme.muted;
    ctx.font = '13px sans-serif';
    ctx.fillText('No preview rows in this KiCad dump.', 16, 28);
    return;
  }
  const rowH = Math.min(36, Math.max(22, (canvas.height - 24) / rows.length));
  rows.forEach((row, i) => {
    const y = 16 + i * rowH;
    if (i === selectedIndex) {
      ctx.fillStyle = 'rgba(79, 70, 229, 0.55)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = kcTypeColor(row.type || 'other', i);
    ctx.fillRect(16, y, 8, 12);
    ctx.fillStyle = theme.text;
    ctx.font = '12px sans-serif';
    ctx.fillText(`${row.name || ''} · ${row.type || ''} · ${row.layer || ''} · ${row.net || ''}`.slice(0, 72), 32, y + 11);
  });
}
