import type { CadGeomEntity, CadViewTransform } from './cad-file.utils';
import { renderCadDrawing, resolveCadCanvasTheme } from './cad-file.utils';
import type { WfEntity, WfLayer, WfSheet } from '../types/dwf-viewer.types';

export function wfTypeColor(type: string, index: number): string {
  const t = type.toLowerCase();
  if (t === 'line') return '#c4b5fd';
  if (t === 'circle' || t === 'arc') return '#f0abfc';
  if (t === 'polyline' || t === 'lwpolyline') return '#fbbf24';
  if (t === 'text') return '#86efac';
  if (t === 'markup') return '#fb7185';
  if (t === 'sheet' || t === 'page') return '#e9d5ff';
  if (t === 'layer') return '#d8b4fe';
  const colors = ['#c4b5fd', '#a78bfa', '#f0abfc', '#86efac', '#fbbf24'];
  return colors[index % colors.length];
}

export function toCadGeom(entities: WfEntity[]): CadGeomEntity[] {
  return entities.map((e) => ({
    id: e.id,
    type: e.type === 'markup' ? 'text' : e.type,
    layer: e.layer,
    colorHex: e.colorHex || wfTypeColor(e.type, e.index),
    x: e.x,
    y: e.y,
    x2: e.x2,
    y2: e.y2,
    r: e.r,
    text: e.text || e.name,
    points: e.points
  }));
}

export function renderWfDrawing(
  canvas: HTMLCanvasElement,
  entities: WfEntity[],
  selectedId: string | null,
  view: CadViewTransform
): void {
  renderCadDrawing(canvas, toCadGeom(entities), selectedId, view, 'rgba(126, 34, 206, 0.35)');
}

export function renderWfSheets(canvas: HTMLCanvasElement, sheets: WfSheet[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const theme = resolveCadCanvasTheme();
  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!sheets.length) {
    ctx.fillStyle = theme.muted;
    ctx.font = '13px sans-serif';
    ctx.fillText('No published sheets in this DWF dump.', 16, 28);
    return;
  }
  const visible = sheets.slice(0, 24);
  const rowH = Math.min(28, Math.max(18, (canvas.height - 24) / visible.length));
  visible.forEach((sheet, i) => {
    const y = 14 + i * rowH;
    if (sheet.id === selectedId) {
      ctx.fillStyle = 'rgba(126, 34, 206, 0.55)';
      ctx.fillRect(8, y - 4, canvas.width - 16, rowH - 2);
    }
    ctx.fillStyle = wfTypeColor('sheet', i);
    ctx.fillRect(16, y, 10, 10);
    ctx.fillStyle = theme.text;
    ctx.font = '12px sans-serif';
    ctx.fillText(`${sheet.name} · ${sheet.width}×${sheet.height} · ${sheet.entityCount} ents`.slice(0, 84), 32, y + 10);
  });
}

export function renderWfLayers(canvas: HTMLCanvasElement, layers: WfLayer[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const theme = resolveCadCanvasTheme();
  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!layers.length) {
    ctx.fillStyle = theme.muted;
    ctx.font = '13px sans-serif';
    ctx.fillText('No layers in this DWF dump.', 16, 28);
    return;
  }
  const visible = layers.slice(0, 24);
  const rowH = Math.min(28, Math.max(18, (canvas.height - 24) / visible.length));
  visible.forEach((layer, i) => {
    const y = 14 + i * rowH;
    if (layer.id === selectedId) {
      ctx.fillStyle = 'rgba(126, 34, 206, 0.55)';
      ctx.fillRect(8, y - 4, canvas.width - 16, rowH - 2);
    }
    ctx.fillStyle = layer.colorHex || wfTypeColor('layer', i);
    ctx.fillRect(16, y, 10, 10);
    ctx.fillStyle = theme.text;
    ctx.font = '12px sans-serif';
    ctx.fillText(`${layer.name} · ${layer.entityCount} ents · ACI ${layer.color}`.slice(0, 84), 32, y + 10);
  });
}
