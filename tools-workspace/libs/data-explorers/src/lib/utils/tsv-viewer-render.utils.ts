import type { TvColumn } from '../types/tsv-viewer.types';

export function tvColumnColor(type: string, index: number): string {
  const t = type.toUpperCase();
  if (t.includes('INT')) return '#c4b5fd';
  if (t.includes('REAL') || t.includes('FLOA') || t.includes('DOUB') || t.includes('NUM')) return '#ddd6fe';
  if (t.includes('BOOL')) return '#fde68a';
  if (t.includes('DATE')) return '#e9d5ff';
  if (t.includes('TEXT') || t.includes('CHAR')) return '#ede9fe';
  const colors = ['#a78bfa', '#8b5cf6', '#7c3aed', '#c4b5fd', '#ddd6fe'];
  return colors[index % colors.length];
}

export function renderTvColumns(canvas: HTMLCanvasElement, columns: TvColumn[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!columns.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No columns in this TSV table.', 16, 28);
    return;
  }
  const maxDistinct = Math.max(1, ...columns.map((c) => c.uniqueCount || 1));
  const barW = Math.max(18, (canvas.width - 40) / columns.length - 10);
  columns.forEach((c, i) => {
    const x = 24 + i * (barW + 10);
    const h = Math.max(4, (c.uniqueCount / maxDistinct) * (canvas.height - 48));
    const y = canvas.height - 28 - h;
    ctx.fillStyle = c.id === selectedId ? '#ddd6fe' : tvColumnColor(c.type, i);
    ctx.fillRect(x, y, barW, h);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '10px sans-serif';
    ctx.fillText(c.name.slice(0, 10), x, canvas.height - 12);
  });
}

export function renderTvSchema(canvas: HTMLCanvasElement, columns: TvColumn[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!columns.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No columns in this TSV schema.', 16, 28);
    return;
  }
  const rowH = Math.min(36, Math.max(22, (canvas.height - 24) / columns.length));
  columns.forEach((c, i) => {
    const y = 16 + i * rowH;
    if (c.id === selectedId) {
      ctx.fillStyle = 'rgba(124, 58, 237, 0.55)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = tvColumnColor(c.type, i);
    ctx.fillRect(16, y, 12, 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${c.name} · ${c.type}${c.nullable ? '' : ' NOT NULL'} · ${c.uniqueCount} distinct`, 36, y + 11);
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
    ctx.fillText('No preview rows in this view.', 16, 28);
    return;
  }
  const rowH = Math.min(36, Math.max(22, (canvas.height - 24) / rows.length));
  rows.forEach((row, i) => {
    const y = 16 + i * rowH;
    if (i === selectedIndex) {
      ctx.fillStyle = 'rgba(124, 58, 237, 0.55)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = '#c4b5fd';
    ctx.fillRect(16, y, 8, 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(Object.values(row).slice(0, 4).join(' · ').slice(0, 72), 32, y + 11);
  });
}
