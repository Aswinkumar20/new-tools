import type { TfNode, TfTensor } from '../types/tensorflow-graph-viewer.types';

export function tfTypeColor(type: string, index: number): string {
  const t = type.toUpperCase();
  if (t === 'MATMUL' || t === 'GEMM' || t === 'LINEAR') return '#fdba74';
  if (t === 'RELU' || t === 'SIGMOID' || t === 'TANH' || t === 'GELU') return '#fed7aa';
  if (t === 'SOFTMAX' || t === 'LOGSOFTMAX') return '#fb923c';
  if (t === 'ADD' || t === 'BIASADD') return '#fcd34d';
  if (t === 'PLACEHOLDER' || t === 'PLACEHOLDERV2' || t === 'INPUT') return '#67e8f9';
  if (t === 'CONST' || t === 'CONSTANT') return '#fde68a';
  if (t === 'VARIABLE' || t === 'VARIABLEV2') return '#f9a8d4';
  if (t === 'OUTPUT') return '#f9a8d4';
  if (t === 'DT_FLOAT' || t === 'FLOAT' || t === 'FLOAT32') return '#fdba74';
  if (t === 'DT_INT32' || t === 'DT_INT64' || t === 'INT32' || t === 'INT64') return '#fed7aa';
  const colors = ['#fb923c', '#ea580c', '#c2410c', '#fdba74', '#fed7aa'];
  return colors[index % colors.length];
}

export function renderTfGraph(canvas: HTMLCanvasElement, nodes: TfNode[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!nodes.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No nodes in this TensorFlow graph.', 16, 28);
    return;
  }
  const visible = nodes.slice(0, 12);
  const gap = 16;
  const boxW = Math.max(72, (canvas.width - 32 - gap * (visible.length - 1)) / visible.length);
  const boxH = Math.min(64, canvas.height - 36);
  const y = 18;
  visible.forEach((node, i) => {
    const x = 16 + i * (boxW + gap);
    ctx.fillStyle = node.id === selectedId ? 'rgba(234, 88, 12, 0.55)' : '#1e293b';
    ctx.fillRect(x, y, boxW, boxH);
    ctx.strokeStyle = tfTypeColor(node.op, i);
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, boxW, boxH);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '11px sans-serif';
    ctx.fillText(node.op.slice(0, 12), x + 8, y + 22);
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

export function renderTfTensors(canvas: HTMLCanvasElement, tensors: TfTensor[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!tensors.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No tensors in this TensorFlow graph.', 16, 28);
    return;
  }
  const visible = tensors.slice(0, 24);
  const rowH = Math.min(28, Math.max(18, (canvas.height - 24) / visible.length));
  visible.forEach((t, i) => {
    const y = 14 + i * rowH;
    if (t.id === selectedId) {
      ctx.fillStyle = 'rgba(234, 88, 12, 0.55)';
      ctx.fillRect(8, y - 4, canvas.width - 16, rowH - 2);
    }
    ctx.fillStyle = tfTypeColor(t.kind, i);
    ctx.fillRect(16, y, 10, 10);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${t.name} · ${t.kind} · ${t.dtype} ${t.shapeLabel}`.slice(0, 84), 32, y + 10);
  });
}

export function renderTfPreview(canvas: HTMLCanvasElement, rows: Array<Record<string, string>>, selectedIndex: number | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!rows.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No preview nodes in this view.', 16, 28);
    return;
  }
  const rowH = Math.min(36, Math.max(22, (canvas.height - 24) / rows.length));
  rows.forEach((row, i) => {
    const y = 16 + i * rowH;
    if (i === selectedIndex) {
      ctx.fillStyle = 'rgba(234, 88, 12, 0.55)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = tfTypeColor(row.op || 'STRING', i);
    ctx.fillRect(16, y, 8, 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${row.name || ''} · ${row.op || ''} · ${row.inputs || ''}`.slice(0, 72), 32, y + 11);
  });
}
