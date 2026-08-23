import type { MmdEdge, MmdNode } from '../types/mermaid-diagram-viewer.types';

export function mmdNodeColor(shape: string, index: number): string {
  if (shape === 'diamond') return '#fbbf24';
  if (shape === 'participant') return '#34d399';
  if (shape === 'stadium' || shape === 'circle') return '#a78bfa';
  const colors = ['#34d399', '#38bdf8', '#f472b6', '#fbbf24', '#22d3ee'];
  return colors[index % colors.length];
}

function drawShape(ctx: CanvasRenderingContext2D, x: number, y: number, shape: string, selected: boolean, color: string): void {
  ctx.fillStyle = selected ? '#6ee7b7' : color;
  if (shape === 'diamond') {
    ctx.beginPath();
    ctx.moveTo(x, y - 16);
    ctx.lineTo(x + 18, y);
    ctx.lineTo(x, y + 16);
    ctx.lineTo(x - 18, y);
    ctx.closePath();
    ctx.fill();
    return;
  }
  if (shape === 'circle') {
    ctx.beginPath();
    ctx.arc(x, y, 14, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  if (shape === 'round' || shape === 'stadium' || shape === 'participant') {
    const w = shape === 'participant' ? 70 : 56;
    const h = 22;
    const r = 11;
    ctx.beginPath();
    ctx.moveTo(x - w / 2 + r, y - h / 2);
    ctx.arcTo(x + w / 2, y - h / 2, x + w / 2, y + h / 2, r);
    ctx.arcTo(x + w / 2, y + h / 2, x - w / 2, y + h / 2, r);
    ctx.arcTo(x - w / 2, y + h / 2, x - w / 2, y - h / 2, r);
    ctx.arcTo(x - w / 2, y - h / 2, x + w / 2, y - h / 2, r);
    ctx.closePath();
    ctx.fill();
    return;
  }
  ctx.fillRect(x - 28, y - 12, 56, 24);
}

export function renderMmdDiagram(
  canvas: HTMLCanvasElement,
  nodes: MmdNode[],
  edges: MmdEdge[],
  kind: string,
  selectedId: string | null
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!nodes.length) return;
  if (kind === 'sequence') {
    renderSequence(ctx, canvas, nodes, edges, selectedId);
    return;
  }
  const xs = nodes.map((n) => n.x);
  const ys = nodes.map((n) => n.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);
  const pad = 36;
  const mapX = (x: number) => pad + ((x - minX) / spanX) * (canvas.width - pad * 2);
  const mapY = (y: number) => pad + ((y - minY) / spanY) * (canvas.height - pad * 2);
  const pos = new Map(nodes.map((n) => [n.id, { x: mapX(n.x), y: mapY(n.y) }] as const));
  for (const e of edges) {
    const a = pos.get(e.source);
    const b = pos.get(e.target);
    if (!a || !b) continue;
    ctx.strokeStyle = e.style === 'dotted' ? '#94a3b8' : '#64748b';
    ctx.setLineDash(e.style === 'dotted' ? [4, 4] : []);
    ctx.lineWidth = e.style === 'thick' ? 3 : 1.5;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.setLineDash([]);
    if (e.label) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px sans-serif';
      ctx.fillText(e.label.slice(0, 18), (a.x + b.x) / 2, (a.y + b.y) / 2 - 4);
    }
  }
  nodes.forEach((n, i) => {
    const p = pos.get(n.id);
    if (!p) return;
    drawShape(ctx, p.x, p.y, n.shape, n.id === selectedId, mmdNodeColor(n.shape, i));
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '11px sans-serif';
    ctx.fillText(n.name.slice(0, 18), p.x - 24, p.y + 28);
  });
}

function renderSequence(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  nodes: MmdNode[],
  edges: MmdEdge[],
  selectedId: string | null
): void {
  const pad = 40;
  const slot = Math.max(90, (canvas.width - pad * 2) / Math.max(1, nodes.length));
  nodes.forEach((n, i) => {
    const x = pad + i * slot + slot / 2;
    drawShape(ctx, x, 28, 'participant', n.id === selectedId, mmdNodeColor('participant', i));
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '11px sans-serif';
    ctx.fillText(n.name.slice(0, 14), x - 28, 52);
    ctx.strokeStyle = '#475569';
    ctx.beginPath();
    ctx.moveTo(x, 58);
    ctx.lineTo(x, canvas.height - 12);
    ctx.stroke();
  });
  const indexOf = (id: string) => Math.max(0, nodes.findIndex((n) => n.id === id));
  edges.forEach((e, i) => {
    const y = 70 + i * 28;
    const ax = pad + indexOf(e.source) * slot + slot / 2;
    const bx = pad + indexOf(e.target) * slot + slot / 2;
    ctx.strokeStyle = e.style === 'return' ? '#94a3b8' : '#34d399';
    ctx.setLineDash(e.style === 'return' ? [4, 3] : []);
    ctx.beginPath();
    ctx.moveTo(ax, y);
    ctx.lineTo(bx, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '10px sans-serif';
    ctx.fillText(e.label.slice(0, 22), Math.min(ax, bx) + 8, y - 4);
  });
}

export function renderMmdNodes(canvas: HTMLCanvasElement, nodes: MmdNode[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!nodes.length) return;
  const rowH = Math.min(36, Math.max(22, (canvas.height - 24) / nodes.length));
  nodes.forEach((n, i) => {
    const y = 16 + i * rowH;
    if (n.id === selectedId) {
      ctx.fillStyle = 'rgba(5, 150, 105, 0.4)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = mmdNodeColor(n.shape, i);
    ctx.fillRect(16, y, 12, 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${n.name} · ${n.shape}`, 36, y + 11);
  });
}

export function renderMmdEdges(canvas: HTMLCanvasElement, edges: MmdEdge[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!edges.length) return;
  const rowH = Math.min(36, Math.max(22, (canvas.height - 24) / edges.length));
  edges.forEach((e, i) => {
    const y = 16 + i * rowH;
    if (e.id === selectedId) {
      ctx.fillStyle = 'rgba(5, 150, 105, 0.4)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = '#34d399';
    ctx.fillRect(16, y, 8, 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${e.sourceName} → ${e.targetName}${e.label ? ` · ${e.label}` : ''}`, 32, y + 11);
  });
}
