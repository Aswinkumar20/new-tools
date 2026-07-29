import type { FormControl, FormGroup } from '@angular/forms';
import type { SafeUrl } from '@angular/platform-browser';

export type ImageCompressorFormat = 'image/png' | 'image/jpeg' | 'image/webp';

export type ImageCompressorExportFormat = 'image/jpeg' | 'image/webp';

export interface ImageCompressionPreset {
  label: string;
  description: string;
  quality: number;
  format: ImageCompressorExportFormat;
}

export interface ImageCompressionOptions {
  quality: number;
  format: ImageCompressorFormat;
  resizeWidth: number | null;
  resizeHeight: number | null;
  keepAspect: boolean;
  stripMetadata: boolean;
}

export interface ImageCompressionResult {
  originalName: string | null;
  originalSize: number;
  originalDimensions: { width: number; height: number };
  compressedSize: number;
  compressedDimensions: { width: number; height: number };
  reduction: number;
  previewUrl: SafeUrl;
  downloadUrl: string;
  format: ImageCompressorFormat;
}

export interface ImageCompressorHistoryEntry {
  timestamp: number;
  name: string | null;
  format: string;
  sizes: string;
  dimensions: string;
}

export type ImageCompressorFormGroup = FormGroup<{
  quality: FormControl<number>;
  format: FormControl<ImageCompressorFormat>;
  resizeWidth: FormControl<number | null>;
  resizeHeight: FormControl<number | null>;
  keepAspect: FormControl<boolean>;
  stripMetadata: FormControl<boolean>;
  rememberHistory: FormControl<boolean>;
}>;
