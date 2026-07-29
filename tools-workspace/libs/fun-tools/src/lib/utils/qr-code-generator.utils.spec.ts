import {
  looksLikeShortNumericCode,
  looksLikeUrl,
  looksLikeWifiPayload,
  mapQrGenerationError,
  resolveQrCodeSuggestion
} from './qr-code-generator.utils';

describe('qr-code-generator.utils', () => {
  describe('detectors', () => {
    it('detects urls, wifi, and short numeric codes', () => {
      expect(looksLikeUrl('https://example.com')).toBe(true);
      expect(looksLikeUrl('plain text')).toBe(false);
      expect(looksLikeWifiPayload('WIFI:T:WPA;S:Home;P:secret;;')).toBe(true);
      expect(looksLikeShortNumericCode('123456789012')).toBe(true);
      expect(looksLikeShortNumericCode('123')).toBe(false);
    });
  });

  describe('mapQrGenerationError', () => {
    it('maps errors to messages', () => {
      expect(mapQrGenerationError(new Error('boom'))).toBe('boom');
      expect(mapQrGenerationError('x')).toBe('Failed to generate QR code.');
    });
  });

  describe('resolveQrCodeSuggestion', () => {
    it('suggests barcode for short numeric payloads', () => {
      expect(
        resolveQrCodeSuggestion({
          text: '123456789012',
          errorCorrectionLevel: 'M',
          hasQrCode: false,
          hasError: false,
          libraryLoaded: true
        })?.id
      ).toBe('qrc-barcode');
    });

    it('suggests pdf when a qr is ready', () => {
      expect(
        resolveQrCodeSuggestion({
          text: 'https://example.com',
          errorCorrectionLevel: 'M',
          hasQrCode: true,
          hasError: false,
          libraryLoaded: true
        })?.id
      ).toBe('qrc-pdf');
    });

    it('returns null while library loads', () => {
      expect(
        resolveQrCodeSuggestion({
          text: 'x',
          errorCorrectionLevel: 'M',
          hasQrCode: false,
          hasError: false,
          libraryLoaded: false
        })
      ).toBeNull();
    });
  });
});
