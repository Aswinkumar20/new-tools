import type { WsiRegion } from '../types/wsi-slide.types';

export function createRegionId(): string {
  return `reg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function exportRegionsJson(
  regions: WsiRegion[],
  slideName: string,
  imageSize: { width: number; height: number }
): string {
  return JSON.stringify(
    {
      slide: slideName,
      imageWidth: imageSize.width,
      imageHeight: imageSize.height,
      regions,
      note: 'Education/research regions — not for diagnostic use.'
    },
    null,
    2
  );
}

export const WSI_REGION_COLORS = ['#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#8b5cf6'];

export function nextRegionColor(index: number): string {
  return WSI_REGION_COLORS[index % WSI_REGION_COLORS.length];
}
