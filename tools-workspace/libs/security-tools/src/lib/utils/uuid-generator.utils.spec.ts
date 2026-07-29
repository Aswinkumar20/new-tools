import { webcrypto } from 'crypto';
import { UUID_GENERATOR_DEFAULT_FORM } from '../constants/uuid-generator.constants';
import {
  createUuidV4,
  formatUuidValue,
  generateUuidEntries,
  mergeUuidHistory,
  resolveUuidFormatLabel,
  resolveUuidSuggestion,
  shortenUuidDisplay,
  validateUuidGenerateCount
} from './uuid-generator.utils';

describe('uuid-generator.utils', () => {
  beforeAll(() => {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: webcrypto
    });
  });

  it('creates and formats v4 UUIDs', () => {
    const raw = createUuidV4();
    expect(raw).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );

    expect(
      formatUuidValue(raw, { uppercase: true, withHyphens: false, withBraces: true })
    ).toMatch(/^\{[0-9A-F]{32}\}$/);

    expect(resolveUuidFormatLabel({ uppercase: false, withHyphens: true, withBraces: false })).toBe(
      'hyphen'
    );
    expect(resolveUuidFormatLabel({ uppercase: true, withHyphens: false, withBraces: true })).toBe(
      'upper+brace'
    );
    expect(shortenUuidDisplay('')).toBe('—');
    expect(shortenUuidDisplay('abcdefghijklmnop')).toBe('abcdefgh…');
  });

  it('validates count and generates batches', () => {
    expect(validateUuidGenerateCount(0)[0]).toContain('between 1 and 50');
    expect(validateUuidGenerateCount(1)).toEqual([]);

    const { entries, errors } = generateUuidEntries({
      ...UUID_GENERATOR_DEFAULT_FORM,
      count: 3
    });
    expect(errors).toEqual([]);
    expect(entries).toHaveLength(3);

    const merged = mergeUuidHistory(entries, [{ value: 'old', createdAt: 1 }], 4);
    expect(merged).toHaveLength(4);
    expect(merged[0].value).toBe(entries[0].value);
  });

  it('resolves contextual suggestions', () => {
    expect(
      resolveUuidSuggestion({
        hasUuids: false,
        uuidCount: 0,
        batchCount: 1,
        withHyphens: true,
        errorMessage: null
      })?.id
    ).toBe('uuid-get-started');

    expect(
      resolveUuidSuggestion({
        hasUuids: false,
        uuidCount: 0,
        batchCount: 99,
        withHyphens: true,
        errorMessage: 'Count must be between 1 and 50.'
      })?.id
    ).toBe('uuid-count-range');

    expect(
      resolveUuidSuggestion({
        hasUuids: true,
        uuidCount: 1,
        batchCount: 1,
        withHyphens: false,
        errorMessage: null
      })?.id
    ).toBe('uuid-compact');

    expect(
      resolveUuidSuggestion({
        hasUuids: true,
        uuidCount: 1,
        batchCount: 1,
        withHyphens: true,
        errorMessage: null
      })?.id
    ).toBe('uuid-secure-copy');
  });
});
