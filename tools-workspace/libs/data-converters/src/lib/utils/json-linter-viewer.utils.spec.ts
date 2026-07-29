import {
  prepareJsonLinterResult,
  resolveJsonLinterSuggestion,
  sanitizeJsonLinterInput,
  sortJsonLinterValue,
  tryParseJsonLinterInput
} from './json-linter-viewer.utils';

describe('json-linter-viewer.utils', () => {
  it('strips comments and trailing commas when allowed', () => {
    const source = `{
      // note
      "a": 1,
      /* block */
      "b": 2,
    }`;
    const sanitized = sanitizeJsonLinterInput(source, {
      allowComments: true,
      allowTrailingCommas: true
    });
    expect(sanitized.warnings.length).toBeGreaterThan(0);
    expect(sanitized.transformations.length).toBeGreaterThan(0);
    expect(() => JSON.parse(sanitized.text)).not.toThrow();
  });

  it('keeps comments when strip is disabled', () => {
    const source = '{ "a": 1 // trailing\n}';
    const sanitized = sanitizeJsonLinterInput(source, {
      allowComments: false,
      allowTrailingCommas: false
    });
    expect(sanitized.warnings).toContain('Single-line comments detected.');
    expect(sanitized.transformations).toHaveLength(0);
    expect(() => JSON.parse(sanitized.text)).toThrow();
  });

  it('parses sanitized input and sorts keys', () => {
    const parsed = tryParseJsonLinterInput('{"b":2,"a":1}', {
      allowComments: false,
      allowTrailingCommas: false
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(sortJsonLinterValue(parsed.value)).toEqual({ a: 1, b: 2 });
      expect(
        prepareJsonLinterResult(parsed.value, {
          sortKeys: true,
          previewMode: 'formatted',
          indentSize: 2
        })
      ).toContain('"a"');
    }
  });

  it('suggests YAML converter for YAML-looking input', () => {
    const suggestion = resolveJsonLinterSuggestion({
      source: 'name: Ada\nage: 36',
      hasOutput: false,
      lintStatus: 'error',
      allowComments: false,
      allowTrailingCommas: false
    });
    expect(suggestion?.id).toBe('jlv-yaml');
  });

  it('suggests sanitize options when comments break lint', () => {
    const suggestion = resolveJsonLinterSuggestion({
      source: '{ "a": 1 // x\n}',
      hasOutput: false,
      lintStatus: 'error',
      allowComments: false,
      allowTrailingCommas: false
    });
    expect(suggestion?.id).toBe('jlv-sanitize');
  });

  it('suggests formatter after successful lint', () => {
    const suggestion = resolveJsonLinterSuggestion({
      source: '{"a":1}',
      hasOutput: true,
      lintStatus: 'success',
      allowComments: false,
      allowTrailingCommas: false
    });
    expect(suggestion?.id).toBe('jlv-format-explore');
  });
});
