import type { GmlCommunity, GmlEdge, GmlNode } from '../types/graphml-viewer.types';

export function gmlCommunityColor(index: number): string {
  const colors = ['#c4b5fd', '#818cf8', '#38bdf8', '#34d399', '#fbbf24', '#fb7185', '#f472b6', '#fb923c'];
  return colors[index % colors.length];
}

export function gmlNodeColor(node: GmlNode, communities: GmlCommunity[]): string {
  const idx = Math.max(0, communities.findIndex((c) => c.name === node.community));
  return gmlCommunityColor(idx);
}

export function renderGmlDiagram(
  canvas: HTMLCanvasElement,
  nodes: GmlNode[],
  edges: GmlEdge[],
  communities: GmlCommunity[],
  selectedId: string | null
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!nodes.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No nodes in this GraphML network.', 16, 28);
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
    ctx.fillStyle = n.id === selectedId ? '#ede9fe' : gmlNodeColor(n, communities);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '11px sans-serif';
    ctx.fillText(n.label.slice(0, 14), p.x - 24, p.y + 24);
  });
}

export function renderGmlLayout(canvas: HTMLCanvasElement, nodes: GmlNode[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!nodes.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No matching nodes in this layout.', 16, 28);
    return;
  }
  const ranks = new Map<number, GmlNode[]>();
  for (const n of nodes) {
    const list = ranks.get(n.rank) ?? [];
    list.push(n);
    ranks.set(n.rank, list);
  }
  const cols = Math.max(1, ranks.size);
  const colW = (canvas.width - 32) / cols;
  [...ranks.keys()]
    .sort((a, b) => a - b)
    .forEach((rank, ci) => {
      const list = ranks.get(rank) ?? [];
      list.forEach((n, ri) => {
        const x = 24 + ci * colW;
        const y = 20 + ri * 28;
        if (n.id === selectedId) {
          ctx.fillStyle = 'rgba(126, 34, 206, 0.4)';
          ctx.fillRect(x - 8, y - 10, colW - 12, 24);
        }
        ctx.fillStyle = '#c4b5fd';
        ctx.fillRect(x, y - 6, 10, 10);
        ctx.fillStyle = '#e2e8f0';
        ctx.font = '11px sans-serif';
        ctx.fillText(`R${rank} · ${n.label}`.slice(0, 22), x + 16, y + 4);
      });
    });
}

export function renderGmlCommunities(
  canvas: HTMLCanvasElement,
  communities: GmlCommunity[],
  selectedId: string | null
): void {
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
  const rowH = Math.min(40, Math.max(24, (canvas.height - 24) / communities.length));
  communities.forEach((c, i) => {
    const y = 16 + i * rowH;
    if (c.id === selectedId || c.name === selectedId) {
      ctx.fillStyle = 'rgba(126, 34, 206, 0.4)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = gmlCommunityColor(i);
    ctx.fillRect(16, y, 12, 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${c.name} · ${c.size} nodes`, 36, y + 11);
  });
}

export function renderGmlEdges(canvas: HTMLCanvasElement, edges: GmlEdge[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!edges.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No matching edges in this view.', 16, 28);
    return;
  }
  const rowH = Math.min(36, Math.max(22, (canvas.height - 24) / edges.length));
  edges.forEach((e, i) => {
    const y = 16 + i * rowH;
    if (e.id === selectedId) {
      ctx.fillStyle = 'rgba(126, 34, 206, 0.4)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = '#c4b5fd';
    ctx.fillRect(16, y, 8, 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${e.sourceName} → ${e.targetName}${e.label ? ` · ${e.label}` : ''} (${e.weight})`, 32, y + 11);
  });
}
