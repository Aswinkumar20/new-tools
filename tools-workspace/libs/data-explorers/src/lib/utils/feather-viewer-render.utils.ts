import type { FtColumn } from '../types/feather-viewer.types';

export function ftColumnColor(type: string, index: number): string {
  const t = type.toUpperCase();
  if (t.includes('INT') || t === 'LONG') return '#c4b5fd';
  if (t.includes('DOUBLE') || t.includes('FLOAT')) return '#a5b4fc';
  if (t.includes('BOOL')) return '#fde68a';
  if (t.includes('UTF8') || t.includes('STRING') || t.includes('BINARY')) return '#ddd6fe';
  const colors = ['#a78bfa', '#8b5cf6', '#7c3aed', '#c4b5fd', '#ddd6fe'];
  return colors[index % colors.length];
}

export function renderFtDiagram(canvas: HTMLCanvasElement, tableName: string, columns: FtColumn[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const origin = { x: 70, y: Math.max(40, canvas.height / 2) };
  ctx.fillStyle = '#c4b5fd';
  ctx.fillRect(origin.x - 54, origin.y - 22, 108, 44);
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText((tableName || 'table').slice(0, 12), origin.x - 40, origin.y + 4);
  if (!columns.length) return;
  const ys = columns.map((c) => c.y);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanY = Math.max(1, maxY - minY);
  const mapY = (y: number) => 28 + ((y - minY) / spanY) * (canvas.height - 56);
  columns.forEach((c, i) => {
    const y = mapY(c.y);
    const x = canvas.width - 90;
    ctx.strokeStyle = '#64748b';
    ctx.beginPath();
    ctx.moveTo(origin.x + 54, origin.y);
    ctx.lineTo(x - 50, y);
    ctx.stroke();
    ctx.fillStyle = c.id === selectedId ? '#ede9fe' : ftColumnColor(c.type, i);
    ctx.fillRect(x - 50, y - 16, 100, 32);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText(c.name.slice(0, 12), x - 40, y + 4);
  });
}

export function renderFtSchema(canvas: HTMLCanvasElement, columns: FtColumn[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!columns.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No columns in this Feather schema.', 16, 28);
    return;
  }
  const rowH = Math.min(36, Math.max(22, (canvas.height - 24) / columns.length));
  columns.forEach((c, i) => {
    const y = 16 + i * rowH;
    if (c.id === selectedId) {
      ctx.fillStyle = 'rgba(91, 33, 182, 0.55)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = ftColumnColor(c.type, i);
    ctx.fillRect(16, y, 12, 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${c.name} · ${c.type}`, 36, y + 11);
  });
}

export function renderFtPreview(canvas: HTMLCanvasElement, rows: Array<Record<string, string>>, selectedIndex: number | null): void {
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
      ctx.fillStyle = 'rgba(91, 33, 182, 0.55)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = '#c4b5fd';
    ctx.fillRect(16, y, 8, 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(Object.values(row).slice(0, 4).join(' · ').slice(0, 72), 32, y + 11);
  });
}
