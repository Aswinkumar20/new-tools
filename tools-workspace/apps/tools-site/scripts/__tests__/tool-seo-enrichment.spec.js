/**
 * Unit tests for SEO keyword generation used by generate-tool-seo-catalog.js
 */
const {
  buildEnhancedKeywords,
  buildCategoryKeywords,
} = require('../lib/tool-seo-enrichment');

describe('tool-seo-enrichment keywords', () => {
  it('builds rich keywords for a typical PDF tool', () => {
    const keywords = buildEnhancedKeywords(
      'Merge PDFs',
      'pdf-tools',
      '/pdf-tools/merge-pdfs',
      'merge pdf files',
    );
    const parts = keywords.split(', ');
    expect(parts.length).toBeGreaterThanOrEqual(20);
    expect(parts.length).toBeLessThanOrEqual(40);
    expect(keywords).toContain('merge pdfs');
    expect(keywords).toContain('easytoolhub');
    expect(keywords).toContain('free online tool');
    expect(keywords).not.toMatch(/,,/);
  });

  it('sanitizes commas in tool names so meta keywords stay well-formed', () => {
    const keywords = buildEnhancedKeywords(
      'Email, URL & IP Checker',
      'testing-tools',
      '/testing-tools/email-url-ip-checker',
      '',
    );
    expect(keywords.split(', ').every((p) => p.trim().length > 0)).toBe(true);
    expect(keywords.toLowerCase()).toContain('email url and ip checker');
  });

  it('builds category keywords for every major category label', () => {
    const keywords = buildCategoryKeywords('PDF Tools', 'pdf-tools');
    expect(keywords).toContain('pdf tools');
    expect(keywords).toContain('easytoolhub');
    expect(keywords.split(', ').length).toBeGreaterThan(10);
  });
});
