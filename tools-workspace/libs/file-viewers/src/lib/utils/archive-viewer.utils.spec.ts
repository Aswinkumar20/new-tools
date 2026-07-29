import {
  detectPreviewType,
  filterValidArchiveFiles,
  formatArchiveFileSize,
  getArchiveFileIcon,
  getFileExtension,
  isFullySupportedArchiveExtension,
  isPasswordRequiredError,
  isSupportedArchiveFile,
  resolveArchiveSuggestion,
  sortArchiveFiles
} from './archive-viewer.utils';
import type { ArchiveFile } from '../types/archive-viewer.types';

describe('archive-viewer utils', () => {
  it('detects supported archive files and ZIP-only support', () => {
    expect(getFileExtension('pack.ZIP')).toBe('.zip');
    expect(isSupportedArchiveFile({ name: 'a.zip', type: '' })).toBe(true);
    expect(isSupportedArchiveFile({ name: 'a.txt', type: 'application/zip' })).toBe(true);
    expect(isSupportedArchiveFile({ name: 'a.txt', type: 'text/plain' })).toBe(false);
    expect(isFullySupportedArchiveExtension('.zip')).toBe(true);
    expect(isFullySupportedArchiveExtension('.rar')).toBe(false);
    expect(filterValidArchiveFiles([
      new File([''], 'a.zip'),
      new File([''], 'b.txt')
    ])).toHaveLength(1);
  });

  it('formats sizes and icons, sorts directories first', () => {
    expect(formatArchiveFileSize(0)).toBe('0 Bytes');
    expect(formatArchiveFileSize(2048)).toBe('2 KB');
    expect(getArchiveFileIcon({ isDirectory: true, name: 'x' })).toBe('📁');
    expect(getArchiveFileIcon({ isDirectory: false, name: 'a.png' })).toBe('🖼️');

    const files: ArchiveFile[] = [
      {
        name: 'b.txt',
        path: 'b.txt',
        size: 1,
        compressedSize: 1,
        isDirectory: false,
        date: new Date(),
        level: 0
      },
      {
        name: 'a',
        path: 'a/',
        size: 0,
        compressedSize: 0,
        isDirectory: true,
        date: new Date(),
        level: 0,
        children: []
      }
    ];
    expect(sortArchiveFiles(files)[0].isDirectory).toBe(true);
  });

  it('detects preview types and password errors', () => {
    expect(detectPreviewType('readme.md')).toBe('text');
    expect(detectPreviewType('shot.png')).toBe('image');
    expect(detectPreviewType('bin.dat')).toBe('binary');
    expect(isPasswordRequiredError(new Error('encrypted zip needs password'))).toBe(true);
    expect(isPasswordRequiredError(new Error('corrupt'))).toBe(false);
  });

  it('resolves contextual suggestions', () => {
    expect(
      resolveArchiveSuggestion({
        hasArchives: false,
        unsupportedFormatMessage: false,
        previewType: 'none',
        selectedFileName: '',
        hasCopiedPreview: false
      })?.id
    ).toBe('av-meta');

    expect(
      resolveArchiveSuggestion({
        hasArchives: true,
        unsupportedFormatMessage: true,
        previewType: 'none',
        selectedFileName: '',
        hasCopiedPreview: false
      })?.id
    ).toBe('av-zip-only');

    expect(
      resolveArchiveSuggestion({
        hasArchives: true,
        unsupportedFormatMessage: false,
        previewType: 'image',
        selectedFileName: 'tex.png',
        hasCopiedPreview: false
      })?.id
    ).toBe('av-image');

    expect(
      resolveArchiveSuggestion({
        hasArchives: true,
        unsupportedFormatMessage: false,
        previewType: 'text',
        selectedFileName: 'data.json',
        hasCopiedPreview: false
      })?.id
    ).toBe('av-json');
  });
});
