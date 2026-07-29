import {
  extractEmailsAndUrls,
  resolveExtractEmailsUrlsSuggestion
} from './extract-emails-urls.utils';
import { extractEmails, extractUrls } from '../shared/text-transform.utils';

describe('extract-emails-urls.utils', () => {
  const sample =
    'Email ada@example.com and visit https://example.com/path — also ada@example.com again.';

  it('extracts emails only', () => {
    const result = extractEmailsAndUrls(sample, 'emails');
    expect(result.emailCount).toBe(1);
    expect(result.urlCount).toBe(0);
    expect(result.outputText).toBe('ada@example.com');
    expect(result.items).toEqual(extractEmails(sample));
  });

  it('extracts urls only', () => {
    const result = extractEmailsAndUrls(sample, 'urls');
    expect(result.emailCount).toBe(0);
    expect(result.urlCount).toBe(1);
    expect(result.outputText).toBe('https://example.com/path');
    expect(result.items).toEqual(extractUrls(sample));
  });

  it('extracts both with emails listed before urls', () => {
    const result = extractEmailsAndUrls(sample, 'both');
    expect(result.emailCount).toBe(1);
    expect(result.urlCount).toBe(1);
    expect(result.outputText).toBe('ada@example.com\nhttps://example.com/path');
  });

  it('skips bare domains without a scheme', () => {
    const result = extractEmailsAndUrls('See www.example.com or example.org', 'urls');
    expect(result.items).toEqual([]);
  });

  it('resolves contextual suggestions', () => {
    expect(
      resolveExtractEmailsUrlsSuggestion({
        hasInput: false,
        extractType: 'both',
        extractedCount: 0,
        emailCount: 0,
        urlCount: 0
      })?.id
    ).toBe('eeu-get-started');

    expect(
      resolveExtractEmailsUrlsSuggestion({
        hasInput: true,
        extractType: 'both',
        extractedCount: 0,
        emailCount: 0,
        urlCount: 0
      })?.id
    ).toBe('eeu-none');

    expect(
      resolveExtractEmailsUrlsSuggestion({
        hasInput: true,
        extractType: 'both',
        extractedCount: 2,
        emailCount: 2,
        urlCount: 0
      })?.id
    ).toBe('eeu-emails-only');

    expect(
      resolveExtractEmailsUrlsSuggestion({
        hasInput: true,
        extractType: 'both',
        extractedCount: 1,
        emailCount: 0,
        urlCount: 1
      })?.id
    ).toBe('eeu-urls-only');

    expect(
      resolveExtractEmailsUrlsSuggestion({
        hasInput: true,
        extractType: 'both',
        extractedCount: 3,
        emailCount: 1,
        urlCount: 2
      })?.id
    ).toBe('eeu-found');
  });
});
