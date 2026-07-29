import {
  formatFileMetadataSize,
  formatFileMetadataText,
  getAdditionalInfoItems,
  getFileExtension,
  getFileIcon,
  getFileTypeLabel,
  getMimeTypeFromExtension,
  resolveFileMetadataSuggestion
} from './file-metadata-viewer.utils';
import type { FileMetadata } from '../types/file-metadata-viewer.types';

function createTestMetadata(overrides: Partial<FileMetadata> = {}): FileMetadata {
  const file = new File(['hello world'], overrides.name ?? 'notes.txt', {
    type: overrides.type ?? 'text/plain',
    lastModified: overrides.lastModified ?? 1_700_000_000_000
  });

  return {
    file,
    name: file.name,
    size: file.size,
    type: file.type,
    lastModified: file.lastModified,
    extension: getFileExtension(file.name),
    mimeType: file.type || getMimeTypeFromExtension(getFileExtension(file.name)),
    additionalInfo: { lines: 1, characters: 11, words: 2 },
    ...overrides,
    file: overrides.file ?? file
  };
}

describe('file-metadata-viewer.utils', () => {
  it('resolves extensions, mime types, icons, and labels', () => {
    expect(getFileExtension('photo.PNG')).toBe('png');
    expect(getFileExtension('README')).toBe('');
    expect(getMimeTypeFromExtension('json')).toBe('application/json');
    expect(getMimeTypeFromExtension('unknown')).toBe('application/octet-stream');
    expect(getFileIcon('pdf')).toBe('📄');
    expect(getFileIcon('zzz')).toBe('📁');
    expect(getFileTypeLabel('image/png')).toBe('Image');
    expect(getFileTypeLabel('application/octet-stream')).toBe('Unknown');
  });

  it('formats sizes, additional info, and metadata text', () => {
    expect(formatFileMetadataSize(0)).toBe('0 B');
    expect(formatFileMetadataSize(1024)).toBe('1.0 KB');

    const items = getAdditionalInfoItems({ lines: 3, characters: 10, words: 2 });
    expect(items.find((item) => item.key === 'lines')?.label).toBe('Lines');

    const metadata = createTestMetadata({
      dimensions: { width: 100, height: 50 }
    });
    const text = formatFileMetadataText(metadata);
    expect(text).toContain('Name: notes.txt');
    expect(text).toContain('Dimensions: 100 × 50 px');
    expect(text).toContain('Words: 2');
  });

  it('resolves contextual suggestions', () => {
    expect(resolveFileMetadataSuggestion(null, 0)?.path).toBe('/security-tools/hash-generator');

    expect(
      resolveFileMetadataSuggestion(
        createTestMetadata({
          name: 'pic.png',
          type: 'image/png',
          mimeType: 'image/png',
          extension: 'png',
          dimensions: { width: 10, height: 10 }
        }),
        1
      )?.path
    ).toBe('/image-color-tools/image-to-base64');

    expect(
      resolveFileMetadataSuggestion(
        createTestMetadata({
          name: 'doc.pdf',
          type: 'application/pdf',
          mimeType: 'application/pdf',
          extension: 'pdf'
        }),
        1
      )?.path
    ).toBe('/pdf-tools/pdf-metadata-editor');

    expect(
      resolveFileMetadataSuggestion(
        createTestMetadata({
          name: 'app.css',
          type: 'text/css',
          mimeType: 'text/css',
          extension: 'css'
        }),
        1
      )?.path
    ).toBe('/code-file-tools/css-minifier');
  });
});
