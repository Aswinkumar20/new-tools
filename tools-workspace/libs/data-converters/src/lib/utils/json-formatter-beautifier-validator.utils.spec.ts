import {
  buildJsonParseError,
  generateJsonTreeNodes,
  resolveJsonFormatterSuggestion,
  resolveJsonStringifyIndent,
  safeParseJson,
  tryAutoFixJsonSource
} from './json-formatter-beautifier-validator.utils';

describe('json-formatter-beautifier-validator.utils', () => {
  it('parses valid JSON and reports parse errors with line/column', () => {
    expect(safeParseJson('{"a":1}').success).toBe(true);

    const failed = safeParseJson('{"a":}');
    expect(failed.success).toBe(false);
    if (!failed.success) {
      expect(failed.error.status).toBe('error');
      expect(failed.error.message.length).toBeGreaterThan(0);
    }
  });

  it('builds excerpt with caret for positional errors', () => {
    const source = '{\n  "a":\n}';
    try {
      JSON.parse(source);
    } catch (error) {
      const result = buildJsonParseError(error, source);
      expect(result.status).toBe('error');
      if (result.excerpt) {
        expect(result.excerpt).toContain('^');
      }
    }
  });

  it('resolves stringify indent for spaces and tabs', () => {
    expect(resolveJsonStringifyIndent(2, 'spaces')).toBe('  ');
    expect(resolveJsonStringifyIndent(4, 'spaces')).toBe('    ');
    expect(resolveJsonStringifyIndent(2, 'tabs')).toBe('\t');
  });

  it('auto-fixes trailing commas and single quotes', () => {
    const fixed = tryAutoFixJsonSource("{'a':1,}");
    expect(fixed.ok).toBe(true);
    if (fixed.ok) {
      expect(fixed.value).toEqual({ a: 1 });
    }
  });

  it('generates tree nodes with array index keys', () => {
    const nodes = generateJsonTreeNodes([{ id: 1 }], 0, undefined, () => 'id');
    expect(nodes).toHaveLength(1);
    expect(nodes[0].type).toBe('array');
    expect(nodes[0].preview).toBe('Array (1)');
    expect(nodes[0].children?.[0].key).toBe('[0]');
    expect(nodes[0].children?.[0].children?.[0].key).toBe('id');
  });

  it('suggests YAML converter for YAML-looking input', () => {
    const suggestion = resolveJsonFormatterSuggestion({
      source: 'name: Ada\nage: 36',
      hasOutput: false,
      validationStatus: 'error'
    });
    expect(suggestion?.id).toBe('jfv-yaml');
    expect(suggestion?.path).toBe('/data-converters/yaml-to-json-json-to-yaml');
  });

  it('suggests CSV export for object arrays', () => {
    const suggestion = resolveJsonFormatterSuggestion({
      source: '[{"id":1,"name":"Ada"}]',
      hasOutput: true,
      validationStatus: 'success'
    });
    expect(suggestion?.id).toBe('jfv-export-csv');
  });

  it('suggests empty-state CSV converter', () => {
    const suggestion = resolveJsonFormatterSuggestion({
      source: '   ',
      hasOutput: false,
      validationStatus: null
    });
    expect(suggestion?.id).toBe('jfv-empty');
  });
});
