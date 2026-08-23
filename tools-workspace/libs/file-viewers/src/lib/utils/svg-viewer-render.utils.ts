import type { SvShape, SvViewTransform } from '../types/svg-viewer.types';

export function defaultSvView(): SvViewTransform {
  return { scale: 1, offsetX: 40, offsetY: 40 };
}

function shapeBBox(shapes: SvShape[]): { minX: number; minY: number; maxX: number; maxY: number } {
  if (!shapes.length) return { minX: 0, minY: 0, maxX: 12, maxY: 8 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const s of shapes) {
    if (s.kind === 'circle' || s.kind === 'ellipse') {
      const rx = s.kind === 'ellipse' ? Math.max(s.w / 2, s.r, 0.2) : Math.max(s.r, 0.2);
      const ry = s.kind === 'ellipse' ? Math.max(s.h / 2, s.r, 0.2) : rx;
      minX = Math.min(minX, s.x - rx);
      minY = Math.min(minY, s.y - ry);
      maxX = Math.max(maxX, s.x + rx);
      maxY = Math.max(maxY, s.y + ry);
    } else if (s.kind === 'line' || s.kind === 'polyline' || s.kind === 'polygon') {
      minX = Math.min(minX, s.x, s.x2);
      minY = Math.min(minY, s.y, s.y2);
      maxX = Math.max(maxX, s.x, s.x2);
      maxY = Math.max(maxY, s.y, s.y2);
    } else if (s.kind === 'text') {
      minX = Math.min(minX, s.x);
      minY = Math.min(minY, s.y - 0.4);
      maxX = Math.max(maxX, s.x + 2);
      maxY = Math.max(maxY, s.y + 0.4);
    } else {
      minX = Math.min(minX, s.x);
      minY = Math.min(minY, s.y);
      maxX = Math.max(maxX, s.x + Math.max(s.w, 0.2));
      maxY = Math.max(maxY, s.y + Math.max(s.h, 0.2));
    }
  }
  if (minX === maxX) {
    minX -= 0.5;
    maxX += 0.5;
  }
  if (minY === maxY) {
    minY -= 0.5;
    maxY += 0.5;
  }
  return { minX, minY, maxX, maxY };
}

export function fitSvView(shapes: SvShape[], width: number, height: number, pad = 36): SvViewTransform {
  const box = shapeBBox(shapes);
  const spanX = Math.max(1e-6, box.maxX - box.minX);
  const spanY = Math.max(1e-6, box.maxY - box.minY);
  const scale = Math.min((Math.max(64, width) - pad * 2) / spanX, (Math.max(64, height) - pad * 2) / spanY);
  return { scale, offsetX: pad - box.minX * scale, offsetY: pad - box.minY * scale };
}

function toScreen(x: number, y: number, view: SvViewTransform): { x: number; y: number } {
  return { x: x * view.scale + view.offsetX, y: y * view.scale + view.offsetY };
}

export function renderSvPreview(canvas: HTMLCanvasElement, shapes: SvShape[], selectedId: string | null, view: SvViewTransform): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  for (let x = 40; x < canvas.width; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 40; y < canvas.height; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
  if (!shapes.length) {
    ctx.fillStyle = '#64748b';
    ctx.font = '13px sans-serif';
    ctx.fillText('No drawable SVG shapes in this dump.', 16, 28);
    return;
  }
  for (const s of shapes) {
    const selected = s.id === selectedId;
    ctx.lineWidth = selected ? 2.8 : 1.5;
    ctx.strokeStyle = s.colorHex || '#0f766e';
    ctx.fillStyle = s.colorHex || '#0f766e';
    if (s.kind === 'circle' || s.kind === 'ellipse') {
      const c = toScreen(s.x, s.y, view);
      const rx = Math.max(3, (s.kind === 'ellipse' ? Math.max(s.w / 2, s.r) : s.r) * view.scale);
      const ry = Math.max(3, (s.kind === 'ellipse' ? Math.max(s.h / 2, s.r) : s.r) * view.scale);
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, rx, ry, 0, 0, Math.PI * 2);
      ctx.globalAlpha = 0.35;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.stroke();
    } else if (s.kind === 'line' || s.kind === 'polyline' || s.kind === 'polygon' || s.kind === 'path') {
      const a = toScreen(s.x, s.y, view);
      const b = toScreen(s.x2, s.y2, view);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    } else if (s.kind === 'text') {
      const p = toScreen(s.x, s.y, view);
      ctx.font = `${Math.max(12, 14 * Math.min(view.scale, 2))}px sans-serif`;
      ctx.fillText(s.text || s.name, p.x, p.y);
    } else {
      const p = toScreen(s.x, s.y, view);
      const w = Math.max(4, (s.w || 1) * view.scale);
      const h = Math.max(4, (s.h || 1) * view.scale);
      ctx.globalAlpha = 0.28;
      ctx.fillRect(p.x, p.y, w, h);
      ctx.globalAlpha = 1;
      ctx.strokeRect(p.x, p.y, w, h);
    }
    if (selected) {
      const p = toScreen(s.x, s.y, view);
      ctx.strokeStyle = '#0f766e';
      ctx.strokeRect(p.x - 6, p.y - 6, 12, 12);
    }
  }
}

export function canvasToPngDataUrl(canvas: HTMLCanvasElement): string | null {
  try {
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

export function downloadDataUrl(dataUrl: string, fileName: string): void {
  if (typeof document === 'undefined') throw new Error('Download is only available in the browser');
  if (!dataUrl) throw new Error('Nothing to download');
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = fileName.trim() || 'snapshot.png';
  a.click();
}
