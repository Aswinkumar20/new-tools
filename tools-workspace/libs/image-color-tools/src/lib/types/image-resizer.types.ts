import type { FormControl, FormGroup } from '@angular/forms';
import type { SafeUrl } from '@angular/platform-browser';

export type ImageResizerFormat = 'image/png' | 'image/jpeg' | 'image/webp';

export type ImageResizerInterpolation = 'pixelated' | 'smooth';

export interface ImageResizePreset {
  label: string;
  description: string;
  width: number;
  height: number;
  lockAspect: boolean;
}

export interface ImageResizeOptions {
  width: number;
  height: number;
  keepAspect: boolean;
  interpolation: ImageResizerInterpolation;
  background: string | null;
  format: ImageResizerFormat;
  quality: number;
}

export interface ImageResizeResult {
  originalName: string | null;
  originalSize: number;
  originalDimensions: { width: number; height: number };
  resizedSize: number;
  resizedDimensions: { width: number; height: number };
  ratioChange: number;
  previewUrl: SafeUrl;
  downloadUrl: string;
  format: ImageResizerFormat;
}

export interface ImageResizerHistoryEntry {
  timestamp: number;
  name: string | null;
  originalDimensions: string;
  resizedDimensions: string;
  format: string;
  sizeDiff: string;
}

export type ImageResizerFormGroup = FormGroup<{
  width: FormControl<number | null>;
  height: FormControl<number | null>;
  keepAspect: FormControl<boolean>;
  interpolation: FormControl<ImageResizerInterpolation>;
  background: FormControl<string | null>;
  format: FormControl<ImageResizerFormat>;
  quality: FormControl<number>;
  rememberHistory: FormControl<boolean>;
}>;
