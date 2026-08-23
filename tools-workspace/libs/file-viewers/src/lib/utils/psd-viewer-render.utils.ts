import type { PdLayer, PdViewTransform } from '../types/psd-viewer.types';

export function defaultPdView(): PdViewTransform {
  return { scale: 1, offsetX: 40, offsetY: 40 };
}

function layerBBox(layers: PdLayer[]): { minX: number; minY: number; maxX: number; maxY: number } {
  if (!layers.length) return { minX: 0, minY: 0, maxX: 12, maxY: 8 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const l of layers) {
    if (l.kind === 'circle') {
      const r = Math.max(l.r, 0.2);
      minX = Math.min(minX, l.x - r);
      minY = Math.min(minY, l.y - r);
      maxX = Math.max(maxX, l.x + r);
      maxY = Math.max(maxY, l.y + r);
    } else if (l.kind === 'line') {
      minX = Math.min(minX, l.x, l.x2);
      minY = Math.min(minY, l.y, l.y2);
      maxX = Math.max(maxX, l.x, l.x2);
      maxY = Math.max(maxY, l.y, l.y2);
    } else if (l.kind === 'text') {
      minX = Math.min(minX, l.x);
      minY = Math.min(minY, l.y - 0.4);
      maxX = Math.max(maxX, l.x + 2);
      maxY = Math.max(maxY, l.y + 0.4);
    } else {
      minX = Math.min(minX, l.x);
      minY = Math.min(minY, l.y);
      maxX = Math.max(maxX, l.x + Math.max(l.w, 0.2));
      maxY = Math.max(maxY, l.y + Math.max(l.h, 0.2));
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

export function fitPdView(layers: PdLayer[], width: number, height: number, pad = 36): PdViewTransform {
  const box = layerBBox(layers);
  const spanX = Math.max(1e-6, box.maxX - box.minX);
  const spanY = Math.max(1e-6, box.maxY - box.minY);
  const scale = Math.min((Math.max(64, width) - pad * 2) / spanX, (Math.max(64, height) - pad * 2) / spanY);
  return { scale, offsetX: pad - box.minX * scale, offsetY: pad - box.minY * scale };
}

function toScreen(x: number, y: number, view: PdViewTransform): { x: number; y: number } {
  return { x: x * view.scale + view.offsetX, y: y * view.scale + view.offsetY };
}

export function renderPdPreview(canvas: HTMLCanvasElement, layers: PdLayer[], selectedId: string | null, view: PdViewTransform): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#1e293b';
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
  if (!layers.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('No visible PSD layers in this dump.', 16, 28);
    return;
  }
  for (const l of layers) {
    const selected = l.id === selectedId;
    ctx.lineWidth = selected ? 2.8 : 1.5;
    ctx.strokeStyle = l.colorHex || '#93c5fd';
    ctx.fillStyle = l.colorHex || '#93c5fd';
    if (l.kind === 'circle') {
      const c = toScreen(l.x, l.y, view);
      const r = Math.max(3, Math.max(l.r, 0.2) * view.scale);
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
      ctx.globalAlpha = 0.4;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.stroke();
    } else if (l.kind === 'line') {
      const a = toScreen(l.x, l.y, view);
      const b = toScreen(l.x2, l.y2, view);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    } else if (l.kind === 'text') {
      const p = toScreen(l.x, l.y, view);
      ctx.font = `${Math.max(12, 14 * Math.min(view.scale, 2))}px sans-serif`;
      ctx.fillText(l.text || l.name, p.x, p.y);
    } else {
      const p = toScreen(l.x, l.y, view);
      const w = Math.max(4, (l.w || 1) * view.scale);
      const h = Math.max(4, (l.h || 1) * view.scale);
      ctx.globalAlpha = 0.32;
      ctx.fillRect(p.x, p.y, w, h);
      ctx.globalAlpha = 1;
      ctx.strokeRect(p.x, p.y, w, h);
    }
    if (selected) {
      const p = toScreen(l.x, l.y, view);
      ctx.strokeStyle = '#c4b5fd';
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
