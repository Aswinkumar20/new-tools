import { PDF_ADVANCED_TOOLS, getPdfAdvancedTool } from './pdf-advanced-tools.registry';

describe('PDF_ADVANCED_TOOLS registry integrity', () => {
  it('contains unique tool ids', () => {
    const ids = PDF_ADVANCED_TOOLS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('defines required fields for every tool', () => {
    for (const tool of PDF_ADVANCED_TOOLS) {
      expect(tool.id).toMatch(/^[a-z0-9-]+$/);
      expect(tool.title.length).toBeGreaterThan(2);
      expect(tool.description.length).toBeGreaterThan(8);
      expect(tool.category.length).toBeGreaterThan(1);
      expect(['pdf', 'office', 'multi-pdf', 'text', 'url', 'markdown', 'images', 'none']).toContain(
        tool.input,
      );
      expect([
        'pdf',
        'text',
        'json',
        'zip',
        'epub',
        'csv',
        'html',
        'markdown',
        'docx',
        'xfdf',
      ]).toContain(tool.output);
      expect(tool.endpoint.startsWith('/') || tool.clientOnly).toBe(true);
    }
  });

  it('resolves every registry id via getPdfAdvancedTool', () => {
    for (const tool of PDF_ADVANCED_TOOLS) {
      const found = getPdfAdvancedTool(tool.id);
      expect(found).toBeDefined();
      expect(found?.endpoint).toBe(tool.endpoint);
    }
  });

  it('keeps form validate and redact wired for Slice 14', () => {
    const validate = getPdfAdvancedTool('pdf-form-validate');
    expect(validate?.endpoint).toBe('/validate-form');
    expect(validate?.output).toBe('json');

    const redact = getPdfAdvancedTool('pdf-redact');
    expect(redact?.endpoint).toBe('/redact');
    expect(redact?.output).toBe('pdf');
  });
});
