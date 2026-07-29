import { SECURE_CLIPBOARD_EXPIRED_WARNING } from '../constants/secure-clipboard.constants';
import {
  computeSecureClipboardRemainingSeconds,
  formatSecureClipboardExpiresAt,
  isSecureClipboardExpired,
  resolveSecureClipboardStatusLabel,
  resolveSecureClipboardSuggestion,
  validateSecureClipboardStore
} from './secure-clipboard.utils';

describe('secure-clipboard.utils', () => {
  it('validates store inputs', () => {
    expect(validateSecureClipboardStore('', 'pw', 60)[0]).toContain('Enter some text');
    expect(validateSecureClipboardStore('hi', '', 60)[0]).toContain('password');
    expect(validateSecureClipboardStore('hi', 'pw', 0)[0]).toContain('greater than 0');
    expect(validateSecureClipboardStore('hi', 'pw', 30)).toEqual([]);
  });

  it('computes expiry helpers', () => {
    const now = 1_000_000;
    expect(isSecureClipboardExpired(null, now)).toBe(false);
    expect(isSecureClipboardExpired(now - 1, now)).toBe(true);
    expect(computeSecureClipboardRemainingSeconds(now + 5500, now)).toBe(5);
    expect(formatSecureClipboardExpiresAt(null)).toBe('N/A');
    expect(resolveSecureClipboardStatusLabel(false, false)).toBe('Empty');
    expect(resolveSecureClipboardStatusLabel(true, true)).toBe('Expired');
    expect(resolveSecureClipboardStatusLabel(true, false)).toBe('Active');
  });

  it('resolves contextual suggestions', () => {
    expect(
      resolveSecureClipboardSuggestion({
        hasText: false,
        hasPassword: false,
        hasStored: false,
        isActive: false,
        ttlSeconds: 60,
        errorMessage: null,
        warningMessage: null
      })?.id
    ).toBe('sc-get-started');

    expect(
      resolveSecureClipboardSuggestion({
        hasText: true,
        hasPassword: false,
        hasStored: false,
        isActive: false,
        ttlSeconds: 60,
        errorMessage: null,
        warningMessage: null
      })?.id
    ).toBe('sc-need-password');

    expect(
      resolveSecureClipboardSuggestion({
        hasText: true,
        hasPassword: true,
        hasStored: false,
        isActive: false,
        ttlSeconds: 10,
        errorMessage: null,
        warningMessage: null
      })?.id
    ).toBe('sc-short-ttl');

    expect(
      resolveSecureClipboardSuggestion({
        hasText: true,
        hasPassword: true,
        hasStored: false,
        isActive: false,
        ttlSeconds: 60,
        errorMessage: null,
        warningMessage: SECURE_CLIPBOARD_EXPIRED_WARNING
      })?.id
    ).toBe('sc-expired');
  });
});
