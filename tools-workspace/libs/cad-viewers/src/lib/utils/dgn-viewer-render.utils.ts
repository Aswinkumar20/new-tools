import type { CadGeomEntity, CadViewTransform } from './cad-file.utils';
import { renderCadDrawing, resolveCadCanvasTheme } from './cad-file.utils';
import type { DgCivil, DgEntity, DgLayer } from '../types/dgn-viewer.types';

export function dgTypeColor(type: string, index: number): string {
  const t = type.toLowerCase();
  if (t === 'line') return '#5eead4';
  if (t === 'circle' || t === 'arc') return '#67e8f9';
  if (t === 'polyline' || t === 'lwpolyline') return '#fbbf24';
  if (t === 'text') return '#86efac';
  if (t === 'alignment') return '#2dd4bf';
  if (t === 'contour') return '#38bdf8';
  if (t === 'station' || t === 'parcel') return '#f0abfc';
  if (t === 'level' || t === 'layer') return '#99f6e4';
  const colors = ['#5eead4', '#2dd4bf', '#67e8f9', '#86efac', '#fbbf24'];
  return colors[index % colors.length];
}

export function toCadGeom(entities: DgEntity[], civil: DgCivil[] = []): CadGeomEntity[] {
  const fromEnts: CadGeomEntity[] = entities.map((e) => ({
    id: e.id,
    type: e.type,
    layer: e.level,
    colorHex: e.colorHex || dgTypeColor(e.type, e.index),
    x: e.x,
    y: e.y,
    x2: e.x2,
    y2: e.y2,
    r: e.r,
    text: e.text || e.name,
    points: e.points
  }));
  const fromCivil: CadGeomEntity[] = civil.map((c) => {
    const pts = c.points;
    const first = pts[0] || { x: 0, y: 0 };
    const last = pts[pts.length - 1] || first;
    const type = c.type === 'station' ? 'text' : pts.length > 2 ? 'polyline' : 'line';
    return {
      id: c.id,
      type,
      layer: c.level,
      colorHex: dgTypeColor(c.type, c.index),
      x: first.x,
      y: first.y,
      x2: last.x,
      y2: last.y,
      r: 0,
      text: c.label || c.name,
      points: pts
    };
  });
  return [...fromEnts, ...fromCivil];
}

export function renderDgDrawing(
  canvas: HTMLCanvasElement,
  entities: DgEntity[],
  civil: DgCivil[],
  selectedId: string | null,
  view: CadViewTransform
): void {
  renderCadDrawing(canvas, toCadGeom(entities, civil), selectedId, view, 'rgba(15, 118, 110, 0.35)');
}

export function renderDgLayers(canvas: HTMLCanvasElement, layers: DgLayer[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const theme = resolveCadCanvasTheme();
  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!layers.length) {
    ctx.fillStyle = theme.muted;
    ctx.font = '13px sans-serif';
    ctx.fillText('No levels in this DGN dump.', 16, 28);
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
    ctx.fillStyle = layer.colorHex || dgTypeColor('level', i);
    ctx.fillRect(16, y, 10, 10);
    ctx.fillStyle = theme.text;
    ctx.font = '12px sans-serif';
    ctx.fillText(`${layer.name} · ${layer.entityCount} ents · ACI ${layer.color}`.slice(0, 84), 32, y + 10);
  });
}

export function renderDgCivil(canvas: HTMLCanvasElement, items: DgCivil[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const theme = resolveCadCanvasTheme();
  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!items.length) {
    ctx.fillStyle = theme.muted;
    ctx.font = '13px sans-serif';
    ctx.fillText('No civil features in this DGN dump.', 16, 28);
    return;
  }
  const visible = items.slice(0, 24);
  const rowH = Math.min(28, Math.max(18, (canvas.height - 24) / visible.length));
  visible.forEach((item, i) => {
    const y = 14 + i * rowH;
    if (item.id === selectedId) {
      ctx.fillStyle = 'rgba(15, 118, 110, 0.55)';
      ctx.fillRect(8, y - 4, canvas.width - 16, rowH - 2);
    }
    ctx.fillStyle = dgTypeColor(item.type, i);
    ctx.fillRect(16, y, 10, 10);
    ctx.fillStyle = theme.text;
    ctx.font = '12px sans-serif';
    const extra = item.type === 'contour' ? `elev ${item.elevation}` : item.label;
    ctx.fillText(`${item.name} · ${item.type} · ${extra}`.slice(0, 84), 32, y + 10);
  });
}
