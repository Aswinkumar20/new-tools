import {
  buildImageResizeOptions,
  buildResizedFilename,
  createImageResizerHistoryEntry,
  extensionForResizerFormat,
  prependImageResizerHistory,
  resolveImageResizerSuggestion,
  syncImageResizerAspect,
  validateImageResizerFile
} from './image-resizer.utils';

describe('image-resizer.utils', () => {
  it('validates image files and size limit', () => {
    expect(validateImageResizerFile(new File(['x'], 'a.txt', { type: 'text/plain' }))).toEqual([
      'Please upload a valid image file.'
    ]);

    const huge = {
      type: 'image/png',
      size: 36 * 1024 * 1024
    } as File;
    const oversized = validateImageResizerFile(huge);
    expect(oversized?.[0]).toContain('exceeds');
  });

  it('clamps options and syncs aspect ratio', () => {
    const options = buildImageResizeOptions({
      width: null,
      height: null,
      keepAspect: true,
      interpolation: 'smooth',
      background: '  ',
      format: 'image/png',
      quality: 0.92
    });
    expect(options.width).toBe(1);
    expect(options.height).toBe(1);
    expect(options.background).toBeNull();

    expect(syncImageResizerAspect('width', 200, 100, 100, null).height).toBe(50);
    expect(syncImageResizerAspect('height', 200, 100, null, 50).width).toBe(100);
  });

  it('builds filenames and history entries', () => {
    expect(extensionForResizerFormat('image/jpeg')).toBe('jpg');
    expect(buildResizedFilename('photo.PNG', 100, 50, 'image/webp')).toBe('photo-100x50.webp');
    expect(buildResizedFilename(null, 10, 10, 'image/png')).toBe('resized-image-10x10.png');

    const entry = createImageResizerHistoryEntry(
      {
        originalName: 'a.jpg',
        originalSize: 1024,
        originalDimensions: { width: 20, height: 10 },
        resizedSize: 512,
        resizedDimensions: { width: 10, height: 5 },
        ratioChange: 0.5,
        previewUrl: '' as never,
        downloadUrl: 'blob:x',
        format: 'image/png'
      },
      () => 1
    );
    expect(prependImageResizerHistory([entry], entry)).toHaveLength(2);
  });

  it('resolves contextual suggestions', () => {
    expect(
      resolveImageResizerSuggestion({
        hasFile: false,
        hasResult: false,
        hasError: true,
        isOversizedHint: true,
        targetWidth: null,
        targetHeight: null,
        resizedWidth: null,
        resizedHeight: null
      })?.id
    ).toBe('ires-oversized');

    expect(
      resolveImageResizerSuggestion({
        hasFile: true,
        hasResult: true,
        hasError: false,
        isOversizedHint: false,
        targetWidth: 64,
        targetHeight: 64,
        resizedWidth: 64,
        resizedHeight: 64
      })?.id
    ).toBe('ires-favicon');
  });
});
