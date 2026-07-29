import { SLUG_LONG_LENGTH_THRESHOLD } from '../constants/slug-generator.constants';
import {
  generateSlug,
  inputLooksLikeSlug,
  inputLooksLikeUrl,
  resolveSlugSuggestion,
} from './slug-generator.utils';

describe('slug-generator.utils', () => {
  it('generates a hyphen slug from a headline', () => {
    expect(
      generateSlug({ text: 'Hello World Example', separator: '-', removeNumbers: false })
    ).toBe('hello-world-example');
  });

  it('uses underscore separator', () => {
    expect(generateSlug({ text: 'Hello World', separator: '_', removeNumbers: false })).toBe(
      'hello_world'
    );
  });

  it('removes numbers when enabled', () => {
    const slug = generateSlug({ text: 'Top 10 Tips', separator: '-', removeNumbers: true });
    expect(slug).not.toContain('10');
    // Numbers are stripped after separator collapse, so adjacent hyphens can remain.
    expect(slug).toBe('top--tips');
  });

  it('strips punctuation', () => {
    expect(
      generateSlug({ text: "What's New?!", separator: '-', removeNumbers: false })
    ).toBe('whats-new');
  });

  it('detects slug-like input', () => {
    expect(inputLooksLikeSlug('hello-world')).toBe(true);
    expect(inputLooksLikeSlug('Hello World')).toBe(false);
  });

  it('detects URL input', () => {
    expect(inputLooksLikeUrl('https://example.com/page')).toBe(true);
    expect(inputLooksLikeUrl('My Page Title')).toBe(false);
  });

  it('suggests get-started with empty input', () => {
    expect(
      resolveSlugSuggestion({
        hasInput: false,
        hasSlug: false,
        slugLength: 0,
        separator: '-',
        removeNumbers: false,
        inputLooksLikeUrl: false,
        inputLooksLikeSlug: false,
      })?.id
    ).toBe('slug-get-started');
  });

  it('suggests when input looks like a URL', () => {
    expect(
      resolveSlugSuggestion({
        hasInput: true,
        hasSlug: true,
        slugLength: 20,
        separator: '-',
        removeNumbers: false,
        inputLooksLikeUrl: true,
        inputLooksLikeSlug: false,
      })?.id
    ).toBe('slug-looks-url');
  });

  it('suggests when slug is empty after cleanup', () => {
    expect(
      resolveSlugSuggestion({
        hasInput: true,
        hasSlug: false,
        slugLength: 0,
        separator: '-',
        removeNumbers: true,
        inputLooksLikeUrl: false,
        inputLooksLikeSlug: false,
      })?.id
    ).toBe('slug-empty-result');
  });

  it('suggests when slug is long', () => {
    expect(
      resolveSlugSuggestion({
        hasInput: true,
        hasSlug: true,
        slugLength: SLUG_LONG_LENGTH_THRESHOLD,
        separator: '-',
        removeNumbers: false,
        inputLooksLikeUrl: false,
        inputLooksLikeSlug: false,
      })?.id
    ).toBe('slug-too-long');
  });

  it('suggests ready when slug is available', () => {
    expect(
      resolveSlugSuggestion({
        hasInput: true,
        hasSlug: true,
        slugLength: 12,
        separator: '-',
        removeNumbers: false,
        inputLooksLikeUrl: false,
        inputLooksLikeSlug: false,
      })?.id
    ).toBe('slug-ready');
  });
});
