import type { DlColumn, DlVersion } from '../types/delta-lake-viewer.types';

export function dlColumnColor(type: string, index: number): string {
  const t = type.toUpperCase();
  if (t.includes('INT') || t === 'LONG') return '#86efac';
  if (t.includes('DOUBLE') || t.includes('FLOAT') || t.includes('DECIMAL')) return '#bbf7d0';
  if (t.includes('BOOL')) return '#fde68a';
  if (t.includes('STRING') || t.includes('CHAR') || t.includes('BINARY') || t.includes('UTF8')) return '#a7f3d0';
  const colors = ['#4ade80', '#22c55e', '#16a34a', '#86efac', '#bbf7d0'];
  return colors[index % colors.length];
}

export function renderDlVersions(canvas: HTMLCanvasElement, versions: DlVersion[], selectedIndex: number | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!versions.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No Delta versions in this log.', 16, 28);
    return;
  }
  const maxRows = Math.max(1, ...versions.map((v) => v.numRows));
  const barW = Math.max(24, (canvas.width - 40) / versions.length - 12);
  versions.forEach((v, i) => {
    const x = 24 + i * (barW + 12);
    const h = Math.max(8, (v.numRows / maxRows) * (canvas.height - 48));
    const y = canvas.height - 28 - h;
    ctx.fillStyle = i === selectedIndex ? '#bbf7d0' : dlColumnColor('LONG', i);
    ctx.fillRect(x, y, barW, h);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '10px sans-serif';
    ctx.fillText(`v${v.version}`, x, canvas.height - 12);
  });
}

export function renderDlSchema(canvas: HTMLCanvasElement, columns: DlColumn[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!columns.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No columns in this Delta schema.', 16, 28);
    return;
  }
  const rowH = Math.min(36, Math.max(22, (canvas.height - 24) / columns.length));
  columns.forEach((c, i) => {
    const y = 16 + i * rowH;
    if (c.id === selectedId) {
      ctx.fillStyle = 'rgba(22, 101, 52, 0.55)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = dlColumnColor(c.type, i);
    ctx.fillRect(16, y, 12, 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${c.name} · ${c.type}${c.nullable ? '?' : ''}`, 36, y + 11);
  });
}

export function renderDlPreview(canvas: HTMLCanvasElement, rows: Array<Record<string, string>>, selectedIndex: number | null): void {
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
      ctx.fillStyle = 'rgba(22, 101, 52, 0.55)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = '#86efac';
    ctx.fillRect(16, y, 8, 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(Object.values(row).slice(0, 4).join(' · ').slice(0, 72), 32, y + 11);
  });
}
