import { USER_AGENT_EMPTY_ERROR } from '../constants/user-agent-parser.constants';
import {
  buildParsedUserAgentCopyText,
  parseUserAgentInput,
  parseUserAgentString,
  resolveUserAgentSuggestion
} from './user-agent-parser.utils';

const CHROME_WINDOWS_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const IPHONE_SAFARI_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1';

const GOOGLEBOT_UA =
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

describe('user-agent-parser.utils', () => {
  it('parses Chrome on Windows as desktop', () => {
    const parsed = parseUserAgentString(CHROME_WINDOWS_UA);
    expect(parsed.browser).toBe('Chrome');
    expect(parsed.browserVersion).toBe('120.0.0.0');
    expect(parsed.os).toBe('Windows');
    expect(parsed.osVersion).toBe('10.0');
    expect(parsed.deviceType).toBe('desktop');
    expect(parsed.engine).toBe('WebKit');
    expect(parsed.isBot).toBe(false);
  });

  it('parses iPhone Safari as mobile with dotted iOS version', () => {
    const parsed = parseUserAgentString(IPHONE_SAFARI_UA);
    expect(parsed.browser).toBe('Safari');
    expect(parsed.os).toBe('iOS');
    expect(parsed.osVersion).toBe('17.2');
    expect(parsed.deviceType).toBe('mobile');
  });

  it('flags bot user agents and overrides device type', () => {
    const parsed = parseUserAgentString(GOOGLEBOT_UA);
    expect(parsed.isBot).toBe(true);
    expect(parsed.deviceType).toBe('bot');
  });

  it('returns empty-input error without parsing', () => {
    const outcome = parseUserAgentInput('   ');
    expect(outcome.parsed).toBeNull();
    expect(outcome.errors).toEqual([USER_AGENT_EMPTY_ERROR]);
  });

  it('builds copy text for parsed details', () => {
    const parsed = parseUserAgentString(CHROME_WINDOWS_UA);
    const text = buildParsedUserAgentCopyText(parsed);
    expect(text).toContain('Browser: Chrome (120.0.0.0)');
    expect(text).toContain('Device: desktop');
    expect(text).toContain('Raw:');
    expect(text).toContain(CHROME_WINDOWS_UA);
  });

  it('resolves contextual suggestions', () => {
    expect(
      resolveUserAgentSuggestion({
        hasInput: false,
        hasParsed: false,
        errorMessage: null,
        isBot: false,
        deviceType: null,
        browser: null,
        os: null
      })?.id
    ).toBe('uap-get-started');

    expect(
      resolveUserAgentSuggestion({
        hasInput: true,
        hasParsed: true,
        errorMessage: null,
        isBot: true,
        deviceType: 'bot',
        browser: null,
        os: null
      })?.id
    ).toBe('uap-bot');

    expect(
      resolveUserAgentSuggestion({
        hasInput: true,
        hasParsed: true,
        errorMessage: null,
        isBot: false,
        deviceType: 'mobile',
        browser: 'Safari',
        os: 'iOS'
      })?.id
    ).toBe('uap-device');

    expect(
      resolveUserAgentSuggestion({
        hasInput: true,
        hasParsed: true,
        errorMessage: null,
        isBot: false,
        deviceType: 'desktop',
        browser: 'Chrome',
        os: 'Windows'
      })?.id
    ).toBe('uap-parsed');

    expect(
      resolveUserAgentSuggestion({
        hasInput: true,
        hasParsed: true,
        errorMessage: null,
        isBot: false,
        deviceType: 'unknown',
        browser: null,
        os: null
      })?.id
    ).toBe('uap-unknown');
  });
});
