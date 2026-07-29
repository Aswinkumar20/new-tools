import { stripHtmlTags } from '../shared/text-transform.utils';
import {
  inputContainsHtmlEntities,
  inputContainsHtmlTags,
  inputContainsScriptOrStyle,
  resolveHtmlTagStripperSuggestion,
  stripHtmlTagText
} from './html-tag-stripper.utils';

describe('html-tag-stripper.utils', () => {
  it('strips tags and matches shared stripHtmlTags', () => {
    const html = '<p>Hello <b>world</b></p>';
    const result = stripHtmlTagText({ inputText: html, preserveLineBreaks: false });
    expect(result.output).toBe('Hello world');
    expect(result.output).toBe(stripHtmlTags(html, false));
  });

  it('preserves line breaks from block tags when enabled', () => {
    const html = '<p>One</p><p>Two</p>';
    const withBreaks = stripHtmlTagText({ inputText: html, preserveLineBreaks: true });
    const withoutBreaks = stripHtmlTagText({ inputText: html, preserveLineBreaks: false });
    expect(withBreaks.output).toBe(stripHtmlTags(html, true));
    expect(withoutBreaks.output).toBe(stripHtmlTags(html, false));
    expect(withBreaks.output).toContain('\n');
  });

  it('returns empty output for empty input', () => {
    expect(stripHtmlTagText({ inputText: '', preserveLineBreaks: true })).toEqual({ output: '' });
  });

  it('detects tags, entities, and script/style blocks', () => {
    expect(inputContainsHtmlTags('<div>x</div>')).toBe(true);
    expect(inputContainsHtmlTags('plain text')).toBe(false);
    expect(inputContainsHtmlEntities('A &amp; B')).toBe(true);
    expect(inputContainsHtmlEntities('A and B')).toBe(false);
    expect(inputContainsScriptOrStyle('<script>alert(1)</script>')).toBe(true);
    expect(inputContainsScriptOrStyle('<p>safe</p>')).toBe(false);
  });

  it('resolves contextual suggestions', () => {
    expect(
      resolveHtmlTagStripperSuggestion({
        hasInput: false,
        hasOutput: false,
        preserveLineBreaks: true,
        containsHtmlTags: false,
        containsHtmlEntities: false,
        containsScriptOrStyle: false
      })?.id
    ).toBe('hts-get-started');

    expect(
      resolveHtmlTagStripperSuggestion({
        hasInput: true,
        hasOutput: true,
        preserveLineBreaks: true,
        containsHtmlTags: false,
        containsHtmlEntities: false,
        containsScriptOrStyle: false
      })?.id
    ).toBe('hts-no-markup');

    expect(
      resolveHtmlTagStripperSuggestion({
        hasInput: true,
        hasOutput: true,
        preserveLineBreaks: true,
        containsHtmlTags: false,
        containsHtmlEntities: true,
        containsScriptOrStyle: false
      })?.id
    ).toBe('hts-entities-only');

    expect(
      resolveHtmlTagStripperSuggestion({
        hasInput: true,
        hasOutput: true,
        preserveLineBreaks: true,
        containsHtmlTags: true,
        containsHtmlEntities: false,
        containsScriptOrStyle: true
      })?.id
    ).toBe('hts-script-style');

    expect(
      resolveHtmlTagStripperSuggestion({
        hasInput: true,
        hasOutput: true,
        preserveLineBreaks: false,
        containsHtmlTags: true,
        containsHtmlEntities: false,
        containsScriptOrStyle: false
      })?.id
    ).toBe('hts-breaks-off');

    expect(
      resolveHtmlTagStripperSuggestion({
        hasInput: true,
        hasOutput: true,
        preserveLineBreaks: true,
        containsHtmlTags: true,
        containsHtmlEntities: false,
        containsScriptOrStyle: false
      })?.id
    ).toBe('hts-stripped');
  });
});
