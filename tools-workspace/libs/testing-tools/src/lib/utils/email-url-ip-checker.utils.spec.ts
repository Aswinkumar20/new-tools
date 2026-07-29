import {
  analyzeEmailUrlIpValues,
  detectEmailUrlIpMode,
  isPrivateIPv4,
  isValidIPv4,
  resolveEmailUrlIpSuggestion,
  validateEmailValue,
  validateIpValue,
  validateUrlValue
} from './email-url-ip-checker.utils';

describe('email-url-ip-checker.utils', () => {
  it('detects modes and validates email/url/ip', () => {
    expect(detectEmailUrlIpMode('a@b.co')).toBe('email');
    expect(detectEmailUrlIpMode('https://x.test')).toBe('url');
    expect(detectEmailUrlIpMode('10.0.0.1')).toBe('ip');
    expect(detectEmailUrlIpMode('hello')).toBe('auto');

    expect(validateEmailValue('john@example.com').valid).toBe(true);
    expect(validateEmailValue('bad').valid).toBe(false);
    expect(validateUrlValue('https://example.com/a').valid).toBe(true);
    expect(validateUrlValue('notaurl').valid).toBe(false);
    expect(validateIpValue('192.168.1.1').valid).toBe(true);
    expect(isValidIPv4('256.0.0.1')).toBe(false);
    expect(isPrivateIPv4('10.1.2.3')).toBe(true);
  });

  it('analyzes multi-line input and empty handling', () => {
    const outcome = analyzeEmailUrlIpValues({
      input: 'a@b.co\n\nhttps://example.com',
      mode: 'auto',
      allowMultiple: true,
      ignoreEmpty: true
    });
    expect(outcome.errors).toEqual([]);
    expect(outcome.results).toHaveLength(2);

    const empty = analyzeEmailUrlIpValues({
      input: '   ',
      mode: 'auto',
      allowMultiple: true,
      ignoreEmpty: true
    });
    expect(empty.errors[0]).toContain('Enter at least one value');
  });

  it('resolves contextual suggestions', () => {
    expect(
      resolveEmailUrlIpSuggestion({
        hasInput: false,
        hasResults: false,
        validCount: 0,
        invalidCount: 0,
        typeCounts: { email: 0, url: 0, ip: 0, unknown: 0 },
        results: [],
        errorMessage: null
      })?.id
    ).toBe('eui-get-started');

    const analyzed = analyzeEmailUrlIpValues({
      input: 'http://example.com',
      mode: 'url',
      allowMultiple: false,
      ignoreEmpty: true
    });
    expect(
      resolveEmailUrlIpSuggestion({
        hasInput: true,
        hasResults: true,
        validCount: 1,
        invalidCount: 0,
        typeCounts: { email: 0, url: 1, ip: 0, unknown: 0 },
        results: analyzed.results,
        errorMessage: null
      })?.id
    ).toBe('eui-http');
  });
});
