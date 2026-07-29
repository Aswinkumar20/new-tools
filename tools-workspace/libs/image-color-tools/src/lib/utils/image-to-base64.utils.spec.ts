import {
  arrayBufferToBase64,
  buildEncodedDownloadFilename,
  buildImageToBase64Payload,
  chunkBase64String,
  createImageToBase64HistoryEntry,
  prependImageToBase64History,
  resolveImageToBase64Suggestion,
  toBase64Url,
  validateImageToBase64File,
  wrapBase64Text
} from './image-to-base64.utils';

describe('image-to-base64.utils', () => {
  it('validates mime, extension fallback, and size', () => {
    expect(
      validateImageToBase64File(new File(['x'], 'a.txt', { type: 'text/plain' })).errors?.[0]
    ).toContain('Unsupported');

    const extensionOnly = validateImageToBase64File(
      new File(['x'], 'photo.heic', { type: '' })
    );
    expect(extensionOnly.errors).toBeNull();
    expect(extensionOnly.warnings[0]).toContain('.heic');

    const oversized = validateImageToBase64File({
      type: 'image/png',
      size: 26 * 1024 * 1024,
      name: 'big.png'
    } as File);
    expect(oversized.isOversized).toBe(true);
    expect(oversized.errors?.[0]).toContain('exceeds');
  });

  it('wraps, chunks, and converts base64url', () => {
    expect(wrapBase64Text('abcdef', 2)).toBe('ab\ncd\nef');
    expect(chunkBase64String('abcdef', 2)).toEqual(['ab', 'cd', 'ef']);
    expect(toBase64Url('ab+c/d==')).toBe('ab-c_d');
  });

  it('builds payload and history', () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'dot.png', { type: 'image/png' });
    const base64 = arrayBufferToBase64(new Uint8Array([1, 2, 3]).buffer);
    const payload = buildImageToBase64Payload(file, base64, {
      outputFormat: 'base64',
      wrapWidth: 76,
      includeMime: true,
      chunkSize: 4096
    });
    expect(payload.dataUri.startsWith('data:image/png;base64,')).toBe(true);

    expect(buildEncodedDownloadFilename('a.png', 'text')).toBe('a.png.txt');
    expect(buildEncodedDownloadFilename(null, 'base64')).toBe('image.base64.txt');

    const entry = createImageToBase64HistoryEntry(payload, () => 1);
    expect(prependImageToBase64History([entry], entry)).toHaveLength(2);
  });

  it('resolves suggestions', () => {
    expect(
      resolveImageToBase64Suggestion({
        hasFile: false,
        hasResult: false,
        hasError: true,
        isOversizedHint: true,
        encodedSize: null,
        outputFormat: null
      })?.id
    ).toBe('itb-oversized');

    expect(
      resolveImageToBase64Suggestion({
        hasFile: true,
        hasResult: true,
        hasError: false,
        isOversizedHint: false,
        encodedSize: 600_000,
        outputFormat: 'base64'
      })?.id
    ).toBe('itb-large-output');
  });
});
