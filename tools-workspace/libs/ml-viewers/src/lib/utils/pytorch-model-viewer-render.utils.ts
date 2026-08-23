import type { PtLayer, PtParam } from '../types/pytorch-model-viewer.types';

export function ptTypeColor(type: string, index: number): string {
  const t = type.toUpperCase();
  if (t === 'LINEAR' || t === 'GEMM' || t === 'MATMUL') return '#fca5a5';
  if (t === 'RELU' || t === 'SIGMOID' || t === 'TANH' || t === 'GELU') return '#fecaca';
  if (t === 'SOFTMAX' || t === 'LOGSOFTMAX') return '#f87171';
  if (t === 'CONV' || t === 'CONV2D') return '#dc2626';
  if (t === 'WEIGHT') return '#fdba74';
  if (t === 'BIAS') return '#67e8f9';
  if (t === 'BUFFER') return '#fde68a';
  if (t === 'FLOAT32' || t === 'FLOAT' || t === 'FLOAT16') return '#fca5a5';
  if (t === 'INT64' || t === 'INT32' || t === 'INT8') return '#fecaca';
  const colors = ['#f87171', '#dc2626', '#b91c1c', '#fca5a5', '#fecaca'];
  return colors[index % colors.length];
}

export function renderPtLayers(canvas: HTMLCanvasElement, layers: PtLayer[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!layers.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No layers in this PyTorch model.', 16, 28);
    return;
  }
  const visible = layers.slice(0, 12);
  const gap = 16;
  const boxW = Math.max(72, (canvas.width - 32 - gap * (visible.length - 1)) / visible.length);
  const boxH = Math.min(64, canvas.height - 36);
  const y = 18;
  visible.forEach((layer, i) => {
    const x = 16 + i * (boxW + gap);
    ctx.fillStyle = layer.id === selectedId ? 'rgba(220, 38, 38, 0.55)' : '#1e293b';
    ctx.fillRect(x, y, boxW, boxH);
    ctx.strokeStyle = ptTypeColor(layer.type, i);
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

export function renderPtParams(canvas: HTMLCanvasElement, params: PtParam[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!params.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No params in this PyTorch model.', 16, 28);
    return;
  }
  const visible = params.slice(0, 24);
  const rowH = Math.min(28, Math.max(18, (canvas.height - 24) / visible.length));
  visible.forEach((p, i) => {
    const y = 14 + i * rowH;
    if (p.id === selectedId) {
      ctx.fillStyle = 'rgba(220, 38, 38, 0.55)';
      ctx.fillRect(8, y - 4, canvas.width - 16, rowH - 2);
    }
    ctx.fillStyle = ptTypeColor(p.kind, i);
    ctx.fillRect(16, y, 10, 10);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${p.name} · ${p.kind} · ${p.dtype} ${p.shapeLabel}`.slice(0, 84), 32, y + 10);
  });
}

export function renderPtPreview(canvas: HTMLCanvasElement, rows: Array<Record<string, string>>, selectedIndex: number | null): void {
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
      ctx.fillStyle = 'rgba(220, 38, 38, 0.55)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = ptTypeColor(row.type || 'STRING', i);
    ctx.fillRect(16, y, 8, 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${row.name || ''} · ${row.type || ''} · ${row.inFeatures || ''}→${row.outFeatures || ''}`.slice(0, 72), 32, y + 11);
  });
}
