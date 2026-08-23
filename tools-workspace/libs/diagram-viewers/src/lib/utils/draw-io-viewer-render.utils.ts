import type { DioConnector, DioPage, DioShape } from '../types/draw-io-viewer.types';

export function dioShapeColor(index: number): string {
  const colors = ['#fca5a5', '#f87171', '#fb7185', '#fecaca', '#ef4444'];
  return colors[index % colors.length];
}

export function renderDioDiagram(
  canvas: HTMLCanvasElement,
  shapes: DioShape[],
  connectors: DioConnector[],
  selectedId: string | null,
  zoom = 1
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!shapes.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No shapes on this draw.io page.', 16, 28);
    return;
  }
  const scale = Math.max(0.4, Math.min(2.4, zoom));
  const xs = shapes.map((s) => s.x);
  const ys = shapes.map((s) => s.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs.map((x, i) => x + shapes[i].width));
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys.map((y, i) => y + shapes[i].height));
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);
  const pad = 36;
  const usableW = (canvas.width - pad * 2) * scale;
  const usableH = (canvas.height - pad * 2) * scale;
  const mapX = (x: number) => pad + ((x - minX) / spanX) * usableW;
  const mapY = (y: number) => pad + ((y - minY) / spanY) * usableH;
  const pos = new Map(
    shapes.map((s) => [s.id, { x: mapX(s.x + s.width / 2), y: mapY(s.y + s.height / 2), w: Math.max(36, (s.width / spanX) * usableW), h: Math.max(22, (s.height / spanY) * usableH) }] as const)
  );
  const byRaw = new Map<string, { x: number; y: number }>();
  for (const s of shapes) {
    const raw = s.id.includes(':') ? s.id.slice(s.id.indexOf(':') + 1) : s.id;
    const p = pos.get(s.id);
    if (p) byRaw.set(raw, p);
  }
  ctx.lineWidth = 1.4;
  for (const c of connectors) {
    const a = pos.get(c.source) || pos.get(`${c.pageId}:${c.source}`) || byRaw.get(c.source);
    const b = pos.get(c.target) || pos.get(`${c.pageId}:${c.target}`) || byRaw.get(c.target);
    if (!a || !b) continue;
    ctx.strokeStyle = '#64748b';
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    if (c.label) {
      ctx.fillStyle = '#fecaca';
      ctx.font = '10px sans-serif';
      ctx.fillText(c.label.slice(0, 18), (a.x + b.x) / 2 - 10, (a.y + b.y) / 2 - 4);
    }
  }
  shapes.forEach((shape, i) => {
    const p = pos.get(shape.id);
    if (!p) return;
    ctx.fillStyle = shape.id === selectedId ? '#fee2e2' : dioShapeColor(i);
    ctx.fillRect(p.x - p.w / 2, p.y - p.h / 2, p.w, p.h);
    ctx.fillStyle = '#450a0a';
    ctx.font = '11px sans-serif';
    ctx.fillText(shape.label.slice(0, 16), p.x - p.w / 2 + 6, p.y + 4);
  });
}

export function renderDioPages(canvas: HTMLCanvasElement, pages: DioPage[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!pages.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No matching pages in this view.', 16, 28);
    return;
  }
  const rowH = Math.min(36, Math.max(22, (canvas.height - 24) / pages.length));
  pages.forEach((p, i) => {
    const y = 16 + i * rowH;
    if (p.id === selectedId) {
      ctx.fillStyle = 'rgba(185, 28, 28, 0.45)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = dioShapeColor(i);
    ctx.fillRect(16, y, 12, 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${p.name} · ${p.shapeCount} shapes · ${p.connectorCount} connectors`, 36, y + 11);
  });
}

export function renderDioShapes(canvas: HTMLCanvasElement, shapes: DioShape[], selectedId: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!shapes.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No matching shapes in this view.', 16, 28);
    return;
  }
  const rowH = Math.min(36, Math.max(22, (canvas.height - 24) / shapes.length));
  shapes.forEach((s, i) => {
    const y = 16 + i * rowH;
    if (s.id === selectedId) {
      ctx.fillStyle = 'rgba(185, 28, 28, 0.45)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = dioShapeColor(i);
    ctx.fillRect(16, y, 12, 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${s.label} · ${s.pageName}`, 36, y + 11);
  });
}

export function renderDioConnectors(canvas: HTMLCanvasElement, connectors: DioConnector[], selectedId: string | null): void {
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
      ctx.fillStyle = 'rgba(185, 28, 28, 0.45)';
      ctx.fillRect(8, y - 6, canvas.width - 16, rowH - 4);
    }
    ctx.fillStyle = '#f87171';
    ctx.fillRect(16, y, 8, 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${c.sourceName} → ${c.targetName}${c.label ? ` · ${c.label}` : ''}`, 32, y + 11);
  });
}
