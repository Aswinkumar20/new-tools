import type { CadGeomEntity, CadViewTransform } from './cad-file.utils';
import { renderCadDrawing, resolveCadCanvasTheme } from './cad-file.utils';
import type { DxEntity, DxLayer } from '../types/dxf-viewer.types';

export function dxTypeColor(type: string, index: number): string {
  const t = type.toLowerCase();
  if (t === 'line') return '#38bdf8';
  if (t === 'circle' || t === 'arc') return '#fbbf24';
  if (t === 'lwpolyline' || t === 'polyline') return '#fb7185';
  if (t === 'text') return '#4ade80';
  if (t === 'point' || t === 'insert') return '#c4b5fd';
  if (t === 'layer') return '#7dd3fc';
  const colors = ['#7dd3fc', '#38bdf8', '#fbbf24', '#4ade80', '#c4b5fd'];
  return colors[index % colors.length];
}

export function toCadGeom(entities: DxEntity[]): CadGeomEntity[] {
  return entities.map((e) => ({
    id: e.id,
    type: e.type,
    layer: e.layer,
    colorHex: e.colorHex || dxTypeColor(e.type, e.index),
    x: e.x,
    y: e.y,
    x2: e.x2,
    y2: e.y2,
    r: e.r,
    text: e.text || e.name,
    points: e.points
  }));
}

export function renderDxDrawing(
  canvas: HTMLCanvasElement,
  entities: DxEntity[],
  selectedId: string | null,
  view: CadViewTransform
): void {
  renderCadDrawing(canvas, toCadGeom(entities), selectedId, view, 'rgba(3, 105, 161, 0.35)');
}

export function renderDxLayers(canvas: HTMLCanvasElement, layers: DxLayer[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const theme = resolveCadCanvasTheme();
  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!layers.length) {
    ctx.fillStyle = theme.muted;
    ctx.font = '13px sans-serif';
    ctx.fillText('No layers in this DXF dump.', 16, 28);
    return;
  }
  const visible = layers.slice(0, 24);
  const rowH = Math.min(28, Math.max(18, (canvas.height - 24) / visible.length));
  visible.forEach((layer, i) => {
    const y = 14 + i * rowH;
    if (layer.id === selectedId) {
      ctx.fillStyle = 'rgba(3, 105, 161, 0.55)';
      ctx.fillRect(8, y - 4, canvas.width - 16, rowH - 2);
    }
    ctx.fillStyle = layer.colorHex || dxTypeColor('layer', i);
    ctx.fillRect(16, y, 10, 10);
    ctx.fillStyle = theme.text;
    ctx.font = '12px sans-serif';
    ctx.fillText(`${layer.name} · ${layer.entityCount} ents · ACI ${layer.color}`.slice(0, 84), 32, y + 10);
  });
}

export function renderDxPreview(canvas: HTMLCanvasElement, rows: Array<Record<string, string>>, selectedIndex: number | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const theme = resolveCadCanvasTheme();
  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!rows.length) {
    ctx.fillStyle = theme.muted;
    ctx.font = '13px sans-serif';
    ctx.fillText('No preview rows in this DXF dump.', 16, 28);
    return;
  }
  const rowH = Math.min(36, Math.max(22, (canvas.height - 24) / rows.length));
  rows.forEach((row, i) => {
    const y = 16 + i * rowH;
    if (i === selectedIndex) {
      ctx.fillStyle = 'rgba(3, 105, 161, 0.55)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = dxTypeColor(row.type || 'other', i);
    ctx.fillRect(16, y, 8, 12);
    ctx.fillStyle = theme.text;
    ctx.font = '12px sans-serif';
    ctx.fillText(`${row.name || ''} · ${row.type || ''} · ${row.layer || ''}`.slice(0, 72), 32, y + 11);
  });
}
