/** Window/level and canvas helpers for medical slice viewers. */

export interface WindowLevelOptions {
  center: number;
  width: number;
  invert?: boolean;
  colormap?: 'grayscale' | 'hot';
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

/** Map float pixels to ImageData (RGBA) using window/level. */
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

export function rotatePixels90Clockwise(
  pixels: ArrayLike<number>,
  width: number,
  height: number
): { pixels: Float32Array; width: number; height: number } {
  const out = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const src = y * width + x;
      const nx = height - 1 - y;
      const ny = x;
      out[ny * height + nx] = pixels[src];
    }
  }
  return { pixels: out, width: height, height: width };
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

export { downloadBinaryFile, downloadTextFile, downloadDataUrl } from './medical-file.utils';
