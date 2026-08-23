export type PathologyExportFormat = 'original' | 'annotations-json' | 'summary-json' | 'png';

export interface PathologyRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface PathologyStainPreset {
  id: string;
  label: string;
  brightness: number;
  contrast: number;
}

export interface PathologyLoadedSlide {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  fullWidth: number;
  fullHeight: number;
  warnings: string[];
  softFail: boolean;
}

export interface PathologySuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  path: string;
}

export type { PathologyAnnotation, PathologyAnnotationType } from './wsi-slide.types';
