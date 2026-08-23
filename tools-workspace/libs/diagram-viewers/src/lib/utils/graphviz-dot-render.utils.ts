import type { GvzEdge, GvzNode } from '../types/graphviz-dot-viewer.types';

export function gvzNodeColor(shape: string, index: number): string {
  if (shape === 'diamond') return '#fbbf24';
  if (shape === 'circle' || shape === 'ellipse') return '#38bdf8';
  const colors = ['#60a5fa', '#34d399', '#a78bfa', '#f472b6', '#22d3ee'];
  return colors[index % colors.length];
}

export function renderGvzGraph(
  canvas: HTMLCanvasElement,
  nodes: GvzNode[],
  edges: GvzEdge[],
  selectedId: string | null
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!nodes.length) return;
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
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 1.5;
  for (const e of edges) {
    const a = pos.get(e.source);
    const b = pos.get(e.target);
    if (!a || !b) continue;
    ctx.setLineDash(e.directed ? [] : [5, 4]);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.setLineDash([]);
    if (e.label) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px sans-serif';
      ctx.fillText(e.label.slice(0, 16), (a.x + b.x) / 2, (a.y + b.y) / 2 - 4);
    }
  }
  nodes.forEach((n, i) => {
    const p = pos.get(n.id);
    if (!p) return;
    ctx.fillStyle = n.id === selectedId ? '#93c5fd' : gvzNodeColor(n.shape, i);
    if (n.shape === 'circle' || n.shape === 'ellipse') {
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, n.shape === 'circle' ? 14 : 22, 14, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (n.shape === 'diamond') {
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - 14);
      ctx.lineTo(p.x + 16, p.y);
      ctx.lineTo(p.x, p.y + 14);
      ctx.lineTo(p.x - 16, p.y);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillRect(p.x - 28, p.y - 12, 56, 24);
    }
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '11px sans-serif';
    ctx.fillText(n.name.slice(0, 16), p.x - 26, p.y + 28);
  });
}

export function renderGvzNodes(canvas: HTMLCanvasElement, nodes: GvzNode[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!nodes.length) return;
  const rowH = Math.min(36, Math.max(22, (canvas.height - 24) / nodes.length));
  nodes.forEach((n, i) => {
    const y = 16 + i * rowH;
    if (n.id === selectedId) {
      ctx.fillStyle = 'rgba(29, 78, 216, 0.4)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = gvzNodeColor(n.shape, i);
    ctx.fillRect(16, y, 12, 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${n.name} · ${n.shape}`, 36, y + 11);
  });
}

export function renderGvzEdges(canvas: HTMLCanvasElement, edges: GvzEdge[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!edges.length) return;
  const rowH = Math.min(36, Math.max(22, (canvas.height - 24) / edges.length));
  edges.forEach((e, i) => {
    const y = 16 + i * rowH;
    if (e.id === selectedId) {
      ctx.fillStyle = 'rgba(29, 78, 216, 0.4)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = '#60a5fa';
    ctx.fillRect(16, y, 8, 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${e.sourceName} ${e.directed ? '→' : '—'} ${e.targetName}${e.label ? ` · ${e.label}` : ''}`, 32, y + 11);
  });
}

export function exportGvzSvg(nodes: GvzNode[], edges: GvzEdge[]): string {
  const width = 640;
  const height = 360;
  if (!nodes.length) return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"></svg>`;
  const xs = nodes.map((n) => n.x);
  const ys = nodes.map((n) => n.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);
  const pad = 40;
  const mapX = (x: number) => pad + ((x - minX) / spanX) * (width - pad * 2);
  const mapY = (y: number) => pad + ((y - minY) / spanY) * (height - pad * 2);
  const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const lines = edges.map((e) => {
    const a = nodes.find((n) => n.id === e.source);
    const b = nodes.find((n) => n.id === e.target);
    if (!a || !b) return '';
    const x1 = mapX(a.x);
    const y1 = mapY(a.y);
    const x2 = mapX(b.x);
    const y2 = mapY(b.y);
    return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#64748b" stroke-width="1.5"${e.directed ? '' : ' stroke-dasharray="5 4"'}"/>${e.label ? `<text x="${((x1 + x2) / 2).toFixed(1)}" y="${((y1 + y2) / 2 - 4).toFixed(1)}" fill="#64748b" font-size="10">${esc(e.label)}</text>` : ''}`;
  });
  const boxes = nodes.map((n) => {
    const x = mapX(n.x);
    const y = mapY(n.y);
    const fill = n.shape === 'diamond' ? '#fbbf24' : n.shape === 'ellipse' || n.shape === 'circle' ? '#38bdf8' : '#60a5fa';
    const shape =
      n.shape === 'circle' || n.shape === 'ellipse'
        ? `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${n.shape === 'circle' ? 14 : 22}" ry="14" fill="${fill}"/>`
        : `<rect x="${(x - 28).toFixed(1)}" y="${(y - 12).toFixed(1)}" width="56" height="24" rx="4" fill="${fill}"/>`;
    return `${shape}<text x="${(x - 24).toFixed(1)}" y="${(y + 28).toFixed(1)}" fill="#0f172a" font-size="11">${esc(n.name.slice(0, 16))}</text>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="background:#f8fafc">${lines.join('')}${boxes.join('')}</svg>`;
}
