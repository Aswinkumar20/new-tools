import type { FormControl, FormGroup } from '@angular/forms';

export type FaviconMode = 'text' | 'image' | 'emoji';
export type FaviconSize = 16 | 32 | 48 | 64 | 96 | 128 | 180 | 192 | 512;
export type FaviconFormat = 'png' | 'ico';

export interface FaviconResult {
  dataUrl: string;
  size: FaviconSize;
  format: FaviconFormat;
  htmlCode: string;
}

export interface FaviconHistoryEntry {
  timestamp: number;
  mode: FaviconMode;
  preview: string;
  size: FaviconSize;
}

export type FaviconFormGroup = FormGroup<{
  mode: FormControl<FaviconMode>;
  text: FormControl<string>;
  fontSize: FormControl<number>;
  fontFamily: FormControl<string>;
  backgroundColor: FormControl<string>;
  textColor: FormControl<string>;
  emoji: FormControl<string>;
  size: FormControl<FaviconSize>;
  format: FormControl<FaviconFormat>;
  rememberHistory: FormControl<boolean>;
}>;

export interface FaviconFormValues {
  mode: FaviconMode;
  text: string;
  fontSize: number;
  fontFamily: string;
  backgroundColor: string;
  textColor: string;
  emoji: string;
  size: FaviconSize;
  format: FaviconFormat;
  rememberHistory: boolean;
}

export interface FaviconDefaults {
  mode: FaviconMode;
  text: string;
  fontSize: number;
  fontFamily: string;
  backgroundColor: string;
  textColor: string;
  emoji: string;
  size: FaviconSize;
  format: FaviconFormat;
}
