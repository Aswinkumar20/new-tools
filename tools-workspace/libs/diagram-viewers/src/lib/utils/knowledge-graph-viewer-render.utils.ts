import type { KgEntity, KgLink } from '../types/knowledge-graph-viewer.types';

export function kgEntityColor(type: string, index: number): string {
  const lower = type.toLowerCase();
  if (lower === 'person' || lower === 'user') return '#f9a8d4';
  if (lower === 'service') return '#f0abfc';
  if (lower === 'dataset' || lower === 'data') return '#fcd34d';
  const colors = ['#f0abfc', '#e879f9', '#d946ef', '#f5d0fe', '#c026d3'];
  return colors[index % colors.length];
}

export function renderKgDiagram(canvas: HTMLCanvasElement, entities: KgEntity[], links: KgLink[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!entities.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No entities in this knowledge graph.', 16, 28);
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
  for (const l of links) {
    const a = pos.get(l.source);
    const b = pos.get(l.target);
    if (!a || !b) continue;
    ctx.strokeStyle = '#64748b';
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.fillStyle = '#f5d0fe';
    ctx.font = '10px sans-serif';
    ctx.fillText(l.rel.slice(0, 18), (a.x + b.x) / 2 - 12, (a.y + b.y) / 2 - 4);
  }
  entities.forEach((e, i) => {
    const p = pos.get(e.id);
    if (!p) return;
    ctx.fillStyle = e.id === selectedId ? '#fae8ff' : kgEntityColor(e.type, i);
    ctx.fillRect(p.x - 58, p.y - 18, 116, 36);
    ctx.fillStyle = '#4a044e';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(e.name.slice(0, 16), p.x - 52, p.y - 2);
    ctx.font = '10px sans-serif';
    ctx.fillText(e.type.slice(0, 18), p.x - 52, p.y + 12);
  });
}

export function renderKgEntities(canvas: HTMLCanvasElement, entities: KgEntity[], selectedId: string | null): void {
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
      ctx.fillStyle = 'rgba(162, 28, 175, 0.4)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = kgEntityColor(e.type, i);
    ctx.fillRect(16, y, 12, 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${e.name} · ${e.type}`, 36, y + 11);
  });
}

export function renderKgLinks(canvas: HTMLCanvasElement, links: KgLink[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!links.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No matching links in this view.', 16, 28);
    return;
  }
  const rowH = Math.min(36, Math.max(22, (canvas.height - 24) / links.length));
  links.forEach((l, i) => {
    const y = 16 + i * rowH;
    if (l.id === selectedId) {
      ctx.fillStyle = 'rgba(162, 28, 175, 0.4)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = '#f0abfc';
    ctx.fillRect(16, y, 8, 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${l.sourceName} ${l.rel} ${l.targetName}`, 32, y + 11);
  });
}
