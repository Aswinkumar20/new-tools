import {
  buildFaviconFilename,
  buildFaviconHtmlCode,
  computeContainFit,
  createFaviconHistoryEntry,
  prependUniqueFaviconHistory,
  resolveFaviconSuggestion
} from './favicon-generator.utils';

describe('favicon-generator.utils', () => {
  it('builds HTML, filenames, and fit geometry', () => {
    expect(buildFaviconHtmlCode('data:image/png;base64,abc', 32)).toBe(
      '<link rel="icon" type="image/png" sizes="32x32" href="data:image/png;base64,abc">'
    );
    expect(buildFaviconHtmlCode('data:x', 64)).toContain('sizes="64x64"');
    expect(buildFaviconFilename(32, 'png')).toBe('favicon-32x32.png');
    expect(buildFaviconFilename(32, 'ico')).toBe('favicon-32x32.ico');
    expect(computeContainFit(200, 100, 100)).toEqual({
      width: 100,
      height: 50,
      x: 0,
      y: 25
    });
  });

  it('dedupes history entries', () => {
    const entry = createFaviconHistoryEntry(
      { dataUrl: 'data:x', size: 32, format: 'png', htmlCode: 'h' },
      'text',
      () => 1
    );
    expect(prependUniqueFaviconHistory([entry], entry)).toHaveLength(1);
    expect(
      prependUniqueFaviconHistory([entry], { ...entry, timestamp: 2, size: 64 })
    ).toHaveLength(2);
  });

  it('resolves contextual suggestions', () => {
    expect(
      resolveFaviconSuggestion({
        mode: 'image',
        hasResult: false,
        hasUploadedImage: false,
        hasError: false,
        historyCount: 0
      })?.id
    ).toBe('fg-upload');

    expect(
      resolveFaviconSuggestion({
        mode: 'text',
        hasResult: true,
        hasUploadedImage: false,
        hasError: false,
        historyCount: 0
      })?.id
    ).toBe('fg-compress');
  });
});
