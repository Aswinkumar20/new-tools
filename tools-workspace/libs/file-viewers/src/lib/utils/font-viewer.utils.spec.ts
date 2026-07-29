import {
  buildFontMetadata,
  buildFontPreviewHostStyles,
  createFontFamilyName,
  detectFontFormatLabel,
  formatFontFileSize,
  isAllowedFontFormat,
  normalizeFontFaceValue,
  resolveFontSuggestion
} from './font-viewer.utils';

describe('font-viewer.utils', () => {
  it('validates formats and sanitizes family names', () => {
    expect(isAllowedFontFormat('Brand.woff2')).toBe(true);
    expect(isAllowedFontFormat('notes.txt')).toBe(false);
    expect(createFontFamilyName('My Font!.ttf')).toBe('My-Font');
    expect(createFontFamilyName('---.otf')).toBe('Uploaded-Font');
  });

  it('formats sizes and labels', () => {
    expect(formatFontFileSize(0)).toBe('0 B');
    expect(formatFontFileSize(2048)).toContain('KB');
    expect(detectFontFormatLabel('a.woff2')).toContain('woff2');
    expect(normalizeFontFaceValue('normal', '400')).toBe('400');
    expect(normalizeFontFaceValue('700', '400')).toBe('700');
  });

  it('builds metadata and preview styles', () => {
    const file = new File(['abc'], 'Display.otf', { type: 'font/otf' });
    Object.defineProperty(file, 'lastModified', { value: Date.UTC(2024, 0, 15) });

    const meta = buildFontMetadata(file, {
      family: 'Display',
      style: 'italic',
      weight: '700',
      stretch: 'normal',
      featureSettings: 'normal'
    });

    expect(meta.fileName).toBe('Display.otf');
    expect(meta.formatLabel).toContain('OpenType');
    expect(meta.weight).toBe('700');
    expect(meta.style).toBe('italic');

    const styles = buildFontPreviewHostStyles({
      uploadedFontFamily: "'Display', sans-serif",
      fontSize: 32,
      lineHeight: 1.4,
      letterSpacing: 1,
      wordSpacing: 2,
      textColor: '#111',
      backgroundColor: '#fff',
      uppercase: true,
      selectedWeight: '600',
      selectedStyle: 'normal',
      enableSmoothPreview: true
    });

    expect(styles['font-size']).toBe('32px');
    expect(styles['text-transform']).toBe('uppercase');
  });

  it('resolves contextual suggestions', () => {
    expect(
      resolveFontSuggestion({
        fontApiSupported: false,
        hasFont: false,
        hasError: false,
        formatExtension: ''
      })?.id
    ).toBe('fn-meta-unsupported');

    expect(
      resolveFontSuggestion({
        fontApiSupported: true,
        hasFont: false,
        hasError: false,
        formatExtension: ''
      })?.id
    ).toBe('fn-color');

    expect(
      resolveFontSuggestion({
        fontApiSupported: true,
        hasFont: true,
        hasError: false,
        formatExtension: 'woff2'
      })?.id
    ).toBe('fn-rem');

    expect(
      resolveFontSuggestion({
        fontApiSupported: true,
        hasFont: true,
        hasError: true,
        formatExtension: 'ttf'
      })?.id
    ).toBe('fn-meta-error');
  });
});
