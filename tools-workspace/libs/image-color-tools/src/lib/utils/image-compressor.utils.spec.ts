import { ictFormatBytes } from '../shared/ict-format.util';
import {
  buildCompressedFilename,
  buildImageCompressorOptions,
  createImageCompressorHistoryEntry,
  extensionForCompressorFormat,
  prependImageCompressorHistory,
  resolveImageCompressorSuggestion,
  syncImageCompressorAspect,
  validateImageCompressorFile
} from './image-compressor.utils';

describe('image-compressor.utils', () => {
  it('validates image files and size limit', () => {
    expect(validateImageCompressorFile(new File(['x'], 'a.txt', { type: 'text/plain' }))).toEqual([
      'Please upload a valid image file.'
    ]);

    const huge = new File([new Uint8Array(46 * 1024 * 1024)], 'big.png', { type: 'image/png' });
    const oversized = validateImageCompressorFile(huge);
    expect(oversized?.[0]).toContain('exceeds');
  });

  it('builds options and syncs aspect ratio', () => {
    const image = { naturalWidth: 200, naturalHeight: 100 } as HTMLImageElement;
    expect(
      buildImageCompressorOptions(image, {
        quality: 0.8,
        format: 'image/jpeg',
        resizeWidth: 100,
        resizeHeight: 50,
        keepAspect: true,
        stripMetadata: true
      }).options?.resizeWidth
    ).toBe(100);

    expect(
      buildImageCompressorOptions(image, {
        quality: 0,
        format: 'image/jpeg',
        resizeWidth: 100,
        resizeHeight: 50,
        keepAspect: true,
        stripMetadata: true
      }).error
    ).toContain('Quality');

    expect(syncImageCompressorAspect('width', 200, 100, 100, null).height).toBe(50);
    expect(syncImageCompressorAspect('height', 200, 100, null, 50).width).toBe(100);
  });

  it('builds filenames and history entries', () => {
    expect(extensionForCompressorFormat('image/jpeg')).toBe('jpg');
    expect(buildCompressedFilename('photo.PNG', 'image/webp')).toBe('photo.webp');
    expect(buildCompressedFilename(null, 'image/png')).toBe('compressed-image.png');

    const entry = createImageCompressorHistoryEntry(
      {
        originalName: 'a.jpg',
        originalSize: 1024,
        originalDimensions: { width: 10, height: 10 },
        compressedSize: 512,
        compressedDimensions: { width: 10, height: 10 },
        reduction: 0.5,
        previewUrl: '' as never,
        downloadUrl: 'blob:x',
        format: 'image/jpeg'
      },
      () => 1
    );
    expect(prependImageCompressorHistory([entry], entry)).toHaveLength(2);
    expect(ictFormatBytes(0)).toBe('0 B');
    expect(ictFormatBytes(1024)).toBe('1.0 KB');
  });

  it('resolves contextual suggestions', () => {
    expect(
      resolveImageCompressorSuggestion({
        hasFile: false,
        hasResult: false,
        hasError: true,
        reduction: null,
        format: null,
        isOversizedHint: true
      })?.id
    ).toBe('icomp-oversized');

    expect(
      resolveImageCompressorSuggestion({
        hasFile: true,
        hasResult: true,
        hasError: false,
        reduction: 0.98,
        format: 'image/jpeg',
        isOversizedHint: false
      })?.id
    ).toBe('icomp-little-gain');
  });
});
