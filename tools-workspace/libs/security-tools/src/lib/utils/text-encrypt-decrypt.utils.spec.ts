import {
  canRunTextCrypto,
  resolveTextCryptoInputLength,
  resolveTextEncryptDecryptSuggestion,
  toggleTextCryptoMode,
  validateTextCryptoOperation
} from './text-encrypt-decrypt.utils';

describe('text-encrypt-decrypt.utils', () => {
  it('validates encrypt and decrypt inputs', () => {
    expect(
      validateTextCryptoOperation({
        mode: 'encrypt',
        plaintext: '',
        ciphertext: '',
        password: ''
      })[0]
    ).toContain('password');

    expect(
      validateTextCryptoOperation({
        mode: 'encrypt',
        plaintext: '',
        ciphertext: '',
        password: 'pw'
      })[0]
    ).toContain('plaintext');

    expect(
      validateTextCryptoOperation({
        mode: 'decrypt',
        plaintext: '',
        ciphertext: '',
        password: 'pw'
      })[0]
    ).toContain('ciphertext');

    expect(
      validateTextCryptoOperation({
        mode: 'encrypt',
        plaintext: 'hi',
        ciphertext: '',
        password: 'pw'
      })
    ).toEqual([]);
  });

  it('computes can-run and input length helpers', () => {
    expect(canRunTextCrypto('encrypt', 'hi', '', 'pw')).toBe(true);
    expect(canRunTextCrypto('encrypt', 'hi', '', '')).toBe(false);
    expect(canRunTextCrypto('decrypt', '', 'cipher', 'pw')).toBe(true);
    expect(resolveTextCryptoInputLength('encrypt', 'abc', 'zzzz')).toBe(3);
    expect(resolveTextCryptoInputLength('decrypt', 'abc', 'zzzz')).toBe(4);
    expect(toggleTextCryptoMode('encrypt')).toBe('decrypt');
    expect(toggleTextCryptoMode('decrypt')).toBe('encrypt');
  });

  it('resolves contextual suggestions', () => {
    expect(
      resolveTextEncryptDecryptSuggestion({
        mode: 'encrypt',
        hasPassword: false,
        hasPlaintext: false,
        hasCiphertext: false,
        hasOutput: false,
        lastAction: null,
        errorMessage: null
      })?.id
    ).toBe('ted-get-started');

    expect(
      resolveTextEncryptDecryptSuggestion({
        mode: 'encrypt',
        hasPassword: false,
        hasPlaintext: true,
        hasCiphertext: false,
        hasOutput: false,
        lastAction: null,
        errorMessage: null
      })?.id
    ).toBe('ted-need-password');

    expect(
      resolveTextEncryptDecryptSuggestion({
        mode: 'encrypt',
        hasPassword: true,
        hasPlaintext: true,
        hasCiphertext: false,
        hasOutput: true,
        lastAction: 'encrypt',
        errorMessage: null
      })?.id
    ).toBe('ted-after-encrypt');

    expect(
      resolveTextEncryptDecryptSuggestion({
        mode: 'decrypt',
        hasPassword: true,
        hasPlaintext: false,
        hasCiphertext: true,
        hasOutput: false,
        lastAction: null,
        errorMessage: 'Operation failed: bad'
      })?.id
    ).toBe('ted-failed');
  });
});
