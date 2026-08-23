import type { PnmlArc, PnmlPlace, PnmlTokenMarking, PnmlTransition } from '../types/pnml-viewer.types';

export function pnmlPlaceColor(tokens: number): string {
  if (tokens <= 0) return '#64748b';
  if (tokens === 1) return '#38bdf8';
  if (tokens <= 3) return '#f59e0b';
  return '#f43f5e';
}

export function pnmlTransitionColor(enabled: boolean): string {
  return enabled ? '#22c55e' : '#a78bfa';
}

export function renderPnmlMarkings(
  canvas: HTMLCanvasElement,
  tokens: PnmlTokenMarking[],
  selectedPlaceId: string | null
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!tokens.length) return;
  const pad = 24;
  const max = Math.max(...tokens.map((t) => t.tokens), 1);
  const rowH = Math.min(44, Math.max(28, (canvas.height - pad * 2) / tokens.length));
  tokens.forEach((t, i) => {
    const y = pad + i * rowH;
    if (t.placeId === selectedPlaceId) {
      ctx.fillStyle = 'rgba(107, 33, 168, 0.35)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 6);
    }
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '13px sans-serif';
    ctx.fillText(`${t.placeName} (${t.tokens})`, pad, y + 14);
    const w = ((canvas.width - pad * 2 - 180) * t.tokens) / max;
    ctx.fillStyle = pnmlPlaceColor(t.tokens);
    ctx.fillRect(pad + 170, y, Math.max(t.tokens ? 4 : 0, w), 12);
  });
}

export function renderPnmlTransitions(
  canvas: HTMLCanvasElement,
  transitions: PnmlTransition[],
  selectedId: string | null
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!transitions.length) return;
  const pad = 24;
  const rowH = Math.min(44, Math.max(28, (canvas.height - pad * 2) / transitions.length));
  transitions.forEach((t, i) => {
    const y = pad + i * rowH;
    if (t.id === selectedId) {
      ctx.fillStyle = 'rgba(107, 33, 168, 0.35)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 6);
    }
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '13px sans-serif';
    ctx.fillText(`${t.name} · ${t.enabled ? 'enabled' : 'disabled'}`, pad, y + 14);
    ctx.fillStyle = pnmlTransitionColor(t.enabled);
    ctx.fillRect(canvas.width - pad - 80, y, 72, 12);
  });
}

export function renderPnmlNet(
  canvas: HTMLCanvasElement,
  places: PnmlPlace[],
  transitions: PnmlTransition[],
  arcs: PnmlArc[],
  selectedId: string | null
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const nodes = [
    ...places.map((p) => ({ id: p.id, name: p.name, kind: 'place' as const, x: p.x, y: p.y, tokens: p.tokens, enabled: false })),
    ...transitions.map((t) => ({ id: t.id, name: t.name, kind: 'transition' as const, x: t.x, y: t.y, tokens: 0, enabled: t.enabled }))
  ];
  if (!nodes.length) return;
  const laid = layoutNodes(nodes, canvas.width, canvas.height);
  const byId = new Map(laid.map((n) => [n.id, n]));
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.55)';
  ctx.lineWidth = 1.5;
  for (const a of arcs) {
    const s = byId.get(a.source);
    const t = byId.get(a.target);
    if (!s || !t) continue;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(t.x, t.y);
    ctx.stroke();
  }
  for (const n of laid) {
    if (n.id === selectedId) {
      ctx.fillStyle = 'rgba(107, 33, 168, 0.35)';
      ctx.beginPath();
      ctx.arc(n.x, n.y, 22, 0, Math.PI * 2);
      ctx.fill();
    }
    if (n.kind === 'place') {
      ctx.fillStyle = pnmlPlaceColor(n.tokens);
      ctx.beginPath();
      ctx.arc(n.x, n.y, 14, 0, Math.PI * 2);
      ctx.fill();
      if (n.tokens > 0) {
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText(String(n.tokens), n.x - 4, n.y + 4);
      }
    } else {
      ctx.fillStyle = pnmlTransitionColor(n.enabled);
      ctx.fillRect(n.x - 10, n.y - 14, 20, 28);
    }
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '11px sans-serif';
    ctx.fillText(n.name.slice(0, 22), n.x - 14, n.y + 28);
  }
}

function layoutNodes<T extends { id: string; x: number; y: number }>(
  nodes: T[],
  width: number,
  height: number
): T[] {
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
