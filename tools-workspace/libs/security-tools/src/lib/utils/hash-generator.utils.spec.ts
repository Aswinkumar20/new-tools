import { webcrypto } from 'crypto';
import {
  bytesToHex,
  computeHashResult,
  formatHashHex,
  formatHashOutputText,
  isUnsupportedHashAlgorithm,
  resolveHashSuggestion,
  resolveWebCryptoDigestName
} from './hash-generator.utils';
import type { HashResult } from '../types/hash-generator.types';

describe('hash-generator.utils', () => {
  beforeAll(() => {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: webcrypto
    });
  });

  it('resolves digest names and unsupported algorithms', () => {
    expect(resolveWebCryptoDigestName('sha256')).toBe('SHA-256');
    expect(resolveWebCryptoDigestName('md5')).toBeNull();
    expect(isUnsupportedHashAlgorithm('sha1')).toBe(true);
    expect(isUnsupportedHashAlgorithm('sha512')).toBe(false);
  });

  it('formats hex and combined output', () => {
    const result: HashResult = {
      algorithm: 'sha256',
      hex: 'abcd',
      base64: 'qg==',
      lengthBits: 16
    };
    expect(formatHashHex(result.hex, true)).toBe('ABCD');
    expect(formatHashOutputText(result, 'hex', false)).toBe('abcd');
    expect(formatHashOutputText(result, 'both', true)).toContain('Base64');
    expect(bytesToHex(new Uint8Array([0, 15, 255]))).toBe('000fff');
  });

  it('computes sha256 and rejects empty / unsupported', async () => {
    const empty = await computeHashResult('', 'sha256');
    expect(empty.errors[0]).toContain('Enter some text');

    const unsupported = await computeHashResult('x', 'md5');
    expect(unsupported.errors[0]).toContain('MD5 and SHA-1');

    const ok = await computeHashResult('hello', 'sha256');
    expect(ok.errors).toEqual([]);
    expect(ok.result?.lengthBits).toBe(256);
    expect(ok.result?.hex).toHaveLength(64);
  });

  it('resolves contextual suggestions', () => {
    expect(
      resolveHashSuggestion({
        hasInput: false,
        hasResult: false,
        hasError: false,
        algorithm: 'sha256',
        errorMessage: null
      })?.id
    ).toBe('hg-get-started');

    expect(
      resolveHashSuggestion({
        hasInput: true,
        hasResult: false,
        hasError: true,
        algorithm: 'md5',
        errorMessage: 'MD5 and SHA-1'
      })?.id
    ).toBe('hg-unsupported-algo');

    expect(
      resolveHashSuggestion({
        hasInput: true,
        hasResult: true,
        hasError: false,
        algorithm: 'sha256',
        errorMessage: null
      })?.id
    ).toBe('hg-file-meta');
  });
});
