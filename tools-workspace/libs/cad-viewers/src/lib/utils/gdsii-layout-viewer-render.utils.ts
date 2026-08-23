import type { CadGeomEntity, CadViewTransform } from './cad-file.utils';
import { renderCadDrawing, resolveCadCanvasTheme } from './cad-file.utils';
import type { GdFeature, GdLayer } from '../types/gdsii-layout-viewer.types';

export function gdTypeColor(type: string, index: number): string {
  const t = type.toLowerCase();
  if (t === 'path') return '#22d3ee';
  if (t === 'box' || t === 'contact') return '#fbbf24';
  if (t === 'boundary') return '#34d399';
  if (t === 'sref') return '#a78bfa';
  if (t === 'text') return '#e2e8f0';
  if (t === 'metal') return '#f59e0b';
  if (t === 'poly') return '#e2e8f0';
  if (t === 'well') return '#16a34a';
  if (t === 'layer' || t === 'stack') return '#5eead4';
  if (t === 'cell') return '#a78bfa';
  const colors = ['#5eead4', '#22d3ee', '#fbbf24', '#34d399', '#a78bfa'];
  return colors[index % colors.length];
}

function featGeomType(type: string): CadGeomEntity['type'] {
  if (type === 'path') return 'line';
  if (type === 'box') return 'circle';
  if (type === 'boundary') return 'polyline';
  if (type === 'text' || type === 'sref') return 'text';
  return 'point';
}

export function toGdFeatGeom(items: GdFeature[]): CadGeomEntity[] {
  return items.map((t) => ({
    id: t.id,
    type: featGeomType(t.type),
    layer: t.layer,
    colorHex: t.colorHex || gdTypeColor(t.type, t.index),
    x: t.x,
    y: t.y,
    x2: t.x2,
    y2: t.y2,
    r: t.r,
    text: t.text || t.name,
    points: t.points
  }));
}

export function renderGdPlot(canvas: HTMLCanvasElement, items: GdFeature[], selectedId: string | null, view: CadViewTransform): void {
  renderCadDrawing(canvas, toGdFeatGeom(items), selectedId, view, 'rgba(15, 118, 110, 0.35)');
}

export function renderGdStack(canvas: HTMLCanvasElement, layers: GdLayer[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const theme = resolveCadCanvasTheme();
  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!layers.length) {
    ctx.fillStyle = theme.muted;
    ctx.font = '13px sans-serif';
    ctx.fillText('No semiconductor layers in this GDSII dump.', 16, 28);
    return;
  }
  const visible = layers.slice(0, 24);
  const rowH = Math.min(28, Math.max(18, (canvas.height - 24) / visible.length));
  visible.forEach((layer, i) => {
    const y = 14 + i * rowH;
    if (layer.id === selectedId) {
      ctx.fillStyle = 'rgba(15, 118, 110, 0.55)';
      ctx.fillRect(8, y - 4, canvas.width - 16, rowH - 2);
    }
    ctx.fillStyle = layer.colorHex || gdTypeColor(layer.function, i);
    ctx.fillRect(16, y, 10, 10);
    ctx.fillStyle = theme.text;
    ctx.font = '12px sans-serif';
    ctx.fillText(`${layer.stackIndex} · L${layer.name} · ${layer.function} · ${layer.itemCount} items`.slice(0, 84), 32, y + 10);
  });
}
