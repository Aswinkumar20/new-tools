import type { FormControl, FormGroup } from '@angular/forms';
import type { SafeUrl } from '@angular/platform-browser';

export type ImageToBase64OutputFormat = 'base64' | 'base64url' | 'text';

export interface ImageToBase64ConversionOptions {
  outputFormat: ImageToBase64OutputFormat;
  wrapWidth: number | null;
  includeMime: boolean;
  chunkSize: number;
}

export interface ImageToBase64ConversionResult {
  dataUri: string;
  textPreview: string;
  size: number;
  encodedSize: number;
  compressionRatio: number;
  previewUrl: SafeUrl;
  filename: string | null;
  mime: string;
  outputFormat: ImageToBase64OutputFormat;
  chunks: string[];
}

export interface ImageToBase64HistoryEntry {
  timestamp: number;
  filename: string | null;
  size: number;
  mime: string;
  format: ImageToBase64OutputFormat;
  encodedLength: number;
}

export type ImageToBase64FormGroup = FormGroup<{
  outputFormat: FormControl<ImageToBase64OutputFormat>;
  wrapWidth: FormControl<number | null>;
  includeMime: FormControl<boolean>;
  chunkSize: FormControl<number>;
  rememberHistory: FormControl<boolean>;
}>;

/** Intermediate encode payload before sanitizing the preview URL. */
export interface ImageToBase64BuiltPayload {
  dataUri: string;
  textPreview: string;
  size: number;
  encodedSize: number;
  compressionRatio: number;
  filename: string | null;
  mime: string;
  outputFormat: ImageToBase64OutputFormat;
  chunks: string[];
}
