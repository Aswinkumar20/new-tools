import type { PathologyAnnotation } from '../types/wsi-slide.types';

export function createAnnotationId(): string {
  return `ann-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function exportAnnotationsJson(
  annotations: PathologyAnnotation[],
  slideName: string,
  imageSize: { width: number; height: number }
): string {
  return JSON.stringify(
    {
      slide: slideName,
      imageWidth: imageSize.width,
      imageHeight: imageSize.height,
      annotations,
      note: 'Education/research annotations — not for diagnostic use.'
    },
    null,
    2
  );
}

export function clampAnnotationRect(
  x: number,
  y: number,
  w: number,
  h: number,
  maxW: number,
  maxH: number
): { x: number; y: number; width: number; height: number } {
  const width = Math.max(1, Math.min(w, maxW));
  const height = Math.max(1, Math.min(h, maxH));
  const cx = Math.max(0, Math.min(x, maxW - width));
  const cy = Math.max(0, Math.min(y, maxH - height));
  return { x: cx, y: cy, width, height };
}
