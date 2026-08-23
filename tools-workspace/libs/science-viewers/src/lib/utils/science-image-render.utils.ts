/** Window/level and canvas helpers for science grid viewers. */

export interface WindowLevelOptions {
  center: number;
  width: number;
  invert?: boolean;
  colormap?: 'grayscale' | 'hot' | 'viridis';
}

export function applyWindowLevelToByte(
  value: number,
  center: number,
  width: number,
  invert = false
): number {
  const w = Math.max(1e-6, Math.abs(width));
  const low = center - w / 2;
  let t = (value - low) / w;
  if (t < 0) t = 0;
  if (t > 1) t = 1;
  let byte = Math.round(t * 255);
  if (invert) {
    byte = 255 - byte;
  }
  return byte;
}

function viridisRgb(t: number): [number, number, number] {
  const clamped = Math.max(0, Math.min(1, t));
  const r = Math.round(255 * (0.267 + clamped * (0.993 - 0.267)));
  const g = Math.round(255 * (0.004 + clamped * (0.906 - 0.004)));
  const b = Math.round(255 * (0.329 + clamped * (0.143 - 0.329)));
  return [r, g, b];
}

export function hotColormapRgb(byte: number): [number, number, number] {
  const t = Math.max(0, Math.min(255, byte)) / 255;
  if (t < 0.33) {
    return [Math.round((t / 0.33) * 255), 0, 0];
  }
  if (t < 0.66) {
    return [255, Math.round(((t - 0.33) / 0.33) * 255), 0];
  }
  return [255, 255, Math.round(((t - 0.66) / 0.34) * 255)];
}

export function pixelsToImageData(
  pixels: ArrayLike<number>,
  width: number,
  height: number,
  options: WindowLevelOptions
): ImageData {
  const { center, width: ww, invert = false, colormap = 'grayscale' } = options;
  const data = new Uint8ClampedArray(width * height * 4);
  const count = Math.min(pixels.length, width * height);
  for (let i = 0; i < count; i++) {
    const byte = applyWindowLevelToByte(pixels[i], center, ww, invert);
    const o = i * 4;
    if (colormap === 'hot') {
      const [r, g, b] = hotColormapRgb(byte);
      data[o] = r;
      data[o + 1] = g;
      data[o + 2] = b;
    } else if (colormap === 'viridis') {
      const [r, g, b] = viridisRgb(byte / 255);
      data[o] = r;
      data[o + 1] = g;
      data[o + 2] = b;
    } else {
      data[o] = byte;
      data[o + 1] = byte;
      data[o + 2] = byte;
    }
    data[o + 3] = 255;
  }
  return new ImageData(data, width, height);
}

export function computeZoomFit(
  viewportW: number,
  viewportH: number,
  imageW: number,
  imageH: number,
  padding = 16
): number {
  if (imageW <= 0 || imageH <= 0 || viewportW <= 0 || viewportH <= 0) {
    return 1;
  }
  const availW = Math.max(1, viewportW - padding * 2);
  const availH = Math.max(1, viewportH - padding * 2);
  return Math.min(availW / imageW, availH / imageH);
}

export function drawImageDataToCanvas(
  canvas: HTMLCanvasElement,
  imageData: ImageData,
  options: {
    zoom: number;
    panX?: number;
    panY?: number;
    background?: string;
  }
): void {
  let ctx: CanvasRenderingContext2D | null = null;
  try {
    ctx = canvas.getContext('2d');
  } catch {
    return;
  }
  if (!ctx) return;

  const zoom = Math.max(0.05, options.zoom || 1);
  const panX = options.panX ?? 0;
  const panY = options.panY ?? 0;
  const bg = options.background ?? '#0f172a';

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const drawW = imageData.width * zoom;
  const drawH = imageData.height * zoom;
  const ox = (canvas.width - drawW) / 2 + panX;
  const oy = (canvas.height - drawH) / 2 + panY;

  const off = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  if (!off) return;
  off.width = imageData.width;
  off.height = imageData.height;
  const offCtx = off.getContext('2d');
  if (!offCtx) return;
  offCtx.putImageData(imageData, 0, 0);

  ctx.imageSmoothingEnabled = zoom < 1;
  ctx.drawImage(off, ox, oy, drawW, drawH);
}

export function canvasToPngDataUrl(canvas: HTMLCanvasElement): string | null {
  try {
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

export function drawLineChartToCanvas(
  canvas: HTMLCanvasElement,
  values: ArrayLike<number>,
  options: { color?: string; background?: string; padding?: number } = {}
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx || values.length < 2) return;

  const padding = options.padding ?? 24;
  const bg = options.background ?? '#0f172a';
  const color = options.color ?? '#38bdf8';

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < values.length; i++) {
    if (values[i] < min) min = values[i];
    if (values[i] > max) max = values[i];
  }
  if (!Number.isFinite(min) || min === max) {
    min = 0;
    max = 1;
  }

  const w = canvas.width - padding * 2;
  const h = canvas.height - padding * 2;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < values.length; i++) {
    const x = padding + (i / (values.length - 1)) * w;
    const y = padding + h - ((values[i] - min) / (max - min)) * h;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

export function drawHistogramToCanvas(
  canvas: HTMLCanvasElement,
  values: ArrayLike<number>,
  options: { color?: string; background?: string; padding?: number } = {}
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx || values.length < 1) return;

  const padding = options.padding ?? 24;
  const bg = options.background ?? '#0f172a';
  const color = options.color ?? '#a855f7';

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  let max = 0;
  for (let i = 0; i < values.length; i++) {
    if (values[i] > max) max = values[i];
  }
  if (max <= 0) max = 1;

  const w = canvas.width - padding * 2;
  const h = canvas.height - padding * 2;
  const barW = w / values.length;
  ctx.fillStyle = color;
  for (let i = 0; i < values.length; i++) {
    const barH = (values[i] / max) * h;
    const x = padding + i * barW + barW * 0.1;
    const y = padding + h - barH;
    ctx.fillRect(x, y, barW * 0.8, barH);
  }
}
