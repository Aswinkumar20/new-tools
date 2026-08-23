import type { WsiSlideSource } from '../types/wsi-slide.types';
import { buildPyramidLevels } from './wsi-pyramid.utils';

const IMAGE_MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp'
};

export function mimeForSlideExtension(ext: string): string {
  return IMAGE_MIME[ext.toLowerCase()] ?? 'application/octet-stream';
}

export function extensionPreferenceWarning(ext: string): string | null {
  const lower = ext.toLowerCase();
  if (lower === '.svs' || lower === '.tif' || lower === '.tiff') {
    return `${lower} pyramid files are not fully decoded here — try PNG/JPEG export or load a rendered slide image. File may still open if the browser decodes it.`;
  }
  return null;
}

export function loadImageFromBytes(bytes: Uint8Array, mime: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (typeof Image === 'undefined' || typeof URL === 'undefined' || typeof Blob === 'undefined') {
      reject(new Error('Image loading unavailable in this environment'));
      return;
    }
    const blob = new Blob([bytes as BlobPart], { type: mime });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to decode slide image'));
    };
    img.src = url;
  });
}

export async function buildSlideSourceFromImage(
  img: HTMLImageElement,
  warnings: string[] = []
): Promise<WsiSlideSource & { image: HTMLImageElement }> {
  const fullWidth = img.naturalWidth || img.width;
  const fullHeight = img.naturalHeight || img.height;
  if (fullWidth <= 0 || fullHeight <= 0) {
    throw new Error('Image has no pixel dimensions');
  }
  const levels = buildPyramidLevels(fullWidth, fullHeight);
  if (levels.length === 1) {
    warnings.push('Single-resolution image — pyramid levels are synthesized for smooth deep zoom.');
  }
  return {
    fullWidth,
    fullHeight,
    levels,
    warnings,
    image: img
  };
}

/** Render slide image to canvas with pan/zoom (browser only). */
export function drawSlideToCanvas(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  options: {
    zoom: number;
    panX?: number;
    panY?: number;
    brightness?: number;
    contrast?: number;
    filter?: string;
  }
): void {
  let ctx: CanvasRenderingContext2D | null = null;
  try {
    ctx = canvas.getContext('2d');
  } catch {
    return;
  }
  if (!ctx) return;

  const zoom = Math.max(0.02, options.zoom || 1);
  const panX = options.panX ?? 0;
  const panY = options.panY ?? 0;
  const w = image.naturalWidth || image.width;
  const h = image.naturalHeight || image.height;

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const drawW = w * zoom;
  const drawH = h * zoom;
  const ox = (canvas.width - drawW) / 2 + panX;
  const oy = (canvas.height - drawH) / 2 + panY;

  ctx.save();
  const brightness = options.brightness ?? 1;
  const contrast = options.contrast ?? 1;
  ctx.filter = options.filter ?? `brightness(${brightness}) contrast(${contrast})`;
  ctx.imageSmoothingEnabled = zoom < 1;
  ctx.drawImage(image, ox, oy, drawW, drawH);
  ctx.restore();
}
