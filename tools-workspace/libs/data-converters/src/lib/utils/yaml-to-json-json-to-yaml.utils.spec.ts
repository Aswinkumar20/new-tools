import {
  parseYamlDocument,
  resolveYamlJsonSuggestion,
  sortYamlJsonValue,
  stringifyToYaml
} from './yaml-to-json-json-to-yaml.utils';

describe('yaml-to-json-json-to-yaml.utils', () => {
  it('parses sample-style YAML into objects and arrays', () => {
    const parsed = parseYamlDocument(`users:
  - id: 1
    name: Ada
settings:
  theme: dark`);
    expect(parsed).toEqual({
      users: [{ id: 1, name: 'Ada' }],
      settings: { theme: 'dark' }
    });
  });

  it('stringifies JSON to YAML with quoting options', () => {
    const yaml = stringifyToYaml(
      { name: 'Ada Lovelace', active: true },
      0,
      { indent: 2, quoteStrings: true }
    );
    expect(yaml).toContain('name: "Ada Lovelace"');
    expect(yaml).toContain('active: true');
  });

  it('sorts object keys recursively', () => {
    expect(sortYamlJsonValue({ b: 1, a: { d: 2, c: 3 } })).toEqual({
      a: { c: 3, d: 2 },
      b: 1
    });
  });

  it('suggests mode switch for JSON pasted into YAML mode', () => {
    expect(
      resolveYamlJsonSuggestion({
        mode: 'yaml-to-json',
        yamlInput: '{"a":1}',
        jsonInput: '',
        hasOutput: false,
        status: 'idle'
      })?.id
    ).toBe('yj-switch-json');
  });

  it('suggests formatter after successful YAML→JSON conversion', () => {
    expect(
      resolveYamlJsonSuggestion({
        mode: 'yaml-to-json',
        yamlInput: 'a: 1',
        jsonInput: '',
        hasOutput: true,
        status: 'success'
      })?.path
    ).toBe('/data-converters/json-formatter-beautifier-validator');
  });
});
