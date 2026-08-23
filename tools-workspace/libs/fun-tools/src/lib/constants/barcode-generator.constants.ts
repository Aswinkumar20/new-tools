import type { FtRelatedToolLink } from '../shared/ft-tool-suggestion.model';
import type { BarcodeFormatOption, BarcodeOptions } from '../types/barcode-generator.types';

export const BARCODE_DEFAULT_OPTIONS: BarcodeOptions = {
  text: '123456789012',
  format: 'CODE128',
  width: 2,
  height: 100,
  displayValue: true,
  fontSize: 20,
  textAlign: 'center',
  textPosition: 'bottom',
  textMargin: 2,
  background: '#ffffff',
  lineColor: '#000000',
  margin: 10
};

export const BARCODE_FORMATS: ReadonlyArray<BarcodeFormatOption> = [
  { value: 'CODE128', label: 'CODE128', description: 'Most common, supports alphanumeric' },
  { value: 'CODE39', label: 'CODE39', description: 'Alphanumeric, widely used' },
  { value: 'EAN13', label: 'EAN13', description: '13 digits, used for products' },
  { value: 'EAN8', label: 'EAN8', description: '8 digits, compact version' },
  { value: 'UPC', label: 'UPC', description: '12 digits, North American standard' },
  { value: 'ITF14', label: 'ITF14', description: '14 digits, shipping containers' },
  { value: 'MSI', label: 'MSI', description: 'Numeric only, retail' },
  { value: 'pharmacode', label: 'Pharmacode', description: 'Pharmaceutical packaging' },
  { value: 'codabar', label: 'Codabar', description: 'Numeric with special chars' }
];

/** Digit length expected by retail formats (excluding check-digit nuances handled by JsBarcode). */
export const BARCODE_DIGIT_LENGTH_HINTS: Readonly<Partial<Record<string, number>>> = {
  EAN13: 13,
  EAN8: 8,
  UPC: 12,
  ITF14: 14
};

export const BARCODE_QR_TEXT_LENGTH_THRESHOLD = 48;

export const BARCODE_RELATED_TOOLS: ReadonlyArray<FtRelatedToolLink> = [
  {
    label: 'QR Code Generator',
    path: '/fun-tools/qr-code-generator',
    description: 'Encode URLs and longer text as a scannable QR code'
  },
  {
    label: 'Barcode to PDF',
    path: '/pdf-tools/barcode-to-pdf',
    description: 'Place barcodes on a printable PDF sheet'
  },
  {
    label: 'Image to Base64',
    path: '/image-color-tools/image-to-base64',
    description: 'Embed the PNG barcode in HTML, CSS, or JSON'
  },
  {
    label: 'Image Resizer',
    path: '/image-color-tools/image-resizer',
    description: 'Resize the downloaded PNG for labels or print'
  }
];
