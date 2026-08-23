import type { RwPreview, RwViewTransform } from '../types/raw-image-viewer.types';

export function defaultRwView(): RwViewTransform {
  return { scale: 1, offsetX: 40, offsetY: 40 };
}

function previewBBox(items: RwPreview[]): { minX: number; minY: number; maxX: number; maxY: number } {
  if (!items.length) return { minX: 0, minY: 0, maxX: 12, maxY: 8 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of items) {
    if (p.kind === 'circle') {
      const r = Math.max(p.r, 0.2);
      minX = Math.min(minX, p.x - r);
      minY = Math.min(minY, p.y - r);
      maxX = Math.max(maxX, p.x + r);
      maxY = Math.max(maxY, p.y + r);
    } else if (p.kind === 'line') {
      minX = Math.min(minX, p.x, p.x2);
      minY = Math.min(minY, p.y, p.y2);
      maxX = Math.max(maxX, p.x, p.x2);
      maxY = Math.max(maxY, p.y, p.y2);
    } else if (p.kind === 'text') {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y - 0.4);
      maxX = Math.max(maxX, p.x + 2);
      maxY = Math.max(maxY, p.y + 0.4);
    } else {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x + Math.max(p.w, 0.2));
      maxY = Math.max(maxY, p.y + Math.max(p.h, 0.2));
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

export function fitRwView(items: RwPreview[], width: number, height: number, pad = 36): RwViewTransform {
  const box = previewBBox(items);
  const spanX = Math.max(1e-6, box.maxX - box.minX);
  const spanY = Math.max(1e-6, box.maxY - box.minY);
  const scale = Math.min((Math.max(64, width) - pad * 2) / spanX, (Math.max(64, height) - pad * 2) / spanY);
  return { scale, offsetX: pad - box.minX * scale, offsetY: pad - box.minY * scale };
}

function toScreen(x: number, y: number, view: RwViewTransform): { x: number; y: number } {
  return { x: x * view.scale + view.offsetX, y: y * view.scale + view.offsetY };
}

export function renderRwPreview(canvas: HTMLCanvasElement, items: RwPreview[], selectedId: string | null, view: RwViewTransform): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#431407';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#7c2d12';
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
  if (!items.length) {
    ctx.fillStyle = '#fdba74';
    ctx.font = '13px sans-serif';
    ctx.fillText('No demosaiced RAW preview in this dump.', 16, 28);
    return;
  }
  for (const p of items) {
    const selected = p.id === selectedId;
    ctx.lineWidth = selected ? 2.8 : 1.5;
    ctx.strokeStyle = p.colorHex || '#fdba74';
    ctx.fillStyle = p.colorHex || '#fdba74';
    if (p.kind === 'circle') {
      const c = toScreen(p.x, p.y, view);
      const r = Math.max(3, Math.max(p.r, 0.2) * view.scale);
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
      ctx.globalAlpha = 0.4;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.stroke();
    } else if (p.kind === 'line') {
      const a = toScreen(p.x, p.y, view);
      const b = toScreen(p.x2, p.y2, view);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    } else if (p.kind === 'text') {
      const s = toScreen(p.x, p.y, view);
      ctx.font = `${Math.max(12, 14 * Math.min(view.scale, 2))}px sans-serif`;
      ctx.fillText(p.text || p.name, s.x, s.y);
    } else {
      const s = toScreen(p.x, p.y, view);
      const w = Math.max(4, (p.w || 1) * view.scale);
      const h = Math.max(4, (p.h || 1) * view.scale);
      ctx.globalAlpha = 0.32;
      ctx.fillRect(s.x, s.y, w, h);
      ctx.globalAlpha = 1;
      ctx.strokeRect(s.x, s.y, w, h);
    }
    if (selected) {
      const s = toScreen(p.x, p.y, view);
      ctx.strokeStyle = '#fdba74';
      ctx.strokeRect(s.x - 6, s.y - 6, 12, 12);
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
