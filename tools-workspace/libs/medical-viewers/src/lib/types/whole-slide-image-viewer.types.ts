export type WholeSlideExportFormat = 'original' | 'regions-json' | 'summary-json' | 'png';

export interface WsiRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface WholeSlideLoadedImage {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  fullWidth: number;
  fullHeight: number;
  pyramidLevelCount: number;
  warnings: string[];
  softFail: boolean;
}

export interface WholeSlideSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  path: string;
}

export type { WsiPyramidLevel, WsiRegion } from './wsi-slide.types';
