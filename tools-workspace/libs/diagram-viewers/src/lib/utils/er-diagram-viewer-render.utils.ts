import type { ErEntity, ErKey, ErRelation } from '../types/er-diagram-viewer.types';

export function erEntityColor(index: number): string {
  const colors = ['#fb7185', '#fda4af', '#f43f5e', '#fecdd3', '#e11d48'];
  return colors[index % colors.length];
}

export function erKeyColor(kind: string): string {
  if (kind === 'pk') return '#fbbf24';
  if (kind === 'fk') return '#38bdf8';
  return '#a78bfa';
}

export function renderErDiagram(
  canvas: HTMLCanvasElement,
  entities: ErEntity[],
  relations: ErRelation[],
  selectedId: string | null
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!entities.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No entities in this ER diagram.', 16, 28);
    return;
  }
  const xs = entities.map((e) => e.x);
  const ys = entities.map((e) => e.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);
  const pad = 48;
  const mapX = (x: number) => pad + ((x - minX) / spanX) * (canvas.width - pad * 2);
  const mapY = (y: number) => pad + ((y - minY) / spanY) * (canvas.height - pad * 2);
  const pos = new Map(entities.map((e) => [e.id, { x: mapX(e.x), y: mapY(e.y) }] as const));
  ctx.lineWidth = 1.4;
  for (const r of relations) {
    const a = pos.get(r.source);
    const b = pos.get(r.target);
    if (!a || !b) continue;
    ctx.strokeStyle = '#64748b';
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    const label = [r.sourceCard, r.label, r.targetCard].filter(Boolean).join(' ');
    if (label) {
      ctx.fillStyle = '#fda4af';
      ctx.font = '10px sans-serif';
      ctx.fillText(label.slice(0, 22), (a.x + b.x) / 2 - 18, (a.y + b.y) / 2 - 4);
    }
  }
  entities.forEach((entity, i) => {
    const p = pos.get(entity.id);
    if (!p) return;
    const h = 28 + Math.min(4, entity.columns.length) * 12;
    ctx.fillStyle = entity.id === selectedId ? '#fecdd3' : erEntityColor(i);
    ctx.fillRect(p.x - 52, p.y - 18, 104, h);
    ctx.fillStyle = '#1f0a12';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(entity.name.slice(0, 16), p.x - 46, p.y - 4);
    ctx.font = '10px sans-serif';
    entity.columns.slice(0, 4).forEach((col, ci) => {
      const mark = col.pk ? 'PK ' : col.fk ? 'FK ' : '';
      ctx.fillText(`${mark}${col.name}`.slice(0, 18), p.x - 46, p.y + 12 + ci * 12);
    });
  });
}

export function renderErEntities(canvas: HTMLCanvasElement, entities: ErEntity[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!entities.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No matching entities in this view.', 16, 28);
    return;
  }
  const rowH = Math.min(36, Math.max(22, (canvas.height - 24) / entities.length));
  entities.forEach((e, i) => {
    const y = 16 + i * rowH;
    if (e.id === selectedId) {
      ctx.fillStyle = 'rgba(159, 18, 57, 0.45)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = erEntityColor(i);
    ctx.fillRect(16, y, 12, 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${e.name} · ${e.columns.length} cols`, 36, y + 11);
  });
}

export function renderErKeys(canvas: HTMLCanvasElement, keys: ErKey[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!keys.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No matching keys in this view.', 16, 28);
    return;
  }
  const rowH = Math.min(36, Math.max(22, (canvas.height - 24) / keys.length));
  keys.forEach((k, i) => {
    const yy = 16 + i * rowH;
    if (k.id === selectedId) {
      ctx.fillStyle = 'rgba(159, 18, 57, 0.45)';
      ctx.fillRect(8, yy - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = erKeyColor(k.kind);
    ctx.fillRect(16, yy, 12, 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    const ref = k.kind === 'fk' && k.refEntity ? ` → ${k.refEntity}.${k.refColumn || 'id'}` : '';
    ctx.fillText(`${k.entityName}.${k.column} · ${k.kind.toUpperCase()}${ref}`, 36, yy + 11);
  });
}

export function renderErRelations(canvas: HTMLCanvasElement, relations: ErRelation[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!relations.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No matching relationships in this view.', 16, 28);
    return;
  }
  const rowH = Math.min(36, Math.max(22, (canvas.height - 24) / relations.length));
  relations.forEach((r) => {
    const y = 16 + relations.indexOf(r) * rowH;
    if (r.id === selectedId) {
      ctx.fillStyle = 'rgba(159, 18, 57, 0.45)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = '#fb7185';
    ctx.fillRect(16, y, 8, 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(
      `${r.sourceName} ${r.sourceCard}→${r.targetCard} ${r.targetName}${r.label ? ` · ${r.label}` : ''}`,
      32,
      y + 11
    );
  });
}
