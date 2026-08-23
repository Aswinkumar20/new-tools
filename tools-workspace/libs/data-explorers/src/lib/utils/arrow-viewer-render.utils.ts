import type { ArBatch, ArColumn } from '../types/arrow-viewer.types';

export function arColumnColor(type: string, index: number): string {
  const t = type.toUpperCase();
  if (t.includes('INT') || t === 'LONG') return '#67e8f9';
  if (t.includes('DOUBLE') || t.includes('FLOAT')) return '#5eead4';
  if (t.includes('BOOL')) return '#fde68a';
  if (t.includes('UTF8') || t.includes('STRING') || t.includes('BINARY')) return '#a5f3fc';
  const colors = ['#22d3ee', '#06b6d4', '#0891b2', '#67e8f9', '#a5f3fc'];
  return colors[index % colors.length];
}

export function renderArSchema(canvas: HTMLCanvasElement, columns: ArColumn[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!columns.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No columns in this Arrow schema.', 16, 28);
    return;
  }
  const rowH = Math.min(36, Math.max(22, (canvas.height - 24) / columns.length));
  columns.forEach((c, i) => {
    const y = 16 + i * rowH;
    if (c.id === selectedId) {
      ctx.fillStyle = 'rgba(14, 116, 144, 0.55)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = arColumnColor(c.type, i);
    ctx.fillRect(16, y, 12, 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${c.name} · ${c.type}`, 36, y + 11);
  });
}

export function renderArPreview(canvas: HTMLCanvasElement, rows: Array<Record<string, string>>, selectedIndex: number | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!rows.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No preview rows in this view.', 16, 28);
    return;
  }
  const rowH = Math.min(36, Math.max(22, (canvas.height - 24) / rows.length));
  rows.forEach((row, i) => {
    const y = 16 + i * rowH;
    if (i === selectedIndex) {
      ctx.fillStyle = 'rgba(14, 116, 144, 0.55)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = '#67e8f9';
    ctx.fillRect(16, y, 8, 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(Object.values(row).slice(0, 4).join(' · ').slice(0, 72), 32, y + 11);
  });
}

export function renderArBatches(canvas: HTMLCanvasElement, batches: ArBatch[], selectedIndex: number | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!batches.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No record batches in this Arrow file.', 16, 28);
    return;
  }
  const maxRows = Math.max(1, ...batches.map((b) => b.numRows));
  const barW = Math.max(24, (canvas.width - 40) / batches.length - 12);
  batches.forEach((b, i) => {
    const x = 24 + i * (barW + 12);
    const h = Math.max(8, (b.numRows / maxRows) * (canvas.height - 48));
    const y = canvas.height - 28 - h;
    ctx.fillStyle = i === selectedIndex ? '#a5f3fc' : arColumnColor('INT64', i);
    ctx.fillRect(x, y, barW, h);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '10px sans-serif';
    ctx.fillText(`b${i} · ${b.numRows}`, x, canvas.height - 12);
  });
}
