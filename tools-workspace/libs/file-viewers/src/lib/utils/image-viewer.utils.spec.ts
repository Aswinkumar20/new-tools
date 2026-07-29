import {
  computeFitZoomPercent,
  formatImageFileSize,
  formatImageMimeLabel,
  getMimeTypeFromExtension,
  isImageFileByExtension,
  normalizeImageMimeType,
  resolveImageSuggestion,
  resolveNextImageIndexAfterRemoval,
  stepImageZoom,
  validateImageFiles
} from './image-viewer.utils';

describe('image-viewer.utils', () => {
  it('normalizes mime types and validates files', () => {
    expect(getMimeTypeFromExtension('photo.JPG')).toBe('image/jpeg');
    expect(normalizeImageMimeType('image/jpg', 'a.jpg')).toBe('image/jpeg');
    expect(normalizeImageMimeType('', 'icon.ico')).toBe('image/x-icon');
    expect(isImageFileByExtension('logo.svg')).toBe(true);
    expect(isImageFileByExtension('notes.txt')).toBe(false);

    const { validFiles, errors } = validateImageFiles([
      new File(['x'], 'a.png', { type: 'image/png' }),
      new File(['x'], 'b.txt', { type: 'text/plain' })
    ]);
    expect(validFiles).toHaveLength(1);
    expect(errors[0]).toContain('Unsupported format');
  });

  it('formats sizes, labels, and zoom', () => {
    expect(formatImageFileSize(0)).toBe('0 Bytes');
    expect(formatImageFileSize(2048)).toContain('KB');
    expect(formatImageMimeLabel('image/png')).toBe('PNG');
    expect(formatImageMimeLabel(undefined)).toBe('—');
    expect(stepImageZoom(100, 1)).toBe(125);
    expect(stepImageZoom(25, -1)).toBe(25);
    expect(computeFitZoomPercent(200, 100, 100, 100)).toBe(50);
  });

  it('resolves index after removal', () => {
    expect(resolveNextImageIndexAfterRemoval(0, 0, 0)).toBe(-1);
    expect(resolveNextImageIndexAfterRemoval(2, 2, 2)).toBe(1);
    expect(resolveNextImageIndexAfterRemoval(0, 0, 3)).toBe(0);
    expect(resolveNextImageIndexAfterRemoval(1, 3, 3)).toBe(2);
  });

  it('resolves contextual suggestions', () => {
    expect(
      resolveImageSuggestion({
        hasImages: false,
        hasError: false,
        imageCount: 0,
        currentMimeType: '',
        currentSize: 0
      })?.id
    ).toBe('iv-compress');

    expect(
      resolveImageSuggestion({
        hasImages: true,
        hasError: true,
        imageCount: 1,
        currentMimeType: 'image/png',
        currentSize: 100
      })?.id
    ).toBe('iv-meta');

    expect(
      resolveImageSuggestion({
        hasImages: true,
        hasError: false,
        imageCount: 1,
        currentMimeType: 'image/svg+xml',
        currentSize: 100
      })?.id
    ).toBe('iv-base64');

    expect(
      resolveImageSuggestion({
        hasImages: true,
        hasError: false,
        imageCount: 3,
        currentMimeType: 'image/jpeg',
        currentSize: 100
      })?.id
    ).toBe('iv-pdf');
  });
});
