import {
  buildJsonParserTree,
  filterJsonParserTree,
  flattenJsonParserTree,
  formatJsonParserParsedValue,
  resolveJsonParserPathValue,
  resolveJsonParserSuggestion,
  tryParseJsonParserInput
} from './json-parser.utils';

describe('json-parser.utils', () => {
  it('builds a tree with JSONPath-style paths', () => {
    const nodes = buildJsonParserTree({ a: [1, { b: true }] }, '$', 0, undefined, () => 'id');
    expect(nodes).toHaveLength(1);
    expect(nodes[0].path).toBe('$');
    expect(nodes[0].children?.[0].path).toBe('$.a');
    expect(nodes[0].children?.[0].children?.[0].path).toBe('$.a[0]');
    expect(nodes[0].children?.[0].children?.[1].path).toBe('$.a[1]');
  });

  it('flattens and filters tree nodes', () => {
    const tree = buildJsonParserTree(
      { meta: { title: 'Example' }, authors: [{ name: 'Ada' }] },
      '$',
      0,
      undefined,
      () => 'id'
    );
    expect(flattenJsonParserTree(tree).length).toBeGreaterThan(3);
    const filtered = filterJsonParserTree(tree, 'Ada');
    expect(filtered.length).toBe(1);
    expect(filtered[0].children?.length).toBeGreaterThan(0);
  });

  it('resolves path values and formats parsed literals', () => {
    const value = { authors: [{ name: 'Ada' }] };
    expect(resolveJsonParserPathValue(value, '$.authors[0].name')).toBe('Ada');
    expect(formatJsonParserParsedValue('hello')).toBe('hello');
    expect(formatJsonParserParsedValue({ a: 1 })).toContain('"a"');
  });

  it('reports parse failures', () => {
    const result = tryParseJsonParserInput('{"a":');
    expect(result.success).toBe(false);
  });

  it('suggests linter on parse errors and formatter on success', () => {
    expect(
      resolveJsonParserSuggestion({
        source: '{"a":',
        hasTree: false,
        parseStatus: 'error'
      })?.id
    ).toBe('jp-lint');

    expect(
      resolveJsonParserSuggestion({
        source: '{"a":1}',
        hasTree: true,
        parseStatus: 'success'
      })?.id
    ).toBe('jp-format');
  });
});
