import type { DtEdge, DtNode } from '../types/decision-tree-viewer.types';

export function dtNodeColor(kind: string, index: number): string {
  if (kind === 'root') return '#fdba74';
  if (kind === 'leaf') return '#6ee7b7';
  const colors = ['#fb923c', '#f97316', '#ea580c', '#fdba74', '#c2410c'];
  return colors[index % colors.length];
}

export function renderDtDiagram(
  canvas: HTMLCanvasElement,
  nodes: DtNode[],
  edges: DtEdge[],
  selectedId: string | null
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!nodes.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No nodes in this decision tree.', 16, 28);
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
  const pad = 48;
  const mapX = (x: number) => pad + ((x - minX) / spanX) * (canvas.width - pad * 2);
  const mapY = (y: number) => pad + ((y - minY) / spanY) * (canvas.height - pad * 2);
  const pos = new Map(nodes.map((n) => [n.id, { x: mapX(n.x), y: mapY(n.y) }] as const));
  ctx.lineWidth = 1.4;
  for (const e of edges) {
    const a = pos.get(e.source);
    const b = pos.get(e.target);
    if (!a || !b) continue;
    ctx.strokeStyle = '#64748b';
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.fillStyle = '#fdba74';
    ctx.font = '10px sans-serif';
    ctx.fillText((e.label || '').slice(0, 12), (a.x + b.x) / 2 - 8, (a.y + b.y) / 2 - 4);
  }
  nodes.forEach((n, i) => {
    const p = pos.get(n.id);
    if (!p) return;
    ctx.fillStyle = n.id === selectedId ? '#ffedd5' : dtNodeColor(n.kind, i);
    if (n.kind === 'leaf') {
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, 58, 20, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(p.x - 62, p.y - 20, 124, 40);
    }
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(n.name.slice(0, 16), p.x - 40, p.y + 4);
  });
}

export function renderDtBranches(canvas: HTMLCanvasElement, nodes: DtNode[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!nodes.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No matching branches in this view.', 16, 28);
    return;
  }
  const rowH = Math.min(36, Math.max(22, (canvas.height - 24) / nodes.length));
  nodes.forEach((n, i) => {
    const y = 16 + i * rowH;
    if (n.id === selectedId) {
      ctx.fillStyle = 'rgba(234, 88, 12, 0.45)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = dtNodeColor(n.kind, i);
    ctx.fillRect(16, y, 12, 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${n.name} · ${n.kind}`, 36, y + 11);
  });
}

export function renderDtLeaves(canvas: HTMLCanvasElement, nodes: DtNode[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!nodes.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No matching leaves in this view.', 16, 28);
    return;
  }
  const rowH = Math.min(36, Math.max(22, (canvas.height - 24) / nodes.length));
  nodes.forEach((n, i) => {
    const y = 16 + i * rowH;
    if (n.id === selectedId) {
      ctx.fillStyle = 'rgba(234, 88, 12, 0.45)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = '#6ee7b7';
    ctx.fillRect(16, y, 8, 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(n.value || n.name, 32, y + 11);
  });
}
