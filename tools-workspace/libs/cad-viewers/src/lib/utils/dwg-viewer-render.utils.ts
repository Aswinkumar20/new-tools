import type { CadGeomEntity, CadViewTransform } from './cad-file.utils';
import { renderCadDrawing, resolveCadCanvasTheme } from './cad-file.utils';
import type { DwEntity, DwLayer } from '../types/dwg-viewer.types';

export function dwTypeColor(type: string, index: number): string {
  const t = type.toLowerCase();
  if (t === 'line') return '#fb7185';
  if (t === 'circle' || t === 'arc') return '#38bdf8';
  if (t === 'polyline' || t === 'lwpolyline') return '#fbbf24';
  if (t === 'text') return '#4ade80';
  if (t === 'point' || t === 'insert') return '#c4b5fd';
  if (t === 'layer') return '#fdba74';
  if (t === 'distance' || t === 'angle' || t === 'area') return '#f472b6';
  const colors = ['#fdba74', '#fb7185', '#38bdf8', '#4ade80', '#c4b5fd'];
  return colors[index % colors.length];
}

export function toCadGeom(entities: DwEntity[]): CadGeomEntity[] {
  return entities.map((e) => ({
    id: e.id,
    type: e.type,
    layer: e.layer,
    colorHex: e.colorHex || dwTypeColor(e.type, e.index),
    x: e.x,
    y: e.y,
    x2: e.x2,
    y2: e.y2,
    r: e.r,
    text: e.text || e.name,
    points: e.points
  }));
}

export function renderDwDrawing(
  canvas: HTMLCanvasElement,
  entities: DwEntity[],
  selectedId: string | null,
  view: CadViewTransform
): void {
  renderCadDrawing(canvas, toCadGeom(entities), selectedId, view, 'rgba(194, 65, 12, 0.35)');
}

export function renderDwLayers(canvas: HTMLCanvasElement, layers: DwLayer[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const theme = resolveCadCanvasTheme();
  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!layers.length) {
    ctx.fillStyle = theme.muted;
    ctx.font = '13px sans-serif';
    ctx.fillText('No layers in this DWG dump.', 16, 28);
    return;
  }
  const visible = layers.slice(0, 24);
  const rowH = Math.min(28, Math.max(18, (canvas.height - 24) / visible.length));
  visible.forEach((layer, i) => {
    const y = 14 + i * rowH;
    if (layer.id === selectedId) {
      ctx.fillStyle = 'rgba(194, 65, 12, 0.55)';
      ctx.fillRect(8, y - 4, canvas.width - 16, rowH - 2);
    }
    ctx.fillStyle = layer.colorHex || dwTypeColor('layer', i);
    ctx.fillRect(16, y, 10, 10);
    ctx.fillStyle = theme.text;
    ctx.font = '12px sans-serif';
    ctx.fillText(`${layer.name} · ${layer.entityCount} ents · ACI ${layer.color}`.slice(0, 84), 32, y + 10);
  });
}

export function renderDwPreview(canvas: HTMLCanvasElement, rows: Array<Record<string, string>>, selectedIndex: number | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const theme = resolveCadCanvasTheme();
  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!rows.length) {
    ctx.fillStyle = theme.muted;
    ctx.font = '13px sans-serif';
    ctx.fillText('No preview rows in this DWG dump.', 16, 28);
    return;
  }
  const rowH = Math.min(36, Math.max(22, (canvas.height - 24) / rows.length));
  rows.forEach((row, i) => {
    const y = 16 + i * rowH;
    if (i === selectedIndex) {
      ctx.fillStyle = 'rgba(194, 65, 12, 0.55)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = dwTypeColor(row.type || 'other', i);
    ctx.fillRect(16, y, 8, 12);
    ctx.fillStyle = theme.text;
    ctx.font = '12px sans-serif';
    ctx.fillText(`${row.name || ''} · ${row.type || ''} · ${row.layer || ''}`.slice(0, 72), 32, y + 11);
  });
}
