import type { TuToolSuggestion } from '../shared/tu-tool-suggestion.model';
import { extractEmails, extractUrls } from '../shared/text-transform.utils';
import type {
  ExtractEmailsUrlsResult,
  ExtractEmailsUrlsSuggestionContext,
  ExtractEmailsUrlsType
} from '../types/extract-emails-urls.types';

export function extractEmailsAndUrls(
  text: string,
  extractType: ExtractEmailsUrlsType
): ExtractEmailsUrlsResult {
  const emails = extractType !== 'urls' ? extractEmails(text) : [];
  const urls = extractType !== 'emails' ? extractUrls(text) : [];
  const items = [...emails, ...urls];
  return {
    items,
    emailCount: emails.length,
    urlCount: urls.length,
    outputText: items.join('\n')
  };
}

export function resolveExtractEmailsUrlsSuggestion(
  context: ExtractEmailsUrlsSuggestionContext
): TuToolSuggestion | null {
  const { hasInput, extractType, extractedCount, emailCount, urlCount } = context;

  if (!hasInput) {
    return {
      id: 'eeu-get-started',
      title: 'Extract emails or URLs?',
      reason:
        'Paste any text block — matches are deduplicated and listed one per line. URLs need http:// or https://.',
      actionLabel: 'Open Email / URL / IP Checker',
      path: '/testing-tools/email-url-ip-checker'
    };
  }

  if (extractedCount === 0) {
    return {
      id: 'eeu-none',
      title: 'No matches for the selected type',
      reason:
        extractType === 'emails'
          ? 'No email-shaped tokens found. Try Both, or check the source for obfuscated addresses.'
          : extractType === 'urls'
            ? 'No http(s) URLs found. Bare domains without a scheme are skipped by design.'
            : 'No emails or http(s) URLs found. Confirm the paste includes full addresses or links.',
      actionLabel: 'Open Find and Replace',
      path: '/text-utilities/find-and-replace'
    };
  }

  if (extractType === 'both' && emailCount > 0 && urlCount === 0) {
    return {
      id: 'eeu-emails-only',
      title: 'Emails found — no URLs',
      reason:
        'Validate addresses next, or switch to Emails-only mode if you want a cleaner list.',
      actionLabel: 'Open Email / URL / IP Checker',
      path: '/testing-tools/email-url-ip-checker'
    };
  }

  if (extractType === 'both' && urlCount > 0 && emailCount === 0) {
    return {
      id: 'eeu-urls-only',
      title: 'URLs found — no emails',
      reason:
        'Validate or percent-encode links next. Switch to URLs-only if you do not need email scanning.',
      actionLabel: 'Open URL Encode & Decode',
      path: '/text-utilities/url-encode-and-decode'
    };
  }

  return {
    id: 'eeu-found',
    title: `${extractedCount} item${extractedCount === 1 ? '' : 's'} extracted`,
    reason:
      'Copy or download the list, then validate entries or sort lines for easier review.',
    actionLabel: 'Open Email / URL / IP Checker',
    path: '/testing-tools/email-url-ip-checker'
  };
}
