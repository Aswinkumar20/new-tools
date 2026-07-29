import {
  applyFindAndReplace,
  countFindMatches,
  resolveFindAndReplaceSuggestion
} from './find-and-replace.utils';
import { findReplace } from '../shared/text-transform.utils';

describe('find-and-replace.utils', () => {
  const allInsensitive = { useRegex: false, caseSensitive: false, replaceAll: true };

  it('replaces all plain matches like shared findReplace', () => {
    const result = applyFindAndReplace('foo baz foo', 'foo', 'bar', allInsensitive);
    expect(result.errorMessage).toBe('');
    expect(result.output).toBe('bar baz bar');
    expect(result.output).toBe(
      findReplace('foo baz foo', 'foo', 'bar', allInsensitive)
    );
    expect(result.matchCount).toBe(2);
  });

  it('replaces only the first match when replaceAll is off', () => {
    const result = applyFindAndReplace('foo baz foo', 'foo', 'bar', {
      useRegex: false,
      caseSensitive: true,
      replaceAll: false
    });
    expect(result.output).toBe('bar baz foo');
    expect(result.matchCount).toBe(1);
  });

  it('passes through when find is empty', () => {
    const result = applyFindAndReplace('keep me', '', 'x', allInsensitive);
    expect(result.output).toBe('keep me');
    expect(result.matchCount).toBe(0);
  });

  it('reports invalid regex errors', () => {
    const result = applyFindAndReplace('test', '[', 'x', {
      useRegex: true,
      caseSensitive: false,
      replaceAll: true
    });
    expect(result.output).toBe('');
    expect(result.errorMessage).toContain('Invalid regex');
    expect(result.matchCount).toBe(0);
  });

  it('counts regex matches', () => {
    expect(
      countFindMatches('a1 b2 c3', '\\d', { useRegex: true, caseSensitive: true, replaceAll: true })
    ).toBe(3);
  });

  it('resolves contextual suggestions', () => {
    expect(
      resolveFindAndReplaceSuggestion({
        hasInput: false,
        hasFindText: false,
        hasOutput: false,
        errorMessage: '',
        matchCount: 0,
        useRegex: false,
        outputUnchanged: false
      })?.id
    ).toBe('far-get-started');

    expect(
      resolveFindAndReplaceSuggestion({
        hasInput: true,
        hasFindText: true,
        hasOutput: false,
        errorMessage: 'Invalid regex: ...',
        matchCount: 0,
        useRegex: true,
        outputUnchanged: false
      })?.id
    ).toBe('far-regex-error');

    expect(
      resolveFindAndReplaceSuggestion({
        hasInput: true,
        hasFindText: false,
        hasOutput: true,
        errorMessage: '',
        matchCount: 0,
        useRegex: false,
        outputUnchanged: true
      })?.id
    ).toBe('far-no-find');

    expect(
      resolveFindAndReplaceSuggestion({
        hasInput: true,
        hasFindText: true,
        hasOutput: true,
        errorMessage: '',
        matchCount: 0,
        useRegex: false,
        outputUnchanged: true
      })?.id
    ).toBe('far-no-match');

    expect(
      resolveFindAndReplaceSuggestion({
        hasInput: true,
        hasFindText: true,
        hasOutput: true,
        errorMessage: '',
        matchCount: 2,
        useRegex: false,
        outputUnchanged: false
      })?.id
    ).toBe('far-done');
  });
});
