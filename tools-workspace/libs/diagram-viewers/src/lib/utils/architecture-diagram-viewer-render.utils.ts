import type { ArchBox, ArchConnector } from '../types/architecture-diagram-viewer.types';

export function archBoxColor(kind: string, index: number): string {
  if (kind === 'database') return '#38bdf8';
  if (kind === 'cloud') return '#a78bfa';
  if (kind === 'queue') return '#fbbf24';
  if (kind === 'service') return '#fb923c';
  if (kind === 'package') return '#94a3b8';
  if (kind === 'node') return '#34d399';
  const colors = ['#f97316', '#fb923c', '#fdba74', '#f59e0b'];
  return colors[index % colors.length];
}

export function renderArchDiagram(
  canvas: HTMLCanvasElement,
  boxes: ArchBox[],
  connectors: ArchConnector[],
  selectedId: string | null
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!boxes.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No boxes in this architecture diagram.', 16, 28);
    return;
  }
  const xs = boxes.map((b) => b.x);
  const ys = boxes.map((b) => b.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);
  const pad = 40;
  const mapX = (x: number) => pad + ((x - minX) / spanX) * (canvas.width - pad * 2);
  const mapY = (y: number) => pad + ((y - minY) / spanY) * (canvas.height - pad * 2);
  const pos = new Map(boxes.map((b) => [b.id, { x: mapX(b.x), y: mapY(b.y) }] as const));
  ctx.lineWidth = 1.4;
  for (const c of connectors) {
    const a = pos.get(c.source);
    const b = pos.get(c.target);
    if (!a || !b) continue;
    ctx.strokeStyle = '#64748b';
    ctx.setLineDash(c.style === 'depend' ? [4, 4] : c.style === 'sync' ? [8, 3] : []);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.setLineDash([]);
    if (c.label) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px sans-serif';
      ctx.fillText(c.label.slice(0, 18), (a.x + b.x) / 2, (a.y + b.y) / 2 - 4);
    }
  }
  boxes.forEach((box, i) => {
    const p = pos.get(box.id);
    if (!p) return;
    ctx.fillStyle = box.id === selectedId ? '#fed7aa' : archBoxColor(box.kind, i);
    if (box.kind === 'database') {
      ctx.beginPath();
      ctx.ellipse(p.x, p.y - 10, 28, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(p.x - 28, p.y - 10, 56, 24);
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + 14, 28, 8, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (box.kind === 'cloud') {
      ctx.beginPath();
      ctx.arc(p.x - 12, p.y, 12, 0, Math.PI * 2);
      ctx.arc(p.x + 10, p.y - 4, 14, 0, Math.PI * 2);
      ctx.arc(p.x + 16, p.y + 8, 10, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(p.x - 36, p.y - 18, 72, 36);
    }
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '11px sans-serif';
    ctx.fillText(box.name.slice(0, 14), p.x - 34, p.y + 32);
  });
}

export function renderArchBoxes(canvas: HTMLCanvasElement, boxes: ArchBox[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!boxes.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No matching boxes in this view.', 16, 28);
    return;
  }
  const rowH = Math.min(36, Math.max(22, (canvas.height - 24) / boxes.length));
  boxes.forEach((b, i) => {
    const y = 16 + i * rowH;
    if (b.id === selectedId) {
      ctx.fillStyle = 'rgba(154, 52, 18, 0.45)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = archBoxColor(b.kind, i);
    ctx.fillRect(16, y, 12, 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${b.name} · ${b.kind}`, 36, y + 11);
  });
}

export function renderArchConnectors(canvas: HTMLCanvasElement, connectors: ArchConnector[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!connectors.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No matching connectors in this view.', 16, 28);
    return;
  }
  const rowH = Math.min(36, Math.max(22, (canvas.height - 24) / connectors.length));
  connectors.forEach((c, i) => {
    const y = 16 + i * rowH;
    if (c.id === selectedId) {
      ctx.fillStyle = 'rgba(154, 52, 18, 0.45)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = '#fb923c';
    ctx.fillRect(16, y, 8, 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${c.sourceName} → ${c.targetName}${c.label ? ` · ${c.label}` : ''}`, 32, y + 11);
  });
}
