import type { PqColumn, PqProfile } from '../types/parquet-viewer.types';

export function pqColumnColor(type: string, index: number): string {
  const t = type.toUpperCase();
  if (t.includes('INT') || t === 'LONG') return '#5eead4';
  if (t.includes('DOUBLE') || t.includes('FLOAT') || t.includes('DECIMAL')) return '#67e8f9';
  if (t.includes('BOOL')) return '#fcd34d';
  if (t.includes('UTF8') || t.includes('STRING') || t.includes('BYTE')) return '#6ee7b7';
  const colors = ['#2dd4bf', '#14b8a6', '#0d9488', '#5eead4', '#99f6e4'];
  return colors[index % colors.length];
}

export function renderPqSchema(canvas: HTMLCanvasElement, columns: PqColumn[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!columns.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No columns in this Parquet schema.', 16, 28);
    return;
  }
  const rowH = Math.min(36, Math.max(22, (canvas.height - 24) / columns.length));
  columns.forEach((c, i) => {
    const y = 16 + i * rowH;
    if (c.id === selectedId) {
      ctx.fillStyle = 'rgba(15, 118, 110, 0.45)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = pqColumnColor(c.convertedType || c.type, i);
    ctx.fillRect(16, y, 12, 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${c.name} · ${c.convertedType || c.type} · ${c.repetition}`, 36, y + 11);
  });
}

export function renderPqRows(canvas: HTMLCanvasElement, rows: Array<Record<string, string>>, selectedIndex: number | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!rows.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No sample rows in this view.', 16, 28);
    return;
  }
  const rowH = Math.min(36, Math.max(22, (canvas.height - 24) / rows.length));
  rows.forEach((row, i) => {
    const y = 16 + i * rowH;
    if (i === selectedIndex) {
      ctx.fillStyle = 'rgba(15, 118, 110, 0.45)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = '#5eead4';
    ctx.fillRect(16, y, 8, 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(Object.values(row).slice(0, 4).join(' · ').slice(0, 72), 32, y + 11);
  });
}

export function renderPqProfiling(canvas: HTMLCanvasElement, profiles: PqProfile[], selectedColumn: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!profiles.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No column profiles yet.', 16, 28);
    return;
  }
  const maxDistinct = Math.max(1, ...profiles.map((p) => p.distinct));
  const barW = Math.max(18, (canvas.width - 40) / profiles.length - 10);
  profiles.forEach((p, i) => {
    const x = 24 + i * (barW + 10);
    const h = Math.max(4, (p.distinct / maxDistinct) * (canvas.height - 48));
    const y = canvas.height - 28 - h;
    ctx.fillStyle = p.column === selectedColumn ? '#99f6e4' : pqColumnColor(p.type, i);
    ctx.fillRect(x, y, barW, h);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '10px sans-serif';
    ctx.fillText(p.column.slice(0, 10), x, canvas.height - 12);
  });
}
