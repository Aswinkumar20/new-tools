import { webcrypto } from 'crypto';
import { stDecryptAesGcm, stEncryptAesGcm } from '../shared/st-aes-gcm.util';
import {
  formatPrivateNotesSavedTime,
  resolvePrivateNotesStatusLabel,
  resolvePrivateNotesSuggestion,
  validatePrivateNotesDecrypt,
  validatePrivateNotesEncrypt
} from './private-notes.utils';

describe('private-notes.utils', () => {
  beforeAll(() => {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: webcrypto
    });
  });

  it('validates encrypt and decrypt inputs', () => {
    expect(validatePrivateNotesEncrypt('', 'pw')[0]).toContain('note content');
    expect(validatePrivateNotesEncrypt('note', '')[0]).toContain('password');
    expect(validatePrivateNotesEncrypt('note', 'pw')).toEqual([]);

    expect(validatePrivateNotesDecrypt(false, 'pw')[0]).toContain('no encrypted note');
    expect(validatePrivateNotesDecrypt(true, '')[0]).toContain('password used to encrypt');
    expect(validatePrivateNotesDecrypt(true, 'pw')).toEqual([]);
  });

  it('formats status and saved labels', () => {
    expect(resolvePrivateNotesStatusLabel(false, false)).toBe('Empty');
    expect(resolvePrivateNotesStatusLabel(true, true)).toBe('Locked');
    expect(resolvePrivateNotesStatusLabel(true, false)).toBe('Unlocked');
    expect(formatPrivateNotesSavedTime(null)).toBe('Never');
    expect(formatPrivateNotesSavedTime(Date.now())).toMatch(/\d/);
  });

  it('resolves contextual suggestions', () => {
    expect(
      resolvePrivateNotesSuggestion({
        hasNote: false,
        hasPassword: false,
        passwordLength: 0,
        hasEncrypted: false,
        isLocked: false,
        errorMessage: null
      })?.id
    ).toBe('pn-get-started');

    expect(
      resolvePrivateNotesSuggestion({
        hasNote: true,
        hasPassword: false,
        passwordLength: 0,
        hasEncrypted: false,
        isLocked: false,
        errorMessage: null
      })?.id
    ).toBe('pn-need-password');

    expect(
      resolvePrivateNotesSuggestion({
        hasNote: true,
        hasPassword: true,
        passwordLength: 4,
        hasEncrypted: false,
        isLocked: false,
        errorMessage: null
      })?.id
    ).toBe('pn-short-password');

    expect(
      resolvePrivateNotesSuggestion({
        hasNote: false,
        hasPassword: true,
        passwordLength: 12,
        hasEncrypted: true,
        isLocked: true,
        errorMessage: null
      })?.id
    ).toBe('pn-locked');

    expect(
      resolvePrivateNotesSuggestion({
        hasNote: true,
        hasPassword: true,
        passwordLength: 12,
        hasEncrypted: true,
        isLocked: false,
        errorMessage: null
      })?.id
    ).toBe('pn-secure-clipboard');
  });

  it('round-trips AES-GCM ciphertext', async () => {
    const cipher = await stEncryptAesGcm('session note', 'passphrase-1');
    expect(cipher.length).toBeGreaterThan(20);
    expect(await stDecryptAesGcm(cipher, 'passphrase-1')).toBe('session note');
  });
});
