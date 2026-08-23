import type { PrmModel, PrmRelation } from '../types/prisma-schema-viewer.types';

export function prmModelColor(kind: string, index: number): string {
  if (kind === 'enum') return '#f0abfc';
  const colors = ['#c4b5fd', '#a78bfa', '#8b5cf6', '#ddd6fe', '#7c3aed'];
  return colors[index % colors.length];
}

export function renderPrmDiagram(
  canvas: HTMLCanvasElement,
  models: PrmModel[],
  relations: PrmRelation[],
  selectedId: string | null
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!models.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No models in this Prisma schema.', 16, 28);
    return;
  }
  const xs = models.map((m) => m.x);
  const ys = models.map((m) => m.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);
  const pad = 48;
  const mapX = (x: number) => pad + ((x - minX) / spanX) * (canvas.width - pad * 2);
  const mapY = (y: number) => pad + ((y - minY) / spanY) * (canvas.height - pad * 2);
  const pos = new Map(models.map((m) => [m.id, { x: mapX(m.x), y: mapY(m.y) }] as const));
  ctx.lineWidth = 1.4;
  for (const r of relations) {
    const a = pos.get(r.source);
    const b = pos.get(r.target);
    if (!a || !b) continue;
    ctx.strokeStyle = '#64748b';
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    const label = `${r.sourceField || ''} ${r.kind} ${r.targetField || ''}`.trim();
    ctx.fillStyle = '#ddd6fe';
    ctx.font = '10px sans-serif';
    ctx.fillText(label.slice(0, 22), (a.x + b.x) / 2 - 18, (a.y + b.y) / 2 - 4);
  }
  models.forEach((model, i) => {
    const p = pos.get(model.id);
    if (!p) return;
    const h = 28 + Math.min(4, model.fields.length) * 12;
    ctx.fillStyle = model.id === selectedId ? '#ede9fe' : prmModelColor(model.kind, i);
    ctx.fillRect(p.x - 52, p.y - 18, 104, h);
    ctx.fillStyle = '#2e1065';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(model.name.slice(0, 16), p.x - 46, p.y - 4);
    ctx.font = '10px sans-serif';
    model.fields.slice(0, 4).forEach((field, fi) => {
      const mark = field.isId ? '@id ' : field.isUnique ? '@uq ' : field.relation ? 'rel ' : '';
      ctx.fillText(`${mark}${field.name}`.slice(0, 18), p.x - 46, p.y + 12 + fi * 12);
    });
  });
}

export function renderPrmModels(canvas: HTMLCanvasElement, models: PrmModel[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!models.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No matching models in this view.', 16, 28);
    return;
  }
  const rowH = Math.min(36, Math.max(22, (canvas.height - 24) / models.length));
  models.forEach((m, i) => {
    const y = 16 + i * rowH;
    if (m.id === selectedId) {
      ctx.fillStyle = 'rgba(76, 29, 149, 0.45)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = prmModelColor(m.kind, i);
    ctx.fillRect(16, y, 12, 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${m.name} · ${m.kind} · ${m.fields.length} fields`, 36, y + 11);
  });
}

export function renderPrmRelations(canvas: HTMLCanvasElement, relations: PrmRelation[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!relations.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No matching relations in this view.', 16, 28);
    return;
  }
  const rowH = Math.min(36, Math.max(22, (canvas.height - 24) / relations.length));
  relations.forEach((r, i) => {
    const y = 16 + i * rowH;
    if (r.id === selectedId) {
      ctx.fillStyle = 'rgba(76, 29, 149, 0.45)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = '#c4b5fd';
    ctx.fillRect(16, y, 8, 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${r.sourceName}.${r.sourceField} ${r.kind} ${r.targetName}.${r.targetField}`, 32, y + 11);
  });
}
