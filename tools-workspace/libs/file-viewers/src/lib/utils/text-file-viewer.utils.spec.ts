import {
  detectTextFileType,
  findTextSearchMatchIndexes,
  formatTextContent,
  formatTextFileSize,
  highlightJSON,
  resolveTextFileSuggestion,
  stepTextZoom,
  validateTextFiles
} from './text-file-viewer.utils';
import { TextFileType } from '../types/text-file-viewer.types';

describe('text-file-viewer.utils', () => {
  it('detects text file types', () => {
    expect(detectTextFileType(new File(['x'], 'a.txt'))).toBe(TextFileType.TXT);
    expect(detectTextFileType(new File(['{}'], 'a.json', { type: 'application/json' }))).toBe(
      TextFileType.JSON
    );
    expect(detectTextFileType(new File(['x'], 'a.md'))).toBe(TextFileType.MD);
    expect(detectTextFileType(new File(['x'], 'a.log'))).toBe(TextFileType.LOG);
    expect(detectTextFileType(new File(['x'], 'a.bin', { type: 'application/octet-stream' }))).toBe(
      TextFileType.UNSUPPORTED
    );
  });

  it('validates size only (preserves accepting unknown types)', () => {
    const { validFiles, errors } = validateTextFiles([
      new File(['x'], 'mystery.bin', { type: 'application/octet-stream' }),
      new File([new ArrayBuffer(1)], 'big.txt')
    ]);
    expect(validFiles).toHaveLength(2);

    const huge = new File([new ArrayBuffer(1)], 'huge.txt');
    Object.defineProperty(huge, 'size', { value: 11 * 1024 * 1024 });
    const oversized = validateTextFiles([huge]);
    expect(oversized.errors[0]).toContain('max 10MB');
    expect(oversized.validFiles).toHaveLength(0);
    expect(errors).toHaveLength(0);
  });

  it('formats sizes and zooms', () => {
    expect(formatTextFileSize(0)).toBe('0 Bytes');
    expect(formatTextFileSize(2048)).toContain('KB');
    expect(stepTextZoom(100, 1)).toBe(125);
    expect(stepTextZoom(50, -1)).toBe(50);
    expect(stepTextZoom(200, 1)).toBe(200);
  });

  it('highlights JSON and formats with line numbers', () => {
    const html = highlightJSON('{"a":1}');
    expect(html).toContain('json-key');
    const withLines = formatTextContent('hello\nworld', TextFileType.TXT, true);
    expect(withLines).toContain('line-number');
    expect(withLines).toContain('line-content');
  });

  it('finds search matches', () => {
    expect(findTextSearchMatchIndexes('Hello hello', 'hello', false)).toEqual([0, 6]);
    expect(findTextSearchMatchIndexes('Hello hello', 'hello', true)).toEqual([6]);
  });

  it('resolves contextual suggestions', () => {
    expect(
      resolveTextFileSuggestion({
        hasFiles: false,
        hasError: false,
        fileType: null,
        lineCount: 0
      })?.id
    ).toBe('tf-markdown');

    expect(
      resolveTextFileSuggestion({
        hasFiles: true,
        hasError: false,
        fileType: TextFileType.JSON,
        lineCount: 10
      })?.id
    ).toBe('tf-json');

    expect(
      resolveTextFileSuggestion({
        hasFiles: true,
        hasError: true,
        fileType: TextFileType.TXT,
        lineCount: 1
      })?.id
    ).toBe('tf-meta');
  });
});
