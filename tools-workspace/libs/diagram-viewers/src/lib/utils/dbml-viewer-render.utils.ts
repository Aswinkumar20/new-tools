import type { DbmlRef, DbmlTable } from '../types/dbml-viewer.types';

export function dbmlTableColor(index: number): string {
  const colors = ['#818cf8', '#a5b4fc', '#6366f1', '#c7d2fe', '#4f46e5'];
  return colors[index % colors.length];
}

export function renderDbmlDiagram(
  canvas: HTMLCanvasElement,
  tables: DbmlTable[],
  refs: DbmlRef[],
  selectedId: string | null
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!tables.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No tables in this DBML schema.', 16, 28);
    return;
  }
  const xs = tables.map((t) => t.x);
  const ys = tables.map((t) => t.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);
  const pad = 48;
  const mapX = (x: number) => pad + ((x - minX) / spanX) * (canvas.width - pad * 2);
  const mapY = (y: number) => pad + ((y - minY) / spanY) * (canvas.height - pad * 2);
  const pos = new Map(tables.map((t) => [t.id, { x: mapX(t.x), y: mapY(t.y) }] as const));
  ctx.lineWidth = 1.4;
  for (const r of refs) {
    const a = pos.get(r.source);
    const b = pos.get(r.target);
    if (!a || !b) continue;
    ctx.strokeStyle = '#64748b';
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    const label = `${r.sourceColumn || ''} ${r.rel} ${r.targetColumn || ''}`.trim();
    if (label) {
      ctx.fillStyle = '#c7d2fe';
      ctx.font = '10px sans-serif';
      ctx.fillText(label.slice(0, 22), (a.x + b.x) / 2 - 18, (a.y + b.y) / 2 - 4);
    }
  }
  tables.forEach((table, i) => {
    const p = pos.get(table.id);
    if (!p) return;
    const h = 28 + Math.min(4, table.columns.length) * 12;
    ctx.fillStyle = table.id === selectedId ? '#c7d2fe' : dbmlTableColor(i);
    ctx.fillRect(p.x - 52, p.y - 18, 104, h);
    ctx.fillStyle = '#1e1b4b';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(table.name.slice(0, 16), p.x - 46, p.y - 4);
    ctx.font = '10px sans-serif';
    table.columns.slice(0, 4).forEach((col, ci) => {
      const mark = col.pk ? 'PK ' : col.fk ? 'FK ' : '';
      ctx.fillText(`${mark}${col.name}`.slice(0, 18), p.x - 46, p.y + 12 + ci * 12);
    });
  });
}

export function renderDbmlTables(canvas: HTMLCanvasElement, tables: DbmlTable[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!tables.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No matching tables in this view.', 16, 28);
    return;
  }
  const rowH = Math.min(36, Math.max(22, (canvas.height - 24) / tables.length));
  tables.forEach((t, i) => {
    const y = 16 + i * rowH;
    if (t.id === selectedId) {
      ctx.fillStyle = 'rgba(91, 33, 182, 0.45)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = dbmlTableColor(i);
    ctx.fillRect(16, y, 12, 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${t.name} · ${t.columns.length} cols`, 36, y + 11);
  });
}

export function renderDbmlRefs(canvas: HTMLCanvasElement, refs: DbmlRef[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!refs.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No matching refs in this view.', 16, 28);
    return;
  }
  const rowH = Math.min(36, Math.max(22, (canvas.height - 24) / refs.length));
  refs.forEach((r, i) => {
    const y = 16 + i * rowH;
    if (r.id === selectedId) {
      ctx.fillStyle = 'rgba(91, 33, 182, 0.45)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = '#818cf8';
    ctx.fillRect(16, y, 8, 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(
      `${r.sourceName}.${r.sourceColumn} ${r.rel} ${r.targetName}.${r.targetColumn}`,
      32,
      y + 11
    );
  });
}
