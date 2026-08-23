import type { FtToolSuggestion } from '../shared/ft-tool-suggestion.model';
import {
  QR_LONG_TEXT_ECC_THRESHOLD,
  QR_SHORT_NUMERIC_MAX_LENGTH
} from '../constants/qr-code-generator.constants';
import type { QrCodeOptions, QrErrorCorrectionLevel } from '../types/qr-code-generator.types';
import QRCode from 'qrcode';

/** Import qrcode from the installed npm package. */
export async function loadQrCodeLibrary(): Promise<void> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('QR code generation requires a browser environment.');
  }
  await import('qrcode');
}

export function looksLikeUrl(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) {
    return false;
  }
  return /^(https?:\/\/|www\.)/i.test(trimmed) || /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed);
}

export function looksLikeShortNumericCode(text: string): boolean {
  const trimmed = text.trim();
  return /^\d{8,14}$/.test(trimmed) && trimmed.length <= QR_SHORT_NUMERIC_MAX_LENGTH;
}

export function looksLikeWifiPayload(text: string): boolean {
  return /^WIFI:/i.test(text.trim());
}

/** Render QR code to a PNG data URL using the npm qrcode package. */
export function renderQrCodeToDataUrl(options: QrCodeOptions): Promise<string> {
  return QRCode.toDataURL(options.text, {
    width: options.size,
    margin: options.margin,
    color: {
      dark: options.darkColor,
      light: options.lightColor
    },
    errorCorrectionLevel: options.errorCorrectionLevel
  });
}

export function downloadQrCodeDataUrl(dataUrl: string, filename?: string): void {
  const link = document.createElement('a');
  link.download = filename ?? `qrcode-${Date.now()}.png`;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export async function copyQrCodeImageToClipboard(dataUrl: string): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.write) {
    throw new Error('Clipboard image copy is not supported in this browser.');
  }

  const response = await fetch(dataUrl);
  const blob = await response.blob();
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
}

export function mapQrGenerationError(error: unknown): string {
  return error instanceof Error ? error.message || 'Failed to generate QR code.' : 'Failed to generate QR code.';
}

export function resolveQrCodeSuggestion(options: {
  text: string;
  errorCorrectionLevel: QrErrorCorrectionLevel;
  hasQrCode: boolean;
  hasError: boolean;
  libraryLoaded: boolean;
}): FtToolSuggestion | null {
  const { text, errorCorrectionLevel, hasQrCode, hasError, libraryLoaded } = options;
  const trimmed = text.trim();

  if (!libraryLoaded) {
    return null;
  }

  if (hasError) {
    return {
      id: 'qrc-error',
      title: 'QR encoding failed',
      reason:
        'The library rejected this payload. Shorten the text, raise error correction, or try Barcode Generator for simple numeric codes.',
      actionLabel: 'Open Barcode Generator',
      path: '/fun-tools/barcode-generator'
    };
  }

  if (looksLikeShortNumericCode(trimmed) && !looksLikeUrl(trimmed)) {
    return {
      id: 'qrc-barcode',
      title: 'Looks like a product code?',
      reason:
        'Short numeric strings often belong on linear barcodes (EAN/UPC). QR still works, but Barcode Generator may fit retail labels better.',
      actionLabel: 'Open Barcode Generator',
      path: '/fun-tools/barcode-generator'
    };
  }

  if (looksLikeWifiPayload(trimmed) && errorCorrectionLevel === 'L') {
    return {
      id: 'qrc-wifi-ecc',
      title: 'Raise error correction for Wi‑Fi QR?',
      reason:
        'WIFI: payloads are dense. Switch Error correction to M or higher in Options before printing or sharing.',
      actionLabel: 'Open QR Code to PDF',
      path: '/pdf-tools/qr-code-to-pdf'
    };
  }

  if (trimmed.length >= QR_LONG_TEXT_ECC_THRESHOLD && errorCorrectionLevel === 'L') {
    return {
      id: 'qrc-long-ecc',
      title: 'Long payload with Low ECC',
      reason:
        'Large text with Low correction is fragile when printed small. Switch to M, Q, or H in Options.',
      actionLabel: 'Open Character Counter',
      path: '/text-utilities/character-counter'
    };
  }

  if (hasQrCode) {
    return {
      id: 'qrc-pdf',
      title: 'Print this QR on a PDF?',
      reason:
        'QR Code to PDF lays out one or more codes for posters, handouts, or packing slips.',
      actionLabel: 'Open QR Code to PDF',
      path: '/pdf-tools/qr-code-to-pdf'
    };
  }

  return {
    id: 'qrc-barcode-discover',
    title: 'Also need linear barcodes?',
    reason:
      'Pair this tool with Barcode Generator when a project needs both QR links and retail barcodes.',
    actionLabel: 'Open Barcode Generator',
    path: '/fun-tools/barcode-generator'
  };
}
