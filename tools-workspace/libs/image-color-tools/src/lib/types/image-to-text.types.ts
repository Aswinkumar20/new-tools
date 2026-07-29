import type { FormControl, FormGroup } from '@angular/forms';
import type { SafeUrl } from '@angular/platform-browser';

export interface ImageToTextLanguageOption {
  code: string;
  name: string;
}

export interface ImageToTextPsmOption {
  value: number;
  label: string;
}

export interface ImageToTextExtractionResult {
  text: string;
  confidence: number;
  words: number;
  characters: number;
  lines: number;
  previewUrl: SafeUrl;
  filename: string | null;
  processingTime: number;
}

export interface ImageToTextHistoryEntry {
  timestamp: number;
  filename: string | null;
  text: string;
  words: number;
  preview: string;
}

export type ImageToTextFormGroup = FormGroup<{
  language: FormControl<string>;
  psm: FormControl<number>;
  oem: FormControl<number>;
  rememberHistory: FormControl<boolean>;
}>;

export interface ImageToTextStats {
  words: number;
  characters: number;
  lines: number;
}
