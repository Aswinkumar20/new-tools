import type { OxNode, OxTensor } from '../types/onnx-viewer.types';

export function oxTypeColor(type: string, index: number): string {
  const t = type.toUpperCase();
  if (t === 'GEMM' || t === 'MATMUL' || t === 'LINEAR') return '#c4b5fd';
  if (t === 'RELU' || t === 'SIGMOID' || t === 'TANH' || t === 'GELU') return '#ddd6fe';
  if (t === 'SOFTMAX' || t === 'LOGSOFTMAX') return '#a78bfa';
  if (t === 'CONV' || t === 'CONV2D') return '#8b5cf6';
  if (t === 'FLOAT' || t === 'FLOAT16' || t === 'BFLOAT16' || t === 'DOUBLE') return '#c4b5fd';
  if (t === 'INT64' || t === 'INT32' || t === 'INT8') return '#ddd6fe';
  if (t === 'INPUT') return '#67e8f9';
  if (t === 'OUTPUT') return '#f9a8d4';
  if (t === 'INITIALIZER') return '#fde68a';
  const colors = ['#a78bfa', '#8b5cf6', '#6d28d9', '#c4b5fd', '#ddd6fe'];
  return colors[index % colors.length];
}

export function renderOxGraph(canvas: HTMLCanvasElement, nodes: OxNode[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!nodes.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No ops in this ONNX graph.', 16, 28);
    return;
  }
  const visible = nodes.slice(0, 12);
  const gap = 16;
  const boxW = Math.max(72, (canvas.width - 32 - gap * (visible.length - 1)) / visible.length);
  const boxH = Math.min(64, canvas.height - 36);
  const y = 18;
  visible.forEach((node, i) => {
    const x = 16 + i * (boxW + gap);
    ctx.fillStyle = node.id === selectedId ? 'rgba(109, 40, 217, 0.55)' : '#1e293b';
    ctx.fillRect(x, y, boxW, boxH);
    ctx.strokeStyle = oxTypeColor(node.opType, i);
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, boxW, boxH);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '11px sans-serif';
    ctx.fillText(node.opType.slice(0, 12), x + 8, y + 22);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px sans-serif';
    ctx.fillText(node.name.slice(0, 12), x + 8, y + 40);
    if (i < visible.length - 1) {
      ctx.strokeStyle = '#64748b';
      ctx.beginPath();
      ctx.moveTo(x + boxW, y + boxH / 2);
      ctx.lineTo(x + boxW + gap, y + boxH / 2);
      ctx.stroke();
    }
  });
}

export function renderOxTensors(canvas: HTMLCanvasElement, tensors: OxTensor[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!tensors.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No tensors in this ONNX model.', 16, 28);
    return;
  }
  const visible = tensors.slice(0, 24);
  const rowH = Math.min(28, Math.max(18, (canvas.height - 24) / visible.length));
  visible.forEach((t, i) => {
    const y = 14 + i * rowH;
    if (t.id === selectedId) {
      ctx.fillStyle = 'rgba(109, 40, 217, 0.55)';
      ctx.fillRect(8, y - 4, canvas.width - 16, rowH - 2);
    }
    ctx.fillStyle = oxTypeColor(t.kind, i);
    ctx.fillRect(16, y, 10, 10);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${t.name} · ${t.kind} · ${t.dtype} ${t.shapeLabel}`.slice(0, 84), 32, y + 10);
  });
}

export function renderOxPreview(canvas: HTMLCanvasElement, rows: Array<Record<string, string>>, selectedIndex: number | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!rows.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No preview ops in this view.', 16, 28);
    return;
  }
  const rowH = Math.min(36, Math.max(22, (canvas.height - 24) / rows.length));
  rows.forEach((row, i) => {
    const y = 16 + i * rowH;
    if (i === selectedIndex) {
      ctx.fillStyle = 'rgba(109, 40, 217, 0.55)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = oxTypeColor(row.opType || 'STRING', i);
    ctx.fillRect(16, y, 8, 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${row.name || ''} · ${row.opType || ''} · ${row.inputs || ''}`.slice(0, 72), 32, y + 11);
  });
}
