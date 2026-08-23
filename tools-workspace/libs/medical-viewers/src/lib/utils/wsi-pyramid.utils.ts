import type { WsiPyramidLevel, WsiTileRect, WsiViewport } from '../types/wsi-slide.types';

export const WSI_TILE_SIZE = 256;
export const WSI_MIN_LEVEL_SIDE = 64;

/** Build pyramid level descriptors (dimensions only). */
export function buildPyramidLevels(fullWidth: number, fullHeight: number): WsiPyramidLevel[] {
  const levels: WsiPyramidLevel[] = [];
  let w = Math.max(1, fullWidth);
  let h = Math.max(1, fullHeight);
  let level = 0;
  let downsample = 1;

  while (level < 12) {
    levels.push({ level, width: w, height: h, downsample });
    if (w <= WSI_MIN_LEVEL_SIDE && h <= WSI_MIN_LEVEL_SIDE) break;
    w = Math.max(1, Math.floor(w / 2));
    h = Math.max(1, Math.floor(h / 2));
    level += 1;
    downsample *= 2;
  }
  return levels;
}

/** Pick best pyramid level for current zoom (higher zoom -> lower level index). */
export function pickPyramidLevel(levels: WsiPyramidLevel[], zoom: number): WsiPyramidLevel {
  if (!levels.length) {
    return { level: 0, width: 1, height: 1, downsample: 1 };
  }
  const z = Math.max(0.05, zoom);
  for (let i = 0; i < levels.length; i++) {
    const lv = levels[i];
    if (z * lv.downsample >= 0.5 || i === levels.length - 1) {
      return lv;
    }
  }
  return levels[levels.length - 1];
}

export function imageToScreen(
  imageX: number,
  imageY: number,
  viewport: WsiViewport,
  canvasWidth: number,
  canvasHeight: number,
  imageWidth: number,
  imageHeight: number
): { x: number; y: number } {
  const drawW = imageWidth * viewport.zoom;
  const drawH = imageHeight * viewport.zoom;
  const ox = (canvasWidth - drawW) / 2 + viewport.panX;
  const oy = (canvasHeight - drawH) / 2 + viewport.panY;
  return {
    x: ox + imageX * viewport.zoom,
    y: oy + imageY * viewport.zoom
  };
}

export function screenToImage(
  screenX: number,
  screenY: number,
  viewport: WsiViewport,
  canvasWidth: number,
  canvasHeight: number,
  imageWidth: number,
  imageHeight: number
): { x: number; y: number } | null {
  const drawW = imageWidth * viewport.zoom;
  const drawH = imageHeight * viewport.zoom;
  const ox = (canvasWidth - drawW) / 2 + viewport.panX;
  const oy = (canvasHeight - drawH) / 2 + viewport.panY;
  const x = (screenX - ox) / viewport.zoom;
  const y = (screenY - oy) / viewport.zoom;
  if (x < 0 || y < 0 || x >= imageWidth || y >= imageHeight) return null;
  return { x, y };
}

export function computeVisibleImageRect(
  viewport: WsiViewport,
  canvasWidth: number,
  canvasHeight: number,
  imageWidth: number,
  imageHeight: number
): WsiTileRect {
  const topLeft = screenToImage(0, 0, viewport, canvasWidth, canvasHeight, imageWidth, imageHeight);
  const bottomRight = screenToImage(
    canvasWidth,
    canvasHeight,
    viewport,
    canvasWidth,
    canvasHeight,
    imageWidth,
    imageHeight
  );
  const x0 = Math.max(0, Math.floor(topLeft?.x ?? 0));
  const y0 = Math.max(0, Math.floor(topLeft?.y ?? 0));
  const x1 = Math.min(imageWidth, Math.ceil(bottomRight?.x ?? imageWidth));
  const y1 = Math.min(imageHeight, Math.ceil(bottomRight?.y ?? imageHeight));
  return {
    x: x0,
    y: y0,
    width: Math.max(1, x1 - x0),
    height: Math.max(1, y1 - y0)
  };
}

export function computeZoomFit(
  viewportW: number,
  viewportH: number,
  imageW: number,
  imageH: number,
  padding = 16
): number {
  if (imageW <= 0 || imageH <= 0 || viewportW <= 0 || viewportH <= 0) return 1;
  const availW = Math.max(1, viewportW - padding * 2);
  const availH = Math.max(1, viewportH - padding * 2);
  return Math.min(availW / imageW, availH / imageH);
}
