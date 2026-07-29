import { MARKDOWN_TO_PDF_SAMPLE } from '../constants/markdown-to-pdf.constants';
import {
  looksLikeHtmlOnlyDocument,
  looksLikeMarkdownSource,
  markdownToHtml,
  resolveMarkdownToPdfSuggestion
} from './markdown-to-pdf.utils';

describe('markdown-to-pdf.utils', () => {
  it('converts sample Markdown to HTML', () => {
    const html = markdownToHtml(MARKDOWN_TO_PDF_SAMPLE);
    expect(html).toContain('<h1>');
    expect(html).toContain('<h2>');
    expect(html).toContain('<strong>');
    expect(html).toContain('<pre><code>');
    expect(html).toContain('<blockquote>');
    expect(html).toContain('<table>');
  });

  it('converts basic inline and list Markdown', () => {
    const html = markdownToHtml('# Title\n\n- item one\n- item two\n\n`code`');
    expect(html).toContain('<h1>Title</h1>');
    expect(html).toContain('<ul>');
    expect(html).toContain('<li>item one</li>');
    expect(html).toContain('<code>code</code>');
  });

  it('detects Markdown vs HTML-only input', () => {
    expect(looksLikeMarkdownSource(MARKDOWN_TO_PDF_SAMPLE)).toBe(true);
    expect(looksLikeHtmlOnlyDocument('<div><p>Hello</p></div>')).toBe(true);
    expect(looksLikeHtmlOnlyDocument('# Heading\n\nParagraph')).toBe(false);
  });

  it('resolves contextual suggestions', () => {
    expect(resolveMarkdownToPdfSuggestion('', false)?.path).toBe(
      '/file-viewers/markdown-previewer'
    );
    expect(resolveMarkdownToPdfSuggestion('<html><body>Hi</body></html>', false)?.path).toBe(
      '/pdf-tools/html-to-pdf'
    );
    expect(resolveMarkdownToPdfSuggestion(MARKDOWN_TO_PDF_SAMPLE, true)?.path).toBe(
      '/data-converters/markdown-to-html'
    );
  });
});
