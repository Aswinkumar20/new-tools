import type { CadGeomEntity, CadViewTransform } from './cad-file.utils';
import { renderCadDrawing, resolveCadCanvasTheme } from './cad-file.utils';
import type { PbLayer, PbNet, PbTrace } from '../types/pcb-layout-viewer.types';

export function pbTypeColor(type: string, index: number): string {
  const t = type.toLowerCase();
  if (t === 'track') return '#22d3ee';
  if (t === 'via' || t === 'pad') return '#fbbf24';
  if (t === 'zone') return '#fb7185';
  if (t === 'text') return '#e2e8f0';
  if (t === 'ground') return '#4ade80';
  if (t === 'power') return '#f87171';
  if (t === 'signal') return '#a78bfa';
  if (t === 'copper') return '#f59e0b';
  if (t === 'silk') return '#e2e8f0';
  if (t === 'mask') return '#16a34a';
  if (t === 'layer' || t === 'stack') return '#67e8f9';
  if (t === 'net') return '#c4b5fd';
  const colors = ['#67e8f9', '#22d3ee', '#fbbf24', '#fb7185', '#a78bfa'];
  return colors[index % colors.length];
}

export function toCadGeom(traces: PbTrace[]): CadGeomEntity[] {
  return traces.map((t) => ({
    id: t.id,
    type: t.type === 'track' ? 'line' : t.type === 'via' || t.type === 'pad' ? 'circle' : t.type === 'zone' ? 'polyline' : t.type,
    layer: t.layer,
    colorHex: t.colorHex || pbTypeColor(t.type, t.index),
    x: t.x,
    y: t.y,
    x2: t.x2,
    y2: t.y2,
    r: t.r,
    text: t.text || t.name,
    points: t.points
  }));
}

export function renderPbPlot(
  canvas: HTMLCanvasElement,
  traces: PbTrace[],
  selectedId: string | null,
  view: CadViewTransform
): void {
  renderCadDrawing(canvas, toCadGeom(traces), selectedId, view, 'rgba(14, 116, 144, 0.35)');
}

export function renderPbStack(canvas: HTMLCanvasElement, layers: PbLayer[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const theme = resolveCadCanvasTheme();
  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!layers.length) {
    ctx.fillStyle = theme.muted;
    ctx.font = '13px sans-serif';
    ctx.fillText('No layer stack in this PCB dump.', 16, 28);
    return;
  }
  const visible = layers.slice(0, 24);
  const rowH = Math.min(28, Math.max(18, (canvas.height - 24) / visible.length));
  visible.forEach((layer, i) => {
    const y = 14 + i * rowH;
    if (layer.id === selectedId) {
      ctx.fillStyle = 'rgba(14, 116, 144, 0.55)';
      ctx.fillRect(8, y - 4, canvas.width - 16, rowH - 2);
    }
    ctx.fillStyle = layer.colorHex || pbTypeColor(layer.function, i);
    ctx.fillRect(16, y, 10, 10);
    ctx.fillStyle = theme.text;
    ctx.font = '12px sans-serif';
    ctx.fillText(`${layer.stackIndex} · ${layer.name} · ${layer.function} · ${layer.traceCount} traces`.slice(0, 84), 32, y + 10);
  });
}

export function renderPbNets(canvas: HTMLCanvasElement, nets: PbNet[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const theme = resolveCadCanvasTheme();
  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!nets.length) {
    ctx.fillStyle = theme.muted;
    ctx.font = '13px sans-serif';
    ctx.fillText('No nets in this PCB dump.', 16, 28);
    return;
  }
  const visible = nets.slice(0, 24);
  const rowH = Math.min(28, Math.max(18, (canvas.height - 24) / visible.length));
  visible.forEach((net, i) => {
    const y = 14 + i * rowH;
    if (net.id === selectedId) {
      ctx.fillStyle = 'rgba(14, 116, 144, 0.55)';
      ctx.fillRect(8, y - 4, canvas.width - 16, rowH - 2);
    }
    ctx.fillStyle = pbTypeColor(net.netClass, i);
    ctx.fillRect(16, y, 10, 10);
    ctx.fillStyle = theme.text;
    ctx.font = '12px sans-serif';
    ctx.fillText(`${net.name} · ${net.netClass} · ${net.traceCount} traces`.slice(0, 84), 32, y + 10);
  });
}

export function renderPbPreview(canvas: HTMLCanvasElement, rows: Array<Record<string, string>>, selectedIndex: number | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const theme = resolveCadCanvasTheme();
  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!rows.length) {
    ctx.fillStyle = theme.muted;
    ctx.font = '13px sans-serif';
    ctx.fillText('No preview rows in this PCB dump.', 16, 28);
    return;
  }
  const rowH = Math.min(36, Math.max(22, (canvas.height - 24) / rows.length));
  rows.forEach((row, i) => {
    const y = 16 + i * rowH;
    if (i === selectedIndex) {
      ctx.fillStyle = 'rgba(14, 116, 144, 0.55)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = pbTypeColor(row.type || 'other', i);
    ctx.fillRect(16, y, 8, 12);
    ctx.fillStyle = theme.text;
    ctx.font = '12px sans-serif';
    ctx.fillText(`${row.name || ''} · ${row.type || ''} · ${row.layer || ''} · ${row.net || ''}`.slice(0, 72), 32, y + 11);
  });
}
