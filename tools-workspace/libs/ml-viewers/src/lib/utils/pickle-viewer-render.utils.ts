import type { PkTypeHint, PkWarning } from '../types/pickle-viewer.types';

export function pkTypeColor(type: string, index: number): string {
  const t = type.toUpperCase();
  if (t === 'CLASS') return '#86efac';
  if (t === 'ARRAY' || t === 'NDARRAY') return '#67e8f9';
  if (t === 'MAPPING' || t === 'DICT') return '#fde68a';
  if (t === 'MODULE') return '#fdba74';
  if (t === 'FUNCTION') return '#c4b5fd';
  if (t === 'DANGER' || t === 'WARN') return '#fca5a5';
  if (t === 'INFO') return '#86efac';
  const colors = ['#4ade80', '#16a34a', '#15803d', '#86efac', '#bbf7d0'];
  return colors[index % colors.length];
}

export function renderPkTypes(canvas: HTMLCanvasElement, types: PkTypeHint[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!types.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No type hints in this pickle dump.', 16, 28);
    return;
  }
  const visible = types.slice(0, 24);
  const rowH = Math.min(28, Math.max(18, (canvas.height - 24) / visible.length));
  visible.forEach((t, i) => {
    const y = 14 + i * rowH;
    if (t.id === selectedId) {
      ctx.fillStyle = 'rgba(22, 163, 74, 0.55)';
      ctx.fillRect(8, y - 4, canvas.width - 16, rowH - 2);
    }
    ctx.fillStyle = pkTypeColor(t.kind, i);
    ctx.fillRect(16, y, 10, 10);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${t.qualified || t.name} · ${t.kind}`.slice(0, 84), 32, y + 10);
  });
}

export function renderPkWarnings(canvas: HTMLCanvasElement, items: PkWarning[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!items.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No warnings in this pickle dump.', 16, 28);
    return;
  }
  const visible = items.slice(0, 24);
  const rowH = Math.min(28, Math.max(18, (canvas.height - 24) / visible.length));
  visible.forEach((w, i) => {
    const y = 14 + i * rowH;
    if (w.id === selectedId) {
      ctx.fillStyle = 'rgba(22, 163, 74, 0.55)';
      ctx.fillRect(8, y - 4, canvas.width - 16, rowH - 2);
    }
    ctx.fillStyle = pkTypeColor(w.level === 'danger' ? 'DANGER' : w.level === 'warn' ? 'WARN' : 'INFO', i);
    ctx.fillRect(16, y, 10, 10);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${w.level} · ${w.message}`.slice(0, 84), 32, y + 10);
  });
}

export function renderPkPreview(canvas: HTMLCanvasElement, rows: Array<Record<string, string>>, selectedIndex: number | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!rows.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No preview types in this view.', 16, 28);
    return;
  }
  const rowH = Math.min(36, Math.max(22, (canvas.height - 24) / rows.length));
  rows.forEach((row, i) => {
    const y = 16 + i * rowH;
    if (i === selectedIndex) {
      ctx.fillStyle = 'rgba(22, 163, 74, 0.55)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = pkTypeColor(row.kind || 'STRING', i);
    ctx.fillRect(16, y, 8, 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${row.name || ''} · ${row.module || ''} · ${row.kind || ''}`.slice(0, 72), 32, y + 11);
  });
}
