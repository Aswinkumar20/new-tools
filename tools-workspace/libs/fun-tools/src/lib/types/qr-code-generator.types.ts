import { FormControl, FormGroup } from '@angular/forms';

export type QrErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H';

export interface QrCodeOptions {
  text: string;
  size: number;
  errorCorrectionLevel: QrErrorCorrectionLevel;
  darkColor: string;
  lightColor: string;
  margin: number;
}

export type QrCodeFormGroup = FormGroup<{
  text: FormControl<string>;
  size: FormControl<number>;
  errorCorrectionLevel: FormControl<QrErrorCorrectionLevel>;
  darkColor: FormControl<string>;
  lightColor: FormControl<string>;
  margin: FormControl<number>;
}>;

export interface QrCodeApi {
  toCanvas(
    canvas: HTMLCanvasElement,
    text: string,
    options: {
      width: number;
      margin: number;
      color: { dark: string; light: string };
      errorCorrectionLevel: QrErrorCorrectionLevel;
    },
    callback: (error: Error | null) => void
  ): void;
}

declare global {
  interface Window {
    QRCode?: QrCodeApi;
  }
}
