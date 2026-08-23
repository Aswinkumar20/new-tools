import type { MfArtifact, MfSignature } from '../types/mlflow-model-viewer.types';

export function mfTypeColor(type: string, index: number): string {
  const t = type.toUpperCase();
  if (t === 'INPUT' || t === 'TENSOR') return '#7dd3fc';
  if (t === 'OUTPUT') return '#f9a8d4';
  if (t === 'PARAM' || t === 'PARAMETER') return '#fde68a';
  if (t === 'MANIFEST') return '#38bdf8';
  if (t === 'MODEL') return '#0284c7';
  if (t === 'ENV') return '#67e8f9';
  if (t === 'KERAS' || t === 'TENSORFLOW') return '#fb923c';
  if (t === 'PYTORCH' || t === 'ONNX') return '#a78bfa';
  if (t === 'FLOAT32' || t === 'FLOAT' || t === 'DOUBLE') return '#7dd3fc';
  const colors = ['#38bdf8', '#0284c7', '#0369a1', '#7dd3fc', '#bae6fd'];
  return colors[index % colors.length];
}

export function renderMfSignature(canvas: HTMLCanvasElement, signatures: MfSignature[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!signatures.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No signature tensors in this MLflow model.', 16, 28);
    return;
  }
  const visible = signatures.slice(0, 12);
  const gap = 16;
  const boxW = Math.max(72, (canvas.width - 32 - gap * (visible.length - 1)) / visible.length);
  const boxH = Math.min(64, canvas.height - 36);
  const y = 18;
  visible.forEach((sig, i) => {
    const x = 16 + i * (boxW + gap);
    ctx.fillStyle = sig.id === selectedId ? 'rgba(2, 132, 199, 0.55)' : '#1e293b';
    ctx.fillRect(x, y, boxW, boxH);
    ctx.strokeStyle = mfTypeColor(sig.kind, i);
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, boxW, boxH);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '11px sans-serif';
    ctx.fillText(sig.kind.slice(0, 12), x + 8, y + 22);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px sans-serif';
    ctx.fillText(sig.name.slice(0, 12), x + 8, y + 40);
    if (i < visible.length - 1) {
      ctx.strokeStyle = '#64748b';
      ctx.beginPath();
      ctx.moveTo(x + boxW, y + boxH / 2);
      ctx.lineTo(x + boxW + gap, y + boxH / 2);
      ctx.stroke();
    }
  });
}

export function renderMfFiles(canvas: HTMLCanvasElement, files: MfArtifact[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!files.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No artifact files in this MLflow model.', 16, 28);
    return;
  }
  const visible = files.slice(0, 24);
  const rowH = Math.min(28, Math.max(18, (canvas.height - 24) / visible.length));
  visible.forEach((f, i) => {
    const y = 14 + i * rowH;
    if (f.id === selectedId) {
      ctx.fillStyle = 'rgba(2, 132, 199, 0.55)';
      ctx.fillRect(8, y - 4, canvas.width - 16, rowH - 2);
    }
    ctx.fillStyle = mfTypeColor(f.role, i);
    ctx.fillRect(16, y, 10, 10);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${f.name} · ${f.role} · ${f.flavor} ${f.sizeLabel}`.slice(0, 84), 32, y + 10);
  });
}

export function renderMfPreview(canvas: HTMLCanvasElement, rows: Array<Record<string, string>>, selectedIndex: number | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!rows.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No preview signature rows in this view.', 16, 28);
    return;
  }
  const rowH = Math.min(36, Math.max(22, (canvas.height - 24) / rows.length));
  rows.forEach((row, i) => {
    const y = 16 + i * rowH;
    if (i === selectedIndex) {
      ctx.fillStyle = 'rgba(2, 132, 199, 0.55)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = mfTypeColor(row.kind || row.type || 'STRING', i);
    ctx.fillRect(16, y, 8, 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${row.name || ''} · ${row.kind || ''} · ${row.dtype || ''} ${row.shape || ''}`.slice(0, 72), 32, y + 11);
  });
}
