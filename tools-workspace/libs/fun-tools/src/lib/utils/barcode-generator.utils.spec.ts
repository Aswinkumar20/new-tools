import {
  looksLikeQrPayload,
  looksLikeUrl,
  mapBarcodeGenerationError,
  resolveBarcodeSuggestion
} from './barcode-generator.utils';

describe('barcode-generator.utils', () => {
  describe('looksLikeUrl', () => {
    it('detects http and www URLs', () => {
      expect(looksLikeUrl('https://example.com')).toBe(true);
      expect(looksLikeUrl('www.example.com')).toBe(true);
      expect(looksLikeUrl('123456789012')).toBe(false);
    });
  });

  describe('looksLikeQrPayload', () => {
    it('flags URLs and long text', () => {
      expect(looksLikeQrPayload('https://example.com/path')).toBe(true);
      expect(looksLikeQrPayload('x'.repeat(48))).toBe(true);
      expect(looksLikeQrPayload('short')).toBe(false);
    });
  });

  describe('mapBarcodeGenerationError', () => {
    it('adds digit-length guidance for retail formats', () => {
      const message = mapBarcodeGenerationError('EAN13', '123', new Error('Invalid'));
      expect(message).toContain('13 digits');
      expect(message).toContain('Invalid');
    });

    it('flags non-digit retail payloads', () => {
      const message = mapBarcodeGenerationError('UPC', 'ABC', new Error('Invalid'));
      expect(message).toContain('digits only');
    });
  });

  describe('resolveBarcodeSuggestion', () => {
    it('suggests QR for URLs', () => {
      const suggestion = resolveBarcodeSuggestion({
        text: 'https://example.com',
        format: 'CODE128',
        hasBarcode: false,
        hasError: false,
        libraryLoaded: true
      });
      expect(suggestion?.id).toBe('bcg-qr-url');
    });

    it('suggests barcode-to-pdf when ready', () => {
      const suggestion = resolveBarcodeSuggestion({
        text: '123456789012',
        format: 'CODE128',
        hasBarcode: true,
        hasError: false,
        libraryLoaded: true
      });
      expect(suggestion?.id).toBe('bcg-pdf');
      expect(suggestion?.path).toBe('/pdf-tools/barcode-to-pdf');
    });

    it('returns null while library loads', () => {
      expect(
        resolveBarcodeSuggestion({
          text: '123',
          format: 'CODE128',
          hasBarcode: false,
          hasError: false,
          libraryLoaded: false
        })
      ).toBeNull();
    });
  });
});
