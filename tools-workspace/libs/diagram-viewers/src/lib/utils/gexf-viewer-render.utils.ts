import type { GxfCommunity, GxfEdge, GxfNode } from '../types/gexf-viewer.types';

export function gxfCommunityColor(index: number): string {
  const colors = ['#fdba74', '#f97316', '#38bdf8', '#34d399', '#fbbf24', '#fb7185', '#c4b5fd', '#f472b6'];
  return colors[index % colors.length];
}

export function gxfNodeColor(node: GxfNode, communities: GxfCommunity[]): string {
  const idx = Math.max(0, communities.findIndex((c) => c.name === node.community));
  return gxfCommunityColor(idx);
}

function drawNetwork(
  canvas: HTMLCanvasElement,
  nodes: GxfNode[],
  edges: GxfEdge[],
  communities: GxfCommunity[],
  selectedId: string | null,
  emptyMessage: string
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!nodes.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText(emptyMessage, 16, 28);
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
  ctx.lineWidth = 1.3;
  ctx.strokeStyle = '#64748b';
  for (const e of edges) {
    const a = pos.get(e.source);
    const b = pos.get(e.target);
    if (!a || !b) continue;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    if (e.label) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px sans-serif';
      ctx.fillText(e.label.slice(0, 16), (a.x + b.x) / 2, (a.y + b.y) / 2 - 4);
    }
  }
  nodes.forEach((n) => {
    const p = pos.get(n.id);
    if (!p) return;
    ctx.fillStyle = n.id === selectedId ? '#ffedd5' : gxfNodeColor(n, communities);
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(8, Math.min(16, 8 + n.size)), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '11px sans-serif';
    ctx.fillText(n.label.slice(0, 14), p.x - 24, p.y + 24);
  });
}

export function renderGxfDiagram(
  canvas: HTMLCanvasElement,
  nodes: GxfNode[],
  edges: GxfEdge[],
  communities: GxfCommunity[],
  selectedId: string | null
): void {
  drawNetwork(canvas, nodes, edges, communities, selectedId, 'No nodes in this GEXF network.');
}

export function renderGxfTimeline(
  canvas: HTMLCanvasElement,
  nodes: GxfNode[],
  edges: GxfEdge[],
  communities: GxfCommunity[],
  selectedId: string | null,
  time: number
): void {
  drawNetwork(canvas, nodes, edges, communities, selectedId, `No nodes active at t=${time}.`);
}

export function renderGxfCommunities(canvas: HTMLCanvasElement, communities: GxfCommunity[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!communities.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No communities in this network.', 16, 28);
    return;
  }
  const colW = Math.max(120, (canvas.width - 40) / Math.min(communities.length, 4));
  communities.forEach((c, i) => {
    const x = 20 + (i % 4) * colW;
    const y = 28 + Math.floor(i / 4) * 70;
    ctx.fillStyle = c.id === selectedId || c.name === selectedId ? '#ffedd5' : gxfCommunityColor(i);
    ctx.fillRect(x, y, colW - 16, 52);
    ctx.fillStyle = '#0f172a';
    ctx.font = '12px sans-serif';
    ctx.fillText(c.name.slice(0, 16), x + 8, y + 22);
    ctx.fillText(`${c.size} nodes`, x + 8, y + 40);
  });
}

export function renderGxfEdges(canvas: HTMLCanvasElement, edges: GxfEdge[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#e2e8f0';
  ctx.font = '12px sans-serif';
  if (!edges.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('No matching edges.', 16, 28);
    return;
  }
  edges.slice(0, 12).forEach((e, i) => {
    ctx.fillStyle = e.id === selectedId ? '#fdba74' : '#e2e8f0';
    ctx.fillText(`${e.sourceName} → ${e.targetName}  t=${e.start || '—'}–${e.end || '—'}`, 16, 24 + i * 18);
  });
}
