import type { EpcFlow, EpcNode, EpcStat } from '../types/epc-diagram-viewer.types';

const KIND_COLORS: Record<string, string> = {
  event: '#f59e0b',
  function: '#0ea5e9',
  xor: '#a78bfa',
  and: '#22c55e',
  or: '#fb7185',
  organization: '#38bdf8',
  information: '#94a3b8',
  process: '#14b8a6'
};

export function epcKindColor(kind: string): string {
  return KIND_COLORS[kind] ?? '#94a3b8';
}

export function renderEpcKinds(canvas: HTMLCanvasElement, kinds: EpcStat[], selected: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!kinds.length) return;
  const pad = 24;
  const max = Math.max(...kinds.map((k) => k.count), 1);
  const rowH = Math.min(44, Math.max(28, (canvas.height - pad * 2) / kinds.length));
  kinds.forEach((k, i) => {
    const y = pad + i * rowH;
    if (k.name === selected) {
      ctx.fillStyle = 'rgba(3, 105, 161, 0.35)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 6);
    }
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '13px sans-serif';
    ctx.fillText(`${k.name} (${k.count})`, pad, y + 14);
    const w = ((canvas.width - pad * 2 - 160) * k.count) / max;
    ctx.fillStyle = epcKindColor(k.name);
    ctx.fillRect(pad + 150, y, Math.max(4, w), 12);
  });
}

export function renderEpcDiagram(
  canvas: HTMLCanvasElement,
  nodes: EpcNode[],
  flows: EpcFlow[],
  selectedId: string | null
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!nodes.length) return;
  const laid = layoutNodes(nodes, canvas.width, canvas.height);
  const byId = new Map(laid.map((n) => [n.id, n]));
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.55)';
  ctx.lineWidth = 1.5;
  for (const f of flows) {
    const a = byId.get(f.source);
    const b = byId.get(f.target);
    if (!a || !b) continue;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  for (const n of laid) {
    const r = n.kind === 'event' ? 14 : n.kind === 'function' ? 16 : 11;
    if (n.id === selectedId) {
      ctx.fillStyle = 'rgba(3, 105, 161, 0.35)';
      ctx.beginPath();
      ctx.arc(n.x, n.y, r + 8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = epcKindColor(n.kind);
    if (n.kind === 'function') {
      ctx.fillRect(n.x - r, n.y - 10, r * 2, 20);
    } else {
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '11px sans-serif';
    ctx.fillText(n.name.slice(0, 22), n.x - r, n.y + r + 14);
  }
}

function layoutNodes(nodes: EpcNode[], width: number, height: number): Array<EpcNode & { x: number; y: number }> {
  const withPos = nodes.filter((n) => n.x || n.y);
  if (withPos.length >= Math.max(2, Math.floor(nodes.length * 0.5))) {
    const xs = withPos.map((n) => n.x);
    const ys = withPos.map((n) => n.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs, minX + 1);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys, minY + 1);
    const pad = 28;
    return nodes.map((n) => ({
      ...n,
      x: pad + ((n.x || minX) - minX) / (maxX - minX) * (width - pad * 2),
      y: pad + ((n.y || minY) - minY) / (maxY - minY) * (height - pad * 2)
    }));
  }
  const cols = Math.max(1, Math.ceil(Math.sqrt(nodes.length)));
  const cellW = width / (cols + 0.5);
  const cellH = height / (Math.ceil(nodes.length / cols) + 0.5);
  return nodes.map((n, i) => ({
    ...n,
    x: cellW * (0.7 + (i % cols)),
    y: cellH * (0.7 + Math.floor(i / cols))
  }));
}
