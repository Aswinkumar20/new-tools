import type { FtRelatedToolLink } from '../shared/ft-tool-suggestion.model';
import type { QrCodeOptions } from '../types/qr-code-generator.types';

export const QR_CODE_CDN =
  'https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js';

export const QR_CODE_DEFAULT_OPTIONS: QrCodeOptions = {
  text: 'https://example.com',
  size: 256,
  errorCorrectionLevel: 'M',
  darkColor: '#000000',
  lightColor: '#ffffff',
  margin: 4
};

/** Suggest barcode when payload looks like a short retail/numeric code. */
export const QR_SHORT_NUMERIC_MAX_LENGTH = 14;

/** Suggest higher ECC when content is long and level is L. */
export const QR_LONG_TEXT_ECC_THRESHOLD = 120;

export const QR_CODE_RELATED_TOOLS: ReadonlyArray<FtRelatedToolLink> = [
  {
    label: 'Barcode Generator',
    path: '/fun-tools/barcode-generator',
    description: 'Create linear barcodes (EAN, UPC, CODE128) for retail labels'
  },
  {
    label: 'QR Code to PDF',
    path: '/pdf-tools/qr-code-to-pdf',
    description: 'Place QR codes on a printable PDF sheet'
  },
  {
    label: 'Image to Base64',
    path: '/image-color-tools/image-to-base64',
    description: 'Embed the PNG QR code in HTML, CSS, or JSON'
  },
  {
    label: 'Image Resizer',
    path: '/image-color-tools/image-resizer',
    description: 'Resize the downloaded PNG for print or web'
  },
  {
    label: 'Character Counter',
    path: '/text-utilities/character-counter',
    description: 'Check payload length before encoding dense QR data'
  }
];
