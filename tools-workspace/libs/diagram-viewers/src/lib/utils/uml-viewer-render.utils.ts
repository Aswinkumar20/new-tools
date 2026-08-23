import type { UmlLink, UmlNode } from '../types/uml-viewer.types';

export function umlNodeColor(kind: string, index: number): string {
  if (kind === 'interface') return '#38bdf8';
  if (kind === 'enum') return '#fbbf24';
  if (kind === 'actor') return '#34d399';
  if (kind === 'participant') return '#a78bfa';
  if (kind === 'class') return '#fb7185';
  const colors = ['#fb7185', '#f9a8d4', '#fda4af', '#94a3b8'];
  return colors[index % colors.length];
}

export function renderUmlClassDiagram(
  canvas: HTMLCanvasElement,
  nodes: UmlNode[],
  links: UmlLink[],
  selectedId: string | null
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const classifiers = nodes.filter((n) => n.kind !== 'actor' && n.kind !== 'participant');
  const rels = links.filter((l) => l.linkKind === 'relation');
  if (!classifiers.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No class classifiers in this diagram.', 16, 28);
    return;
  }
  const xs = classifiers.map((e) => e.x);
  const ys = classifiers.map((e) => e.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);
  const pad = 36;
  const mapX = (x: number) => pad + ((x - minX) / spanX) * (canvas.width - pad * 2);
  const mapY = (y: number) => pad + ((y - minY) / spanY) * (canvas.height - pad * 2);
  const pos = new Map(classifiers.map((e) => [e.id, { x: mapX(e.x), y: mapY(e.y) }] as const));
  ctx.lineWidth = 1.4;
  for (const r of rels) {
    const a = pos.get(r.source);
    const b = pos.get(r.target);
    if (!a || !b) continue;
    ctx.strokeStyle = '#64748b';
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
  classifiers.forEach((e, i) => {
    const p = pos.get(e.id);
    if (!p) return;
    ctx.fillStyle = e.id === selectedId ? '#fecdd3' : umlNodeColor(e.kind, i);
    if (e.kind === 'interface') {
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

export function renderUmlSequence(
  canvas: HTMLCanvasElement,
  nodes: UmlNode[],
  links: UmlLink[],
  selectedId: string | null
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const lifelines = nodes.filter((n) => n.kind === 'actor' || n.kind === 'participant');
  const messages = links.filter((l) => l.linkKind === 'message');
  if (!lifelines.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No sequence lifelines in this diagram.', 16, 28);
    return;
  }
  const colW = Math.max(80, (canvas.width - 48) / lifelines.length);
  const xs = new Map<string, number>();
  lifelines.forEach((n, i) => {
    const x = 36 + i * colW + colW / 2;
    xs.set(n.id, x);
    ctx.fillStyle = n.id === selectedId ? '#fecdd3' : umlNodeColor(n.kind, i);
    if (n.kind === 'actor') {
      ctx.beginPath();
      ctx.arc(x, 22, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(x - 10, 32, 20, 12);
    } else {
      ctx.fillRect(x - 28, 14, 56, 28);
    }
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '11px sans-serif';
    ctx.fillText(n.name.slice(0, 12), x - 26, 58);
    ctx.strokeStyle = '#64748b';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(x, 66);
    ctx.lineTo(x, canvas.height - 12);
    ctx.stroke();
    ctx.setLineDash([]);
  });
  messages.forEach((m, i) => {
    const a = xs.get(m.source);
    const b = xs.get(m.target);
    if (a == null || b == null) return;
    const y = 78 + i * 32;
    ctx.strokeStyle = m.id === selectedId ? '#fb7185' : '#94a3b8';
    ctx.setLineDash(m.style === 'return' ? [4, 4] : []);
    ctx.beginPath();
    ctx.moveTo(a, y);
    ctx.lineTo(b, y);
    ctx.stroke();
    ctx.setLineDash([]);
    const dir = b >= a ? 1 : -1;
    ctx.beginPath();
    ctx.moveTo(b, y);
    ctx.lineTo(b - 8 * dir, y - 4);
    ctx.lineTo(b - 8 * dir, y + 4);
    ctx.closePath();
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fill();
    if (m.label) {
      ctx.fillStyle = '#cbd5e1';
      ctx.font = '10px sans-serif';
      ctx.fillText(m.label.slice(0, 22), Math.min(a, b) + 8, y - 4);
    }
  });
}

export function renderUmlNodes(canvas: HTMLCanvasElement, nodes: UmlNode[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!nodes.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No matching classifiers or lifelines in this view.', 16, 28);
    return;
  }
  const rowH = Math.min(36, Math.max(22, (canvas.height - 24) / nodes.length));
  nodes.forEach((n, i) => {
    const y = 16 + i * rowH;
    if (n.id === selectedId) {
      ctx.fillStyle = 'rgba(190, 24, 93, 0.4)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = umlNodeColor(n.kind, i);
    ctx.fillRect(16, y, 12, 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${n.name} · ${n.kind}`, 36, y + 11);
  });
}

export function renderUmlLinks(canvas: HTMLCanvasElement, links: UmlLink[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!links.length) return;
  const rowH = Math.min(36, Math.max(22, (canvas.height - 24) / links.length));
  links.forEach((l, i) => {
    const y = 16 + i * rowH;
    if (l.id === selectedId) {
      ctx.fillStyle = 'rgba(190, 24, 93, 0.4)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = '#fb7185';
    ctx.fillRect(16, y, 8, 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${l.sourceName} → ${l.targetName}${l.label ? ` · ${l.label}` : ''}`, 32, y + 11);
  });
}
