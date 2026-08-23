import type { CmapLink, CmapNode } from '../types/concept-map-viewer.types';

export function cmapNodeColor(index: number): string {
  const colors = ['#a78bfa', '#c4b5fd', '#8b5cf6', '#ddd6fe', '#7c3aed'];
  return colors[index % colors.length];
}

export function renderCmapDiagram(
  canvas: HTMLCanvasElement,
  nodes: CmapNode[],
  links: CmapLink[],
  selectedId: string | null
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!nodes.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No nodes in this concept map.', 16, 28);
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
  for (const l of links) {
    const a = pos.get(l.source);
    const b = pos.get(l.target);
    if (!a || !b) continue;
    ctx.strokeStyle = '#64748b';
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    if (l.label) {
      ctx.fillStyle = '#c4b5fd';
      ctx.font = '10px sans-serif';
      ctx.fillText(l.label.slice(0, 18), (a.x + b.x) / 2 - 12, (a.y + b.y) / 2 - 4);
    }
  }
  nodes.forEach((node, i) => {
    const p = pos.get(node.id);
    if (!p) return;
    ctx.fillStyle = node.id === selectedId ? '#f5d0fe' : cmapNodeColor(i);
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, 42, 22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1e1b4b';
    ctx.font = '11px sans-serif';
    ctx.fillText(node.label.slice(0, 14), p.x - 34, p.y + 4);
  });
}

export function renderCmapNodes(canvas: HTMLCanvasElement, nodes: CmapNode[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!nodes.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No matching nodes in this view.', 16, 28);
    return;
  }
  const rowH = Math.min(36, Math.max(22, (canvas.height - 24) / nodes.length));
  nodes.forEach((n, i) => {
    const y = 16 + i * rowH;
    if (n.id === selectedId) {
      ctx.fillStyle = 'rgba(109, 40, 217, 0.45)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = cmapNodeColor(i);
    ctx.beginPath();
    ctx.ellipse(22, y + 6, 8, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(n.label + (n.note ? ` · ${n.note}` : ''), 36, y + 11);
  });
}

export function renderCmapLinks(canvas: HTMLCanvasElement, links: CmapLink[], selectedId: string | null): void {
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
      ctx.fillStyle = 'rgba(109, 40, 217, 0.45)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = '#a78bfa';
    ctx.fillRect(16, y, 8, 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${l.sourceName} → ${l.targetName}${l.label ? ` · ${l.label}` : ''}`, 32, y + 11);
  });
}
