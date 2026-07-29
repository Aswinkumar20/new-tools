import {
  convertHtmlToMarkdown,
  convertMarkdownToHtml,
  looksLikeHtmlDocument,
  looksLikeMarkdownDocument,
  resolveMarkdownToHtmlSuggestion
} from './markdown-to-html.utils';

describe('markdown-to-html.utils', () => {
  const markdownOptions = {
    wrapParagraphs: true,
    convertLineBreaks: false,
    escapeHtml: true,
    smartTypography: false
  };

  const htmlOptions = {
    bulletStyle: '-' as const,
    headingStyle: 'atx' as const,
    collapseWhitespace: true,
    keepLinks: true,
    codeFence: '```'
  };

  it('converts markdown headings and emphasis to HTML', () => {
    const html = convertMarkdownToHtml('# Title\n\nHello **world**', markdownOptions);
    expect(html).toContain('<h1>Title</h1>');
    expect(html).toContain('<strong>world</strong>');
  });

  it('converts HTML headings and lists to Markdown', () => {
    const markdown = convertHtmlToMarkdown(
      '<h1>Title</h1><ul><li>One</li><li>Two</li></ul>',
      htmlOptions
    );
    expect(markdown).toContain('# Title');
    expect(markdown).toContain('- One');
    expect(markdown).toContain('- Two');
  });

  it('detects HTML vs Markdown documents', () => {
    expect(looksLikeHtmlDocument('<article><p>Hi</p></article>')).toBe(true);
    expect(looksLikeMarkdownDocument('# Hello\n\n- item')).toBe(true);
    expect(looksLikeMarkdownDocument('<p>Hi</p>')).toBe(false);
  });

  it('suggests mode switch for mismatched input', () => {
    expect(
      resolveMarkdownToHtmlSuggestion({
        mode: 'markdown-to-html',
        markdownInput: '<article><p>Hi</p></article>',
        htmlInput: '',
        hasOutput: false,
        status: 'idle'
      })?.id
    ).toBe('mth-switch-html');
  });

  it('suggests Markdown to PDF after successful MD→HTML conversion', () => {
    expect(
      resolveMarkdownToHtmlSuggestion({
        mode: 'markdown-to-html',
        markdownInput: '# Hello',
        htmlInput: '',
        hasOutput: true,
        status: 'success'
      })?.path
    ).toBe('/code-file-tools/markdown-to-pdf');
  });
});
