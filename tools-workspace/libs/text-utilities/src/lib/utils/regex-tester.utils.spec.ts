import { testRegex } from '../shared/text-transform.utils';
import {
  buildRegexFlagsString,
  formatRegexMatchResults,
  resolveRegexTesterSuggestion,
  runRegexTester
} from './regex-tester.utils';
import { REGEX_TESTER_DEFAULT_FLAGS } from '../constants/regex-tester.constants';

describe('regex-tester.utils', () => {
  it('builds flags string in gims u order', () => {
    expect(buildRegexFlagsString(REGEX_TESTER_DEFAULT_FLAGS)).toBe('g');
    expect(
      buildRegexFlagsString({
        global: true,
        ignoreCase: true,
        multiline: true,
        dotAll: true,
        unicode: true
      })
    ).toBe('gimsu');
  });

  it('formats match results with indices and groups', () => {
    const { matches } = testRegex('ab12cd34', '(\\d+)', 'g');
    const formatted = formatRegexMatchResults(matches);
    expect(formatted).toContain('#1');
    expect(formatted).toContain('groups:');
    expect(formatted).toContain('"12"');
  });

  it('runs regex tests matching shared testRegex', () => {
    const result = runRegexTester({
      inputText: 'hello world',
      pattern: '\\w+',
      flags: REGEX_TESTER_DEFAULT_FLAGS
    });
    expect(result.errorMessage).toBe('');
    expect(result.matchCount).toBe(2);
    expect(result.output).toContain('#1');
    expect(result.output).toContain('#2');
  });

  it('returns empty when pattern is missing', () => {
    expect(
      runRegexTester({
        inputText: 'hello',
        pattern: '',
        flags: REGEX_TESTER_DEFAULT_FLAGS
      })
    ).toEqual({ matchCount: 0, output: '', errorMessage: '' });
  });

  it('surfaces invalid pattern errors', () => {
    const result = runRegexTester({
      inputText: 'hello',
      pattern: '(',
      flags: REGEX_TESTER_DEFAULT_FLAGS
    });
    expect(result.matchCount).toBe(0);
    expect(result.output).toBe('');
    expect(result.errorMessage.length).toBeGreaterThan(0);
  });

  it('resolves contextual suggestions', () => {
    expect(
      resolveRegexTesterSuggestion({
        hasInput: false,
        hasPattern: false,
        hasOutput: false,
        errorMessage: '',
        matchCount: 0,
        flagGlobal: true
      })?.id
    ).toBe('rx-get-started');

    expect(
      resolveRegexTesterSuggestion({
        hasInput: true,
        hasPattern: true,
        hasOutput: false,
        errorMessage: 'Invalid regular expression',
        matchCount: 0,
        flagGlobal: true
      })?.id
    ).toBe('rx-error');

    expect(
      resolveRegexTesterSuggestion({
        hasInput: false,
        hasPattern: true,
        hasOutput: false,
        errorMessage: '',
        matchCount: 0,
        flagGlobal: true
      })?.id
    ).toBe('rx-need-input');

    expect(
      resolveRegexTesterSuggestion({
        hasInput: true,
        hasPattern: true,
        hasOutput: false,
        errorMessage: '',
        matchCount: 0,
        flagGlobal: true
      })?.id
    ).toBe('rx-none');

    expect(
      resolveRegexTesterSuggestion({
        hasInput: true,
        hasPattern: true,
        hasOutput: true,
        errorMessage: '',
        matchCount: 3,
        flagGlobal: true
      })?.id
    ).toBe('rx-found');
  });
});
