import type { CvColumn } from '../types/csv-viewer.types';

export function cvColumnColor(type: string, index: number): string {
  const t = type.toUpperCase();
  if (t.includes('INT')) return '#86efac';
  if (t.includes('REAL') || t.includes('FLOA') || t.includes('DOUB') || t.includes('NUM')) return '#bbf7d0';
  if (t.includes('BOOL')) return '#fde68a';
  if (t.includes('DATE')) return '#a7f3d0';
  if (t.includes('TEXT') || t.includes('CHAR')) return '#dcfce7';
  const colors = ['#4ade80', '#22c55e', '#16a34a', '#86efac', '#bbf7d0'];
  return colors[index % colors.length];
}

export function renderCvColumns(canvas: HTMLCanvasElement, columns: CvColumn[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!columns.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No columns in this CSV table.', 16, 28);
    return;
  }
  const maxDistinct = Math.max(1, ...columns.map((c) => c.uniqueCount || 1));
  const barW = Math.max(18, (canvas.width - 40) / columns.length - 10);
  columns.forEach((c, i) => {
    const x = 24 + i * (barW + 10);
    const h = Math.max(4, (c.uniqueCount / maxDistinct) * (canvas.height - 48));
    const y = canvas.height - 28 - h;
    ctx.fillStyle = c.id === selectedId ? '#bbf7d0' : cvColumnColor(c.type, i);
    ctx.fillRect(x, y, barW, h);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '10px sans-serif';
    ctx.fillText(c.name.slice(0, 10), x, canvas.height - 12);
  });
}

export function renderCvSchema(canvas: HTMLCanvasElement, columns: CvColumn[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!columns.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No columns in this CSV schema.', 16, 28);
    return;
  }
  const rowH = Math.min(36, Math.max(22, (canvas.height - 24) / columns.length));
  columns.forEach((c, i) => {
    const y = 16 + i * rowH;
    if (c.id === selectedId) {
      ctx.fillStyle = 'rgba(21, 128, 61, 0.55)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = cvColumnColor(c.type, i);
    ctx.fillRect(16, y, 12, 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${c.name} · ${c.type}${c.nullable ? '' : ' NOT NULL'} · ${c.uniqueCount} distinct`, 36, y + 11);
  });
}

export function renderCvPreview(canvas: HTMLCanvasElement, rows: Array<Record<string, string>>, selectedIndex: number | null): void {
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
      ctx.fillStyle = 'rgba(21, 128, 61, 0.55)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = '#86efac';
    ctx.fillRect(16, y, 8, 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(Object.values(row).slice(0, 4).join(' · ').slice(0, 72), 32, y + 11);
  });
}
