import type { PumlElement, PumlRelation } from '../types/plantuml-viewer.types';

export function pumlElementColor(kind: string, index: number): string {
  if (kind === 'interface') return '#38bdf8';
  if (kind === 'enum') return '#fbbf24';
  if (kind === 'person') return '#f472b6';
  if (kind === 'system' || kind === 'container' || kind === 'component') return '#a78bfa';
  if (kind === 'boundary') return '#94a3b8';
  if (kind === 'actor' || kind === 'usecase') return '#34d399';
  const colors = ['#c084fc', '#818cf8', '#f0abfc', '#67e8f9'];
  return colors[index % colors.length];
}

export function renderPumlDiagram(
  canvas: HTMLCanvasElement,
  elements: PumlElement[],
  relations: PumlRelation[],
  selectedId: string | null
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!elements.length) return;
  const xs = elements.map((e) => e.x);
  const ys = elements.map((e) => e.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);
  const pad = 36;
  const mapX = (x: number) => pad + ((x - minX) / spanX) * (canvas.width - pad * 2);
  const mapY = (y: number) => pad + ((y - minY) / spanY) * (canvas.height - pad * 2);
  const pos = new Map(elements.map((e) => [e.id, { x: mapX(e.x), y: mapY(e.y) }] as const));
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 1.4;
  for (const r of relations) {
    const a = pos.get(r.source);
    const b = pos.get(r.target);
    if (!a || !b) continue;
    ctx.setLineDash(r.style === 'depend' || r.style === 'realize' ? [4, 4] : []);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.setLineDash([]);
    if (r.label) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px sans-serif';
      ctx.fillText(r.label.slice(0, 18), (a.x + b.x) / 2, (a.y + b.y) / 2 - 4);
    }
  }
  elements.forEach((e, i) => {
    const p = pos.get(e.id);
    if (!p) return;
    ctx.fillStyle = e.id === selectedId ? '#e9d5ff' : pumlElementColor(e.kind, i);
    if (e.kind === 'person') {
      ctx.beginPath();
      ctx.arc(p.x, p.y - 6, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(p.x - 10, p.y + 4, 20, 14);
    } else if (e.kind === 'interface') {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 12, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(p.x - 30, p.y - 14, 60, 28);
    }
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '11px sans-serif';
    ctx.fillText(e.name.slice(0, 16), p.x - 28, p.y + 30);
  });
}

export function renderPumlElements(canvas: HTMLCanvasElement, elements: PumlElement[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!elements.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No matching elements in this view.', 16, 28);
    return;
  }
  const rowH = Math.min(36, Math.max(22, (canvas.height - 24) / elements.length));
  elements.forEach((e, i) => {
    const y = 16 + i * rowH;
    if (e.id === selectedId) {
      ctx.fillStyle = 'rgba(107, 33, 168, 0.4)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = pumlElementColor(e.kind, i);
    ctx.fillRect(16, y, 12, 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${e.name} · ${e.kind}`, 36, y + 11);
  });
}

export function renderPumlRelations(canvas: HTMLCanvasElement, relations: PumlRelation[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!relations.length) return;
  const rowH = Math.min(36, Math.max(22, (canvas.height - 24) / relations.length));
  relations.forEach((r, i) => {
    const y = 16 + i * rowH;
    if (r.id === selectedId) {
      ctx.fillStyle = 'rgba(107, 33, 168, 0.4)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = '#c084fc';
    ctx.fillRect(16, y, 8, 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${r.sourceName} → ${r.targetName}${r.label ? ` · ${r.label}` : ''}`, 32, y + 11);
  });
}
