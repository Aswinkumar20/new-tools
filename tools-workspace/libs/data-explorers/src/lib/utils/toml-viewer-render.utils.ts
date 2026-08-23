import type { TmKey, TmTable } from '../types/toml-viewer.types';

export function tmTypeColor(type: string, index: number): string {
  const t = type.toUpperCase();
  if (t === 'NUMBER' || t.includes('INT') || t.includes('FLOAT')) return '#67e8f9';
  if (t === 'BOOLEAN') return '#a5f3fc';
  if (t === 'DATETIME' || t === 'DATE') return '#cffafe';
  if (t === 'ARRAY' || t === 'TABLE') return '#22d3ee';
  if (t === 'STRING') return '#a5f3fc';
  const colors = ['#22d3ee', '#06b6d4', '#0891b2', '#67e8f9', '#a5f3fc'];
  return colors[index % colors.length];
}

export function renderTmTables(canvas: HTMLCanvasElement, tables: TmTable[], selectedIndex: number | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!tables.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No tables in this TOML document.', 16, 28);
    return;
  }
  const maxKeys = Math.max(1, ...tables.map((t) => t.keyCount || 1));
  const barW = Math.max(24, (canvas.width - 40) / tables.length - 12);
  tables.forEach((t, i) => {
    const x = 24 + i * (barW + 12);
    const h = Math.max(8, (t.keyCount / maxKeys) * (canvas.height - 48));
    const y = canvas.height - 28 - h;
    ctx.fillStyle = i === selectedIndex ? '#a5f3fc' : tmTypeColor(t.kind, i);
    ctx.fillRect(x, y, barW, h);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '10px sans-serif';
    ctx.fillText(t.name.slice(0, 10), x, canvas.height - 12);
  });
}

export function renderTmKeys(canvas: HTMLCanvasElement, keys: TmKey[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!keys.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No keys in this TOML table.', 16, 28);
    return;
  }
  const visible = keys.slice(0, 24);
  const rowH = Math.min(28, Math.max(18, (canvas.height - 24) / visible.length));
  visible.forEach((k, i) => {
    const y = 14 + i * rowH;
    if (k.id === selectedId) {
      ctx.fillStyle = 'rgba(21, 94, 117, 0.65)';
      ctx.fillRect(8, y - 4, canvas.width - 16, rowH - 2);
    }
    ctx.fillStyle = tmTypeColor(k.type, i);
    ctx.fillRect(16, y, 10, 10);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${k.path} · ${k.type} · ${k.value}`.slice(0, 84), 32, y + 10);
  });
}

export function renderTmPreview(canvas: HTMLCanvasElement, rows: Array<Record<string, string>>, selectedIndex: number | null): void {
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
      ctx.fillStyle = 'rgba(21, 94, 117, 0.65)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = '#67e8f9';
    ctx.fillRect(16, y, 8, 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(Object.values(row).slice(0, 4).join(' · ').slice(0, 72), 32, y + 11);
  });
}
