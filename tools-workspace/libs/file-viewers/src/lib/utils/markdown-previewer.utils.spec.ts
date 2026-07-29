import {
  createMarkdownFileRecord,
  formatMarkdownFileSize,
  isMarkdownFile,
  parseAndSanitizeMarkdown,
  resolveMarkdownSuggestion,
  stepMarkdownZoom,
  validateMarkdownFiles
} from './markdown-previewer.utils';
import type { DomPurifyLibrary, MarkedLibrary } from '../types/markdown-previewer.types';

describe('markdown-previewer.utils', () => {
  it('validates markdown files', () => {
    expect(isMarkdownFile({ name: 'readme.md', type: '' })).toBe(true);
    expect(isMarkdownFile({ name: 'notes.txt', type: 'text/plain' })).toBe(false);
    expect(isMarkdownFile({ name: 'x.txt', type: 'text/markdown' })).toBe(true);

    const { validFiles, errors } = validateMarkdownFiles([
      new File(['# Hi'], 'a.md', { type: 'text/markdown' }),
      new File(['x'], 'b.txt', { type: 'text/plain' }),
      new File([], 'empty.md', { type: 'text/markdown' })
    ]);
    expect(validFiles).toHaveLength(1);
    expect(errors.some((e) => e.includes('Unsupported'))).toBe(true);
    expect(errors.some((e) => e.includes('empty'))).toBe(true);
  });

  it('formats sizes and zooms', () => {
    expect(formatMarkdownFileSize(0)).toBe('0 Bytes');
    expect(formatMarkdownFileSize(2048)).toContain('KB');
    expect(stepMarkdownZoom(100, 1)).toBe(125);
    expect(stepMarkdownZoom(50, -1)).toBe(50);
  });

  it('parses and sanitizes markdown', () => {
    const markedLib: MarkedLibrary = {
      parse: (md) => `<p>${md}</p><script>alert(1)</script>`,
      setOptions: () => undefined
    };
    const purify: DomPurifyLibrary = {
      sanitize: (html) => html.replace(/<script>.*?<\/script>/g, '')
    };
    const html = parseAndSanitizeMarkdown('# Title', markedLib, purify);
    expect(html).toContain('<p># Title</p>');
    expect(html).not.toContain('script');

    const record = createMarkdownFileRecord(
      new File(['a\nb'], 'doc.md'),
      'blob:x',
      'a\nb',
      '<p>a</p>'
    );
    expect(record.lines).toBe(2);
    expect(record.name).toBe('doc.md');
  });

  it('resolves contextual suggestions', () => {
    expect(
      resolveMarkdownSuggestion({
        hasFiles: false,
        hasError: false,
        currentFileName: '',
        lineCount: 0
      })?.id
    ).toBe('mp-html');

    expect(
      resolveMarkdownSuggestion({
        hasFiles: true,
        hasError: true,
        currentFileName: 'a.md',
        lineCount: 10
      })?.id
    ).toBe('mp-meta');

    expect(
      resolveMarkdownSuggestion({
        hasFiles: true,
        hasError: false,
        currentFileName: 'guide.md',
        lineCount: 250
      })?.id
    ).toBe('mp-pdf');
  });
});
