import type { SqColumn, SqTable } from '../types/sqlite-viewer.types';

export function sqColumnColor(type: string, index: number): string {
  const t = type.toUpperCase();
  if (t.includes('INT') || t === 'BIGINT') return '#93c5fd';
  if (t.includes('REAL') || t.includes('FLOA') || t.includes('DOUB') || t.includes('NUM')) return '#bfdbfe';
  if (t.includes('BLOB')) return '#fde68a';
  if (t.includes('TEXT') || t.includes('CHAR') || t.includes('CLOB')) return '#dbeafe';
  const colors = ['#60a5fa', '#3b82f6', '#2563eb', '#93c5fd', '#bfdbfe'];
  return colors[index % colors.length];
}

export function renderSqTables(canvas: HTMLCanvasElement, tables: SqTable[], selectedIndex: number | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!tables.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No tables in this SQLite database.', 16, 28);
    return;
  }
  const maxRows = Math.max(1, ...tables.map((t) => t.numRows || t.rows.length || 1));
  const barW = Math.max(24, (canvas.width - 40) / tables.length - 12);
  tables.forEach((t, i) => {
    const x = 24 + i * (barW + 12);
    const h = Math.max(8, ((t.numRows || t.rows.length || 1) / maxRows) * (canvas.height - 48));
    const y = canvas.height - 28 - h;
    ctx.fillStyle = i === selectedIndex ? '#bfdbfe' : sqColumnColor('INTEGER', i);
    ctx.fillRect(x, y, barW, h);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '10px sans-serif';
    ctx.fillText(t.name.slice(0, 10), x, canvas.height - 12);
  });
}

export function renderSqSchema(canvas: HTMLCanvasElement, columns: SqColumn[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!columns.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No columns in this SQLite schema.', 16, 28);
    return;
  }
  const rowH = Math.min(36, Math.max(22, (canvas.height - 24) / columns.length));
  columns.forEach((c, i) => {
    const y = 16 + i * rowH;
    if (c.id === selectedId) {
      ctx.fillStyle = 'rgba(29, 78, 216, 0.55)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = sqColumnColor(c.type, i);
    ctx.fillRect(16, y, 12, 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${c.name} · ${c.type}${c.pk ? ' PK' : ''}${c.nullable ? '' : ' NOT NULL'}`, 36, y + 11);
  });
}

export function renderSqPreview(canvas: HTMLCanvasElement, rows: Array<Record<string, string>>, selectedIndex: number | null): void {
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
      ctx.fillStyle = 'rgba(29, 78, 216, 0.55)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = '#93c5fd';
    ctx.fillRect(16, y, 8, 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(Object.values(row).slice(0, 4).join(' · ').slice(0, 72), 32, y + 11);
  });
}
