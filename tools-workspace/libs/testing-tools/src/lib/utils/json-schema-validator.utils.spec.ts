import {
  describeJsonValueType,
  joinJsonSchemaPath,
  resolveJsonSchemaSuggestion,
  validateJsonSchemaDocument
} from './json-schema-validator.utils';

describe('json-schema-validator.utils', () => {
  const sampleSchema = `{
    "type": "object",
    "properties": {
      "name": { "type": "string" },
      "age": { "type": "number" },
      "tags": { "type": "array", "items": { "type": "string" } }
    },
    "required": ["name"]
  }`;

  it('validates matching documents', () => {
    const { result, errors } = validateJsonSchemaDocument({
      schema: sampleSchema,
      data: JSON.stringify({ name: 'Ada', age: 36, tags: ['a'] }),
      strictTypes: true
    });
    expect(errors).toEqual([]);
    expect(result?.valid).toBe(true);
    expect(result?.instanceType).toContain('object');
  });

  it('reports type and required issues', () => {
    const { result } = validateJsonSchemaDocument({
      schema: sampleSchema,
      data: JSON.stringify({ age: '36', tags: [1] }),
      strictTypes: true
    });
    expect(result?.valid).toBe(false);
    expect(result?.issues.some((i) => i.message.includes('Missing required'))).toBe(true);
  });

  it('returns parse errors for bad JSON', () => {
    expect(
      validateJsonSchemaDocument({
        schema: '{',
        data: '{}',
        strictTypes: true
      }).errors[0]
    ).toContain('Schema is not valid JSON');

    expect(
      validateJsonSchemaDocument({
        schema: '{}',
        data: '{',
        strictTypes: true
      }).errors[0]
    ).toContain('Data is not valid JSON');
  });

  it('formats paths and type descriptions', () => {
    expect(joinJsonSchemaPath('', 'name')).toBe('name');
    expect(joinJsonSchemaPath('user', '0')).toBe('user[0]');
    expect(joinJsonSchemaPath('user', 'name')).toBe('user.name');
    expect(describeJsonValueType([1, 2])).toBe('array (2 items)');
  });

  it('resolves contextual suggestions', () => {
    expect(
      resolveJsonSchemaSuggestion({
        hasSchema: false,
        hasData: false,
        hasResult: false,
        isValid: false,
        issueCount: 0,
        errorMessage: null
      })?.id
    ).toBe('jsv-get-started');

    expect(
      resolveJsonSchemaSuggestion({
        hasSchema: true,
        hasData: true,
        hasResult: true,
        isValid: true,
        issueCount: 0,
        errorMessage: null
      })?.id
    ).toBe('jsv-valid');
  });
});
