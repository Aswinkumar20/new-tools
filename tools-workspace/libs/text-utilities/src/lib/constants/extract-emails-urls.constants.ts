import type { TuRelatedToolLink } from '../shared/tu-tool-suggestion.model';
import type {
  ExtractEmailsUrlsOption,
  ExtractEmailsUrlsType
} from '../types/extract-emails-urls.types';

export const EXTRACT_EMAILS_URLS_DEFAULT_TYPE: ExtractEmailsUrlsType = 'both';

export const EXTRACT_EMAILS_URLS_OPTIONS: ReadonlyArray<ExtractEmailsUrlsOption> = [
  { value: 'emails', label: 'Emails' },
  { value: 'urls', label: 'URLs' },
  { value: 'both', label: 'Both' }
];

export const EXTRACT_EMAILS_URLS_RELATED_TOOLS: ReadonlyArray<TuRelatedToolLink> = [
  {
    label: 'Email / URL / IP Checker',
    path: '/testing-tools/email-url-ip-checker',
    description: 'Validate extracted addresses and links one at a time'
  },
  {
    label: 'URL Encode & Decode',
    path: '/text-utilities/url-encode-and-decode',
    description: 'Percent-encode or decode URL strings from the results'
  },
  {
    label: 'Find and Replace',
    path: '/text-utilities/find-and-replace',
    description: 'Clean or rewrite the source text before extracting again'
  },
  {
    label: 'Sort Lines',
    path: '/text-utilities/sort-lines',
    description: 'Sort the one-per-line extraction output for review'
  }
];
