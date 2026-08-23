import type { KsLayer, KsShape } from '../types/keras-model-viewer.types';

export function ksTypeColor(type: string, index: number): string {
  const t = type.toUpperCase();
  if (t === 'DENSE' || t === 'LINEAR' || t === 'GEMM') return '#f9a8d4';
  if (t === 'RELU' || t === 'SIGMOID' || t === 'TANH' || t === 'GELU') return '#fbcfe8';
  if (t === 'SOFTMAX' || t === 'LOGSOFTMAX') return '#f472b6';
  if (t === 'CONV' || t === 'CONV2D') return '#db2777';
  if (t === 'INPUTLAYER' || t === 'INPUT') return '#67e8f9';
  if (t === 'WEIGHT' || t === 'KERNEL') return '#fdba74';
  if (t === 'BIAS') return '#67e8f9';
  if (t === 'OUTPUT') return '#f9a8d4';
  if (t === 'FLOAT32' || t === 'FLOAT' || t === 'FLOAT16') return '#f9a8d4';
  const colors = ['#f472b6', '#db2777', '#be185d', '#f9a8d4', '#fbcfe8'];
  return colors[index % colors.length];
}

export function renderKsLayers(canvas: HTMLCanvasElement, layers: KsLayer[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!layers.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No layers in this Keras model.', 16, 28);
    return;
  }
  const visible = layers.slice(0, 12);
  const gap = 16;
  const boxW = Math.max(72, (canvas.width - 32 - gap * (visible.length - 1)) / visible.length);
  const boxH = Math.min(64, canvas.height - 36);
  const y = 18;
  visible.forEach((layer, i) => {
    const x = 16 + i * (boxW + gap);
    ctx.fillStyle = layer.id === selectedId ? 'rgba(219, 39, 119, 0.55)' : '#1e293b';
    ctx.fillRect(x, y, boxW, boxH);
    ctx.strokeStyle = ksTypeColor(layer.type, i);
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, boxW, boxH);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '11px sans-serif';
    ctx.fillText(layer.type.slice(0, 12), x + 8, y + 22);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px sans-serif';
    ctx.fillText(layer.name.slice(0, 12), x + 8, y + 40);
    if (i < visible.length - 1) {
      ctx.strokeStyle = '#64748b';
      ctx.beginPath();
      ctx.moveTo(x + boxW, y + boxH / 2);
      ctx.lineTo(x + boxW + gap, y + boxH / 2);
      ctx.stroke();
    }
  });
}

export function renderKsShapes(canvas: HTMLCanvasElement, shapes: KsShape[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!shapes.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No shapes in this Keras model.', 16, 28);
    return;
  }
  const visible = shapes.slice(0, 24);
  const rowH = Math.min(28, Math.max(18, (canvas.height - 24) / visible.length));
  visible.forEach((s, i) => {
    const y = 14 + i * rowH;
    if (s.id === selectedId) {
      ctx.fillStyle = 'rgba(219, 39, 119, 0.55)';
      ctx.fillRect(8, y - 4, canvas.width - 16, rowH - 2);
    }
    ctx.fillStyle = ksTypeColor(s.kind, i);
    ctx.fillRect(16, y, 10, 10);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${s.name} · ${s.kind} · ${s.dtype} ${s.shapeLabel}`.slice(0, 84), 32, y + 10);
  });
}

export function renderKsPreview(canvas: HTMLCanvasElement, rows: Array<Record<string, string>>, selectedIndex: number | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!rows.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No preview layers in this view.', 16, 28);
    return;
  }
  const rowH = Math.min(36, Math.max(22, (canvas.height - 24) / rows.length));
  rows.forEach((row, i) => {
    const y = 16 + i * rowH;
    if (i === selectedIndex) {
      ctx.fillStyle = 'rgba(219, 39, 119, 0.55)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = ksTypeColor(row.type || 'STRING', i);
    ctx.fillRect(16, y, 8, 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${row.name || ''} · ${row.type || ''} · ${row.inputShape || ''}→${row.outputShape || ''}`.slice(0, 72), 32, y + 11);
  });
}
