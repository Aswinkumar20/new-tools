import type { OrcColumn, OrcStripe } from '../types/orc-viewer.types';

export function orcColumnColor(type: string, index: number): string {
  const t = type.toUpperCase();
  if (t.includes('INT') || t === 'LONG' || t === 'SHORT' || t === 'BYTE') return '#fdba74';
  if (t.includes('DOUBLE') || t.includes('FLOAT') || t.includes('DECIMAL')) return '#fcd34d';
  if (t.includes('BOOL')) return '#fde68a';
  if (t.includes('STRING') || t.includes('CHAR') || t.includes('BINARY')) return '#fed7aa';
  const colors = ['#fb923c', '#f97316', '#ea580c', '#fdba74', '#fbbf24'];
  return colors[index % colors.length];
}

export function renderOrcSchema(canvas: HTMLCanvasElement, columns: OrcColumn[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!columns.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No columns in this ORC schema.', 16, 28);
    return;
  }
  const rowH = Math.min(36, Math.max(22, (canvas.height - 24) / columns.length));
  columns.forEach((c, i) => {
    const y = 16 + i * rowH;
    if (c.id === selectedId) {
      ctx.fillStyle = 'rgba(154, 52, 18, 0.55)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = orcColumnColor(c.type, i);
    ctx.fillRect(16, y, 12, 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${c.name} · ${c.type}`, 36, y + 11);
  });
}

export function renderOrcPreview(canvas: HTMLCanvasElement, rows: Array<Record<string, string>>, selectedIndex: number | null): void {
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
      ctx.fillStyle = 'rgba(154, 52, 18, 0.55)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = '#fdba74';
    ctx.fillRect(16, y, 8, 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(Object.values(row).slice(0, 4).join(' · ').slice(0, 72), 32, y + 11);
  });
}

export function renderOrcStripes(canvas: HTMLCanvasElement, stripes: OrcStripe[], selectedIndex: number | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!stripes.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No stripes in this ORC file.', 16, 28);
    return;
  }
  const maxRows = Math.max(1, ...stripes.map((s) => s.numRows));
  const barW = Math.max(24, (canvas.width - 40) / stripes.length - 12);
  stripes.forEach((s, i) => {
    const x = 24 + i * (barW + 12);
    const h = Math.max(8, (s.numRows / maxRows) * (canvas.height - 48));
    const y = canvas.height - 28 - h;
    ctx.fillStyle = i === selectedIndex ? '#fed7aa' : orcColumnColor('LONG', i);
    ctx.fillRect(x, y, barW, h);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '10px sans-serif';
    ctx.fillText(`s${i} · ${s.numRows}`, x, canvas.height - 12);
  });
}
