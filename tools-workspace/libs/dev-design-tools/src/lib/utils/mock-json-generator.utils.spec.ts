import {
  formatBytes,
  formatJsonString,
  generateFieldValue,
  generateMockJson,
  getFieldPlaceholder,
  parseArrayItemType,
  prependMockJsonHistory,
  resolveMockJsonSuggestion
} from './mock-json-generator.utils';
import type { MockJsonHistoryEntry } from '../types/mock-json-generator.types';

describe('mock-json-generator utils', () => {
  it('generates a single object and arrays of objects', () => {
    const single = generateMockJson(
      [
        { key: 'name', type: 'string', value: 'Ada', arrayLength: 3 },
        { key: 'age', type: 'number', value: '30', arrayLength: 3 }
      ],
      1
    );
    expect(single.error).toBeNull();
    expect(JSON.parse(single.json)).toEqual({ name: 'Ada', age: 30 });

    const many = generateMockJson([{ key: 'id', type: 'number', value: '', arrayLength: 3 }], 2);
    expect(Array.isArray(JSON.parse(many.json))).toBe(true);
  });

  it('warns on duplicates and errors without field names', () => {
    const dup = generateMockJson(
      [
        { key: 'a', type: 'string', value: '1', arrayLength: 3 },
        { key: 'a', type: 'string', value: '2', arrayLength: 3 }
      ],
      1
    );
    expect(dup.warnings[0]).toContain('Duplicate');

    const empty = generateMockJson([{ key: '', type: 'string', value: '', arrayLength: 3 }], 1);
    expect(empty.error).toContain('at least one field');
  });

  it('generates typed values and array item types', () => {
    expect(generateFieldValue({ key: 'b', type: 'boolean', value: 'yes', arrayLength: 3 }, 0)).toBe(true);
    expect(generateFieldValue({ key: 'n', type: 'null', value: '', arrayLength: 3 }, 0)).toBeNull();
    expect(parseArrayItemType('number')).toBe('number');
    expect(getFieldPlaceholder('email')).toBe('user@example.com');
  });

  it('formats json and bytes', () => {
    expect(formatJsonString('{"a":1}')).toContain('\n');
    expect(formatBytes(0)).toBe('0 Bytes');
    expect(formatBytes(2048)).toContain('KB');
  });

  it('prepends unique history by generated JSON', () => {
    const entry: MockJsonHistoryEntry = {
      timestamp: 1,
      fields: [],
      generatedJson: '{"a":1}'
    };
    expect(prependMockJsonHistory([entry], entry)).toHaveLength(1);
  });

  it('resolves contextual suggestions', () => {
    expect(
      resolveMockJsonSuggestion({
        hasGeneratedJson: true,
        hasCopiedJson: false,
        arrayCount: 1,
        fieldTypes: ['string', 'number'],
        hasDuplicateWarning: false
      })
    ).toBeNull();

    expect(
      resolveMockJsonSuggestion({
        hasGeneratedJson: true,
        hasCopiedJson: true,
        arrayCount: 1,
        fieldTypes: ['string'],
        hasDuplicateWarning: false
      })?.id
    ).toBe('mjg-formatter');

    expect(
      resolveMockJsonSuggestion({
        hasGeneratedJson: true,
        hasCopiedJson: false,
        arrayCount: 1,
        fieldTypes: ['email'],
        hasDuplicateWarning: false
      })?.id
    ).toBe('mjg-http');
  });
});
