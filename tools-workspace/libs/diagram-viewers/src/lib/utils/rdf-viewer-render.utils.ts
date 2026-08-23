import type { RdfNode, RdfTriple } from '../types/rdf-viewer.types';

export function rdfNodeColor(kind: string, index: number): string {
  if (kind === 'blank') return '#fcd34d';
  const colors = ['#7dd3fc', '#38bdf8', '#0ea5e9', '#67e8f9', '#22d3ee'];
  return colors[index % colors.length];
}

export function renderRdfDiagram(canvas: HTMLCanvasElement, nodes: RdfNode[], triples: RdfTriple[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!nodes.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No RDF nodes in this graph.', 16, 28);
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
  for (const t of triples) {
    if (t.literal) continue;
    const a = pos.get(t.subject);
    const b = pos.get(t.object);
    if (!a || !b) continue;
    ctx.strokeStyle = '#64748b';
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.fillStyle = '#bae6fd';
    ctx.font = '10px sans-serif';
    ctx.fillText(t.predicateName.slice(0, 18), (a.x + b.x) / 2 - 16, (a.y + b.y) / 2 - 4);
  }
  nodes.forEach((node, i) => {
    const p = pos.get(node.id);
    if (!p) return;
    ctx.fillStyle = node.id === selectedId ? '#e0f2fe' : rdfNodeColor(node.kind, i);
    ctx.fillRect(p.x - 58, p.y - 18, 116, 36);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(node.name.slice(0, 16), p.x - 52, p.y - 2);
    ctx.font = '10px sans-serif';
    ctx.fillText((node.prefix || node.kind).slice(0, 18), p.x - 52, p.y + 12);
  });
}

export function renderRdfTriples(canvas: HTMLCanvasElement, triples: RdfTriple[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!triples.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No matching triples in this view.', 16, 28);
    return;
  }
  const rowH = Math.min(36, Math.max(22, (canvas.height - 24) / triples.length));
  triples.forEach((t, i) => {
    const y = 16 + i * rowH;
    if (t.id === selectedId) {
      ctx.fillStyle = 'rgba(14, 116, 144, 0.45)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = '#7dd3fc';
    ctx.fillRect(16, y, 8, 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${t.subjectName} ${t.predicateName} ${t.objectName}`, 32, y + 11);
  });
}

export function renderRdfNodes(canvas: HTMLCanvasElement, nodes: RdfNode[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!nodes.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No matching graph nodes in this view.', 16, 28);
    return;
  }
  const rowH = Math.min(36, Math.max(22, (canvas.height - 24) / nodes.length));
  nodes.forEach((n, i) => {
    const y = 16 + i * rowH;
    if (n.id === selectedId) {
      ctx.fillStyle = 'rgba(14, 116, 144, 0.45)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = rdfNodeColor(n.kind, i);
    ctx.fillRect(16, y, 12, 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${n.name} · ${n.kind}${n.prefix ? ` · ${n.prefix}` : ''}`, 36, y + 11);
  });
}
