import type { CdgRelation, CdgType } from '../types/class-diagram-viewer.types';

export function cdgTypeColor(kind: string, index: number): string {
  if (kind === 'interface') return '#38bdf8';
  if (kind === 'enum') return '#fbbf24';
  if (kind === 'abstract') return '#a78bfa';
  const colors = ['#2dd4bf', '#5eead4', '#99f6e4', '#67e8f9'];
  return colors[index % colors.length];
}

export function renderCdgDiagram(
  canvas: HTMLCanvasElement,
  types: CdgType[],
  relations: CdgRelation[],
  selectedId: string | null
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!types.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No types in this class diagram.', 16, 28);
    return;
  }
  const xs = types.map((t) => t.x);
  const ys = types.map((t) => t.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);
  const pad = 40;
  const mapX = (x: number) => pad + ((x - minX) / spanX) * (canvas.width - pad * 2);
  const mapY = (y: number) => pad + ((y - minY) / spanY) * (canvas.height - pad * 2);
  const pos = new Map(types.map((t) => [t.id, { x: mapX(t.x), y: mapY(t.y) }] as const));
  ctx.lineWidth = 1.4;
  for (const r of relations) {
    const a = pos.get(r.source);
    const b = pos.get(r.target);
    if (!a || !b) continue;
    ctx.strokeStyle = '#64748b';
    ctx.setLineDash(r.style === 'depend' || r.style === 'realize' ? [4, 4] : []);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.setLineDash([]);
    const label = [r.label, r.sourceCard && r.targetCard ? `${r.sourceCard}..${r.targetCard}` : r.sourceCard || r.targetCard]
      .filter(Boolean)
      .join(' ');
    if (label) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px sans-serif';
      ctx.fillText(label.slice(0, 22), (a.x + b.x) / 2, (a.y + b.y) / 2 - 4);
    }
  }
  types.forEach((t, i) => {
    const p = pos.get(t.id);
    if (!p) return;
    const w = 92;
    const h = 52;
    ctx.fillStyle = t.id === selectedId ? '#ccfbf1' : cdgTypeColor(t.kind, i);
    ctx.fillRect(p.x - w / 2, p.y - h / 2, w, h);
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.35)';
    ctx.strokeRect(p.x - w / 2, p.y - h / 2, w, h);
    ctx.fillStyle = '#0f172a';
    ctx.font = '11px sans-serif';
    ctx.fillText(t.name.slice(0, 12), p.x - w / 2 + 6, p.y - 8);
    ctx.fillStyle = '#134e4a';
    ctx.font = '9px sans-serif';
    const attr = t.attributes[0];
    const op = t.operations[0];
    if (attr) ctx.fillText(`${attr.name}${attr.type ? `: ${attr.type}` : ''}`.slice(0, 14), p.x - w / 2 + 6, p.y + 6);
    if (op) ctx.fillText(`${op.name}()`.slice(0, 14), p.x - w / 2 + 6, p.y + 18);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '10px sans-serif';
    ctx.fillText(t.kind, p.x - w / 2 + 6, p.y + h / 2 + 14);
  });
}

export function renderCdgTypes(canvas: HTMLCanvasElement, types: CdgType[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!types.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No matching types in this view.', 16, 28);
    return;
  }
  const rowH = Math.min(40, Math.max(24, (canvas.height - 24) / types.length));
  types.forEach((t, i) => {
    const y = 16 + i * rowH;
    if (t.id === selectedId) {
      ctx.fillStyle = 'rgba(15, 118, 110, 0.4)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = cdgTypeColor(t.kind, i);
    ctx.fillRect(16, y, 12, 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(
      `${t.name} · ${t.kind} · ${t.attributes.length} attr · ${t.operations.length} op`,
      36,
      y + 11
    );
  });
}

export function renderCdgRelations(canvas: HTMLCanvasElement, relations: CdgRelation[], selectedId: string | null): void {
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
      ctx.fillStyle = 'rgba(15, 118, 110, 0.4)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = '#2dd4bf';
    ctx.fillRect(16, y, 8, 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    const cards = r.sourceCard || r.targetCard ? ` (${r.sourceCard || '·'} → ${r.targetCard || '·'})` : '';
    ctx.fillText(`${r.sourceName} → ${r.targetName}${r.label ? ` · ${r.label}` : ''}${cards}`, 32, y + 11);
  });
}
