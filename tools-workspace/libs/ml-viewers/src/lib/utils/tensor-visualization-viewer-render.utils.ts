import type { TvTensor } from '../types/tensor-visualization-viewer.types';

export function tvTypeColor(type: string, index: number): string {
  const t = type.toUpperCase();
  if (t === 'INPUT') return '#67e8f9';
  if (t === 'OUTPUT') return '#f9a8d4';
  if (t === 'WEIGHT' || t === 'KERNEL') return '#fdba74';
  if (t === 'BIAS') return '#c4b5fd';
  if (t === 'ACTIVATION') return '#fde68a';
  if (t === 'FLOAT32' || t === 'FLOAT' || t === 'FLOAT16' || t === 'FLOAT64') return '#a78bfa';
  if (t === 'INT32' || t === 'INT64' || t === 'INT8') return '#818cf8';
  const colors = ['#a78bfa', '#7c3aed', '#6d28d9', '#c4b5fd', '#ddd6fe'];
  return colors[index % colors.length];
}

export function renderTvShapes(canvas: HTMLCanvasElement, tensors: TvTensor[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!tensors.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No tensors in this dump.', 16, 28);
    return;
  }
  const visible = tensors.slice(0, 24);
  const rowH = Math.min(28, Math.max(18, (canvas.height - 24) / visible.length));
  visible.forEach((t, i) => {
    const y = 14 + i * rowH;
    if (t.id === selectedId) {
      ctx.fillStyle = 'rgba(124, 58, 237, 0.55)';
      ctx.fillRect(8, y - 4, canvas.width - 16, rowH - 2);
    }
    ctx.fillStyle = tvTypeColor(t.kind, i);
    ctx.fillRect(16, y, 10, 10);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${t.name} · ${t.kind} · ${t.dtype} ${t.shapeLabel}`.slice(0, 84), 32, y + 10);
  });
}

export function renderTvStats(canvas: HTMLCanvasElement, tensors: TvTensor[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!tensors.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No tensor stats in this dump.', 16, 28);
    return;
  }
  const visible = tensors.slice(0, 24);
  const rowH = Math.min(28, Math.max(18, (canvas.height - 24) / visible.length));
  visible.forEach((t, i) => {
    const y = 14 + i * rowH;
    if (t.id === selectedId) {
      ctx.fillStyle = 'rgba(124, 58, 237, 0.55)';
      ctx.fillRect(8, y - 4, canvas.width - 16, rowH - 2);
    }
    ctx.fillStyle = tvTypeColor(t.kind, i);
    ctx.fillRect(16, y, 10, 10);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    const stat = [t.min && `min ${t.min}`, t.max && `max ${t.max}`, t.mean && `μ ${t.mean}`, t.nnz && `nnz ${t.nnz}`]
      .filter(Boolean)
      .join(' · ');
    ctx.fillText(`${t.name} · ${stat || '—'}`.slice(0, 84), 32, y + 10);
  });
}

export function renderTvPreview(canvas: HTMLCanvasElement, rows: Array<Record<string, string>>, selectedIndex: number | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!rows.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No preview tensors in this view.', 16, 28);
    return;
  }
  const rowH = Math.min(36, Math.max(22, (canvas.height - 24) / rows.length));
  rows.forEach((row, i) => {
    const y = 16 + i * rowH;
    if (i === selectedIndex) {
      ctx.fillStyle = 'rgba(124, 58, 237, 0.55)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = tvTypeColor(row.kind || row.dtype || 'STRING', i);
    ctx.fillRect(16, y, 8, 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${row.name || ''} · ${row.kind || ''} · ${row.dtype || ''} ${row.shape || ''}`.slice(0, 72), 32, y + 11);
  });
}
