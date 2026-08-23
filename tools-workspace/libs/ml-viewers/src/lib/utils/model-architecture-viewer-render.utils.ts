import type { MaBlock, MaParam } from '../types/model-architecture-viewer.types';

export function maTypeColor(type: string, index: number): string {
  const t = type.toUpperCase();
  if (t === 'MLP' || t === 'LINEAR' || t === 'DENSE') return '#5eead4';
  if (t === 'INPUT' || t === 'STEM') return '#67e8f9';
  if (t === 'ENCODER' || t === 'BACKBONE') return '#2dd4bf';
  if (t === 'DECODER') return '#99f6e4';
  if (t === 'HEAD' || t === 'CLASSIFIER') return '#f9a8d4';
  if (t === 'WEIGHT') return '#fdba74';
  if (t === 'BIAS') return '#67e8f9';
  if (t === 'NORM') return '#fde68a';
  const colors = ['#2dd4bf', '#0f766e', '#115e59', '#5eead4', '#99f6e4'];
  return colors[index % colors.length];
}

export function renderMaBlocks(canvas: HTMLCanvasElement, blocks: MaBlock[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!blocks.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No blocks in this architecture.', 16, 28);
    return;
  }
  const visible = blocks.slice(0, 12);
  const gap = 16;
  const boxW = Math.max(72, (canvas.width - 32 - gap * (visible.length - 1)) / visible.length);
  const boxH = Math.min(64, canvas.height - 36);
  const y = 18;
  visible.forEach((block, i) => {
    const x = 16 + i * (boxW + gap);
    ctx.fillStyle = block.id === selectedId ? 'rgba(15, 118, 110, 0.55)' : '#1e293b';
    ctx.fillRect(x, y, boxW, boxH);
    ctx.strokeStyle = maTypeColor(block.role || block.type, i);
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, boxW, boxH);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '11px sans-serif';
    ctx.fillText((block.role || block.type).slice(0, 12), x + 8, y + 22);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px sans-serif';
    ctx.fillText(block.name.slice(0, 12), x + 8, y + 40);
    if (i < visible.length - 1) {
      ctx.strokeStyle = '#64748b';
      ctx.beginPath();
      ctx.moveTo(x + boxW, y + boxH / 2);
      ctx.lineTo(x + boxW + gap, y + boxH / 2);
      ctx.stroke();
    }
  });
}

export function renderMaParams(canvas: HTMLCanvasElement, params: MaParam[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!params.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No params in this architecture.', 16, 28);
    return;
  }
  const visible = params.slice(0, 24);
  const rowH = Math.min(28, Math.max(18, (canvas.height - 24) / visible.length));
  visible.forEach((p, i) => {
    const y = 14 + i * rowH;
    if (p.id === selectedId) {
      ctx.fillStyle = 'rgba(15, 118, 110, 0.55)';
      ctx.fillRect(8, y - 4, canvas.width - 16, rowH - 2);
    }
    ctx.fillStyle = maTypeColor(p.kind, i);
    ctx.fillRect(16, y, 10, 10);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${p.name} · ${p.kind} · ${p.dtype} ${p.shapeLabel}`.slice(0, 84), 32, y + 10);
  });
}

export function renderMaPreview(canvas: HTMLCanvasElement, rows: Array<Record<string, string>>, selectedIndex: number | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!rows.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No preview blocks in this view.', 16, 28);
    return;
  }
  const rowH = Math.min(36, Math.max(22, (canvas.height - 24) / rows.length));
  rows.forEach((row, i) => {
    const y = 16 + i * rowH;
    if (i === selectedIndex) {
      ctx.fillStyle = 'rgba(15, 118, 110, 0.55)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = maTypeColor(row.role || row.type || 'STRING', i);
    ctx.fillRect(16, y, 8, 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${row.name || ''} · ${row.role || row.type || ''} · ${row.inFeatures || ''}→${row.outFeatures || ''}`.slice(0, 72), 32, y + 11);
  });
}
