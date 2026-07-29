import type { FtToolSuggestion } from '../shared/ft-tool-suggestion.model';
import {
  BARCODE_DIGIT_LENGTH_HINTS,
  BARCODE_JSBARCODE_CDN,
  BARCODE_QR_TEXT_LENGTH_THRESHOLD
} from '../constants/barcode-generator.constants';
import type { BarcodeFormat, BarcodeOptions, JsBarcodeApi } from '../types/barcode-generator.types';

function getJsBarcode(): JsBarcodeApi | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }
  return window.JsBarcode;
}

/** Load JsBarcode from CDN once; resolves when the global is available. */
export async function loadJsBarcodeLibrary(): Promise<void> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('Barcode generation requires a browser environment.');
  }

  if (getJsBarcode()) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = BARCODE_JSBARCODE_CDN;
    script.async = true;
    script.onload = () => {
      if (getJsBarcode()) {
        resolve();
        return;
      }
      reject(new Error('Failed to load barcode library.'));
    };
    script.onerror = () => reject(new Error('Failed to load barcode library.'));
    document.head.appendChild(script);
  });
}

export function looksLikeUrl(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) {
    return false;
  }
  return /^(https?:\/\/|www\.)/i.test(trimmed) || /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed);
}

export function looksLikeQrPayload(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) {
    return false;
  }
  return looksLikeUrl(trimmed) || trimmed.length >= BARCODE_QR_TEXT_LENGTH_THRESHOLD;
}

export function mapBarcodeGenerationError(
  format: BarcodeFormat,
  text: string,
  error: unknown
): string {
  const raw = error instanceof Error ? error.message : 'Failed to generate barcode.';
  const trimmed = text.trim();
  const expectedDigits = BARCODE_DIGIT_LENGTH_HINTS[format];

  if (expectedDigits !== undefined) {
    const digitsOnly = /^\d+$/.test(trimmed);
    if (!digitsOnly) {
      return `${format} expects digits only (${expectedDigits} characters). ${raw}`;
    }
    if (trimmed.length !== expectedDigits) {
      return `${format} expects ${expectedDigits} digits (you entered ${trimmed.length}). ${raw}`;
    }
  }

  if (looksLikeQrPayload(trimmed) && (format === 'EAN13' || format === 'EAN8' || format === 'UPC' || format === 'ITF14')) {
    return `${raw} URLs and long text work better as a QR code.`;
  }

  return raw;
}

/** Render barcode to a PNG data URL using the loaded JsBarcode global. */
export function renderBarcodeToDataUrl(options: BarcodeOptions): string {
  const jsBarcode = getJsBarcode();
  if (!jsBarcode) {
    throw new Error('Barcode library is not loaded.');
  }

  const canvas = document.createElement('canvas');
  jsBarcode(canvas, options.text.trim(), {
    format: options.format,
    width: options.width,
    height: options.height,
    displayValue: options.displayValue,
    fontSize: options.fontSize,
    textAlign: options.textAlign,
    textPosition: options.textPosition,
    textMargin: options.textMargin,
    background: options.background,
    lineColor: options.lineColor,
    margin: options.margin
  });

  return canvas.toDataURL('image/png');
}

export function downloadBarcodeDataUrl(dataUrl: string, filename?: string): void {
  const link = document.createElement('a');
  link.download = filename ?? `barcode-${Date.now()}.png`;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export async function copyBarcodeImageToClipboard(dataUrl: string): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.write) {
    throw new Error('Clipboard image copy is not supported in this browser.');
  }

  const response = await fetch(dataUrl);
  const blob = await response.blob();
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
}

export function resolveBarcodeSuggestion(options: {
  text: string;
  format: BarcodeFormat;
  hasBarcode: boolean;
  hasError: boolean;
  libraryLoaded: boolean;
}): FtToolSuggestion | null {
  const { text, format, hasBarcode, hasError, libraryLoaded } = options;
  const trimmed = text.trim();

  if (!libraryLoaded) {
    return null;
  }

  if (looksLikeUrl(trimmed)) {
    return {
      id: 'bcg-qr-url',
      title: 'URL detected — try a QR code?',
      reason:
        'Linear barcodes are poor at encoding web links. QR Code Generator handles URLs cleanly.',
      actionLabel: 'Open QR Code Generator',
      path: '/fun-tools/qr-code-generator'
    };
  }

  if (trimmed.length >= BARCODE_QR_TEXT_LENGTH_THRESHOLD && (format === 'CODE128' || format === 'CODE39')) {
    return {
      id: 'bcg-qr-long',
      title: 'Long payload — QR may scan better',
      reason:
        'Very long text makes wide barcodes hard to scan. A QR code packs the same data in a square.',
      actionLabel: 'Open QR Code Generator',
      path: '/fun-tools/qr-code-generator'
    };
  }

  if (hasError) {
    const expectedDigits = BARCODE_DIGIT_LENGTH_HINTS[format];
    if (expectedDigits !== undefined) {
      return {
        id: 'bcg-format-hint',
        title: `Check ${format} data length`,
        reason: `${format} typically needs ${expectedDigits} digits. Switch to CODE128 here for free-form text, or use a QR code for flexible payloads.`,
        actionLabel: 'Open QR Code Generator',
        path: '/fun-tools/qr-code-generator'
      };
    }

    return {
      id: 'bcg-qr-fallback',
      title: 'Need a more flexible code?',
      reason:
        'This format rejected the data. QR codes accept almost any text, including mixed characters.',
      actionLabel: 'Open QR Code Generator',
      path: '/fun-tools/qr-code-generator'
    };
  }

  if (hasBarcode) {
    return {
      id: 'bcg-pdf',
      title: 'Print this barcode on a PDF?',
      reason:
        'Barcode to PDF lays out one or more barcodes for labels, packing slips, or sheets.',
      actionLabel: 'Open Barcode to PDF',
      path: '/pdf-tools/barcode-to-pdf'
    };
  }

  return {
    id: 'bcg-qr-discover',
    title: 'Also making QR codes?',
    reason:
      'Pair this tool with QR Code Generator when you need both retail barcodes and scannable links.',
    actionLabel: 'Open QR Code Generator',
    path: '/fun-tools/qr-code-generator'
  };
}
