import {
  buildExtractedTextFilename,
  computeImageToTextStats,
  createImageToTextHistoryEntry,
  getImageToTextFallbackMessage,
  prependImageToTextHistory,
  resolveImageToTextLanguageName,
  resolveImageToTextSuggestion,
  validateImageToTextFile
} from './image-to-text.utils';

describe('image-to-text.utils', () => {
  it('validates image files and size', () => {
    expect(validateImageToTextFile(new File(['x'], 'a.txt', { type: 'text/plain' })).errors).toEqual([
      'Please select a valid image file.'
    ]);

    const oversized = validateImageToTextFile({
      type: 'image/png',
      size: 26 * 1024 * 1024,
      name: 'big.png'
    } as File);
    expect(oversized.isOversized).toBe(true);
    expect(oversized.errors?.[0]).toContain('exceeds');
  });

  it('computes stats and filenames', () => {
    expect(computeImageToTextStats('hello world\n\nnext')).toEqual({
      words: 3,
      characters: 17,
      lines: 2
    });
    expect(computeImageToTextStats('   ')).toEqual({ words: 0, characters: 3, lines: 0 });
    expect(buildExtractedTextFilename('shot.PNG')).toBe('shot.txt');
    expect(buildExtractedTextFilename(null)).toBe('extracted-text.txt');
    expect(resolveImageToTextLanguageName('jpn')).toBe('Japanese');
    expect(getImageToTextFallbackMessage()).toContain('tesseract.js');
  });

  it('dedupes history by text and filename', () => {
    const entry = createImageToTextHistoryEntry(
      {
        text: 'hi',
        confidence: 90,
        words: 1,
        characters: 2,
        lines: 1,
        previewUrl: 'blob:x' as never,
        filename: 'a.png',
        processingTime: 10
      },
      () => 1
    );
    expect(prependImageToTextHistory([entry], entry)).toHaveLength(1);
    expect(prependImageToTextHistory([], entry)).toHaveLength(1);
  });

  it('resolves suggestions', () => {
    expect(
      resolveImageToTextSuggestion({
        hasFile: false,
        hasResult: false,
        hasError: true,
        isOversizedHint: true,
        tesseractUnavailable: false,
        emptyText: false,
        lowConfidence: false
      })?.id
    ).toBe('itt-oversized');

    expect(
      resolveImageToTextSuggestion({
        hasFile: true,
        hasResult: true,
        hasError: false,
        isOversizedHint: false,
        tesseractUnavailable: false,
        emptyText: true,
        lowConfidence: false
      })?.id
    ).toBe('itt-empty');
  });
});
