import type { C4Element, C4Relation } from '../types/c4-model-viewer.types';

export function c4ElementColor(kind: string, index: number): string {
  if (kind === 'person') return '#f472b6';
  if (kind === 'system') return '#38bdf8';
  if (kind === 'container') return '#2dd4bf';
  if (kind === 'component') return '#a78bfa';
  if (kind === 'boundary') return '#94a3b8';
  const colors = ['#22d3ee', '#67e8f9', '#5eead4', '#c4b5fd'];
  return colors[index % colors.length];
}

export function renderC4Diagram(
  canvas: HTMLCanvasElement,
  elements: C4Element[],
  relations: C4Relation[],
  selectedId: string | null
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!elements.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No C4 elements in this diagram.', 16, 28);
    return;
  }
  const xs = elements.map((e) => e.x);
  const ys = elements.map((e) => e.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);
  const pad = 40;
  const mapX = (x: number) => pad + ((x - minX) / spanX) * (canvas.width - pad * 2);
  const mapY = (y: number) => pad + ((y - minY) / spanY) * (canvas.height - pad * 2);
  const pos = new Map(elements.map((e) => [e.id, { x: mapX(e.x), y: mapY(e.y) }] as const));
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = '#64748b';
  for (const r of relations) {
    const a = pos.get(r.source);
    const b = pos.get(r.target);
    if (!a || !b) continue;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    if (r.label) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px sans-serif';
      ctx.fillText(r.label.slice(0, 18), (a.x + b.x) / 2, (a.y + b.y) / 2 - 4);
    }
  }
  elements.forEach((e, i) => {
    const p = pos.get(e.id);
    if (!p) return;
    ctx.fillStyle = e.id === selectedId ? '#a5f3fc' : c4ElementColor(e.kind, i);
    if (e.kind === 'person') {
      ctx.beginPath();
      ctx.arc(p.x, p.y - 8, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(p.x - 12, p.y + 2, 24, 16);
    } else if (e.kind === 'boundary') {
      ctx.strokeStyle = '#94a3b8';
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(p.x - 36, p.y - 18, 72, 36);
      ctx.setLineDash([]);
    } else {
      ctx.fillRect(p.x - 34, p.y - 16, 68, 32);
    }
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '11px sans-serif';
    ctx.fillText(e.name.slice(0, 14), p.x - 32, p.y + 30);
  });
}

export function renderC4Elements(canvas: HTMLCanvasElement, elements: C4Element[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!elements.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No matching C4 elements in this view.', 16, 28);
    return;
  }
  const rowH = Math.min(36, Math.max(22, (canvas.height - 24) / elements.length));
  elements.forEach((e, i) => {
    const y = 16 + i * rowH;
    if (e.id === selectedId) {
      ctx.fillStyle = 'rgba(14, 116, 144, 0.45)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = c4ElementColor(e.kind, i);
    ctx.fillRect(16, y, 12, 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${e.name} · ${e.kind}${e.technology ? ` · ${e.technology}` : ''}`, 36, y + 11);
  });
}

export function renderC4Relations(canvas: HTMLCanvasElement, relations: C4Relation[], selectedId: string | null): void {
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
      ctx.fillStyle = 'rgba(14, 116, 144, 0.45)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = '#22d3ee';
    ctx.fillRect(16, y, 8, 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${r.sourceName} → ${r.targetName}${r.label ? ` · ${r.label}` : ''}`, 32, y + 11);
  });
}
