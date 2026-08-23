import type { CadGeomEntity, CadViewTransform } from './cad-file.utils';
import { renderCadDrawing, resolveCadCanvasTheme } from './cad-file.utils';
import type { GbFeature, GbLayer } from '../types/gerber-file-viewer.types';

export function gbTypeColor(type: string, index: number): string {
  const t = type.toLowerCase();
  if (t === 'line') return '#4ade80';
  if (t === 'flash' || t === 'circle') return '#fbbf24';
  if (t === 'polygon') return '#fb7185';
  if (t === 'text') return '#e2e8f0';
  if (t === 'arc') return '#38bdf8';
  if (t === 'copper') return '#f59e0b';
  if (t === 'silk') return '#e2e8f0';
  if (t === 'mask') return '#16a34a';
  if (t === 'layer') return '#bbf7d0';
  const colors = ['#bbf7d0', '#4ade80', '#fbbf24', '#fb7185', '#38bdf8'];
  return colors[index % colors.length];
}

export function toCadGeom(features: GbFeature[]): CadGeomEntity[] {
  return features.map((f) => ({
    id: f.id,
    type: f.type === 'flash' ? 'circle' : f.type === 'polygon' ? 'polyline' : f.type,
    layer: f.layer,
    colorHex: f.colorHex || gbTypeColor(f.type, f.index),
    x: f.x,
    y: f.y,
    x2: f.x2,
    y2: f.y2,
    r: f.r,
    text: f.text || f.name,
    points: f.points
  }));
}

export function renderGbArtwork(
  canvas: HTMLCanvasElement,
  features: GbFeature[],
  selectedId: string | null,
  view: CadViewTransform
): void {
  renderCadDrawing(canvas, toCadGeom(features), selectedId, view, 'rgba(21, 128, 61, 0.35)');
}

export function renderGbLayers(canvas: HTMLCanvasElement, layers: GbLayer[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const theme = resolveCadCanvasTheme();
  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!layers.length) {
    ctx.fillStyle = theme.muted;
    ctx.font = '13px sans-serif';
    ctx.fillText('No layers in this Gerber dump.', 16, 28);
    return;
  }
  const visible = layers.slice(0, 24);
  const rowH = Math.min(28, Math.max(18, (canvas.height - 24) / visible.length));
  visible.forEach((layer, i) => {
    const y = 14 + i * rowH;
    if (layer.id === selectedId) {
      ctx.fillStyle = 'rgba(21, 128, 61, 0.55)';
      ctx.fillRect(8, y - 4, canvas.width - 16, rowH - 2);
    }
    ctx.fillStyle = layer.colorHex || gbTypeColor(layer.function, i);
    ctx.fillRect(16, y, 10, 10);
    ctx.fillStyle = theme.text;
    ctx.font = '12px sans-serif';
    ctx.fillText(`${layer.name} · ${layer.function} · ${layer.featureCount} feats`.slice(0, 84), 32, y + 10);
  });
}

export function renderGbPreview(canvas: HTMLCanvasElement, rows: Array<Record<string, string>>, selectedIndex: number | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const theme = resolveCadCanvasTheme();
  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!rows.length) {
    ctx.fillStyle = theme.muted;
    ctx.font = '13px sans-serif';
    ctx.fillText('No preview rows in this Gerber dump.', 16, 28);
    return;
  }
  const rowH = Math.min(36, Math.max(22, (canvas.height - 24) / rows.length));
  rows.forEach((row, i) => {
    const y = 16 + i * rowH;
    if (i === selectedIndex) {
      ctx.fillStyle = 'rgba(21, 128, 61, 0.55)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = gbTypeColor(row.type || 'other', i);
    ctx.fillRect(16, y, 8, 12);
    ctx.fillStyle = theme.text;
    ctx.font = '12px sans-serif';
    ctx.fillText(`${row.name || ''} · ${row.type || ''} · ${row.layer || ''}`.slice(0, 72), 32, y + 11);
  });
}
