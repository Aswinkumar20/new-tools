import type { CadGeomEntity, CadViewTransform } from './cad-file.utils';
import { renderCadDrawing, resolveCadCanvasTheme } from './cad-file.utils';
import type { AlCopper, AlDesignator, AlLayer } from '../types/altium-pcb-viewer.types';

export function alTypeColor(type: string, index: number): string {
  const t = type.toLowerCase();
  if (t === 'track') return '#22d3ee';
  if (t === 'via' || t === 'pad') return '#fbbf24';
  if (t === 'zone') return '#fb7185';
  if (t === 'designator' || t === 'component') return '#fdba74';
  if (t === 'text') return '#e2e8f0';
  if (t === 'ground') return '#4ade80';
  if (t === 'power') return '#f87171';
  if (t === 'signal') return '#c4b5fd';
  if (t === 'copper') return '#f59e0b';
  if (t === 'silk') return '#e2e8f0';
  if (t === 'mask') return '#16a34a';
  if (t === 'layer' || t === 'stack') return '#fdba74';
  if (t === 'net') return '#c4b5fd';
  const colors = ['#fdba74', '#22d3ee', '#fbbf24', '#fb7185', '#f59e0b'];
  return colors[index % colors.length];
}

function copperGeomType(type: string): CadGeomEntity['type'] {
  if (type === 'track') return 'line';
  if (type === 'via' || type === 'pad') return 'circle';
  if (type === 'zone') return 'polyline';
  return 'point';
}

export function toAlCopperGeom(items: AlCopper[]): CadGeomEntity[] {
  return items.map((t) => ({
    id: t.id,
    type: copperGeomType(t.type),
    layer: t.layer,
    colorHex: t.colorHex || alTypeColor(t.type, t.index),
    x: t.x,
    y: t.y,
    x2: t.x2,
    y2: t.y2,
    r: t.r,
    text: t.text || t.name,
    points: t.points
  }));
}

export function toAlDesGeom(items: AlDesignator[]): CadGeomEntity[] {
  return items.map((t) => ({
    id: t.id,
    type: 'text',
    layer: t.layer,
    colorHex: t.colorHex || alTypeColor(t.type, t.index),
    x: t.x,
    y: t.y,
    x2: t.x2,
    y2: t.y2,
    r: t.r,
    text: t.text || t.name,
    points: t.points
  }));
}

export function renderAlCopper(canvas: HTMLCanvasElement, items: AlCopper[], selectedId: string | null, view: CadViewTransform): void {
  renderCadDrawing(canvas, toAlCopperGeom(items), selectedId, view, 'rgba(180, 83, 9, 0.35)');
}

export function renderAlDes(canvas: HTMLCanvasElement, items: AlDesignator[], selectedId: string | null, view: CadViewTransform): void {
  renderCadDrawing(canvas, toAlDesGeom(items), selectedId, view, 'rgba(180, 83, 9, 0.35)');
}

export function renderAlStack(canvas: HTMLCanvasElement, layers: AlLayer[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const theme = resolveCadCanvasTheme();
  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!layers.length) {
    ctx.fillStyle = theme.muted;
    ctx.font = '13px sans-serif';
    ctx.fillText('No copper stack in this Altium dump.', 16, 28);
    return;
  }
  const visible = layers.slice(0, 24);
  const rowH = Math.min(28, Math.max(18, (canvas.height - 24) / visible.length));
  visible.forEach((layer, i) => {
    const y = 14 + i * rowH;
    if (layer.id === selectedId) {
      ctx.fillStyle = 'rgba(180, 83, 9, 0.55)';
      ctx.fillRect(8, y - 4, canvas.width - 16, rowH - 2);
    }
    ctx.fillStyle = layer.colorHex || alTypeColor(layer.function, i);
    ctx.fillRect(16, y, 10, 10);
    ctx.fillStyle = theme.text;
    ctx.font = '12px sans-serif';
    ctx.fillText(`${layer.stackIndex} · ${layer.name} · ${layer.function} · ${layer.itemCount} items`.slice(0, 84), 32, y + 10);
  });
}
