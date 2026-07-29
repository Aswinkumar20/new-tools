import type { BuRelatedToolLink } from '../shared/bu-tool-suggestion.model';
import type { CookieFormValues, CookieSameSite } from '../types/cookie-editor.types';

export const COOKIE_VALUE_PREVIEW_MAX_LENGTH = 100;

export const COOKIE_DEFAULT_FORM_VALUES: CookieFormValues = {
  name: '',
  value: '',
  domain: '',
  path: '/',
  daysToExpire: 7,
  secure: false,
  sameSite: 'Lax'
};

export const COOKIE_SAME_SITE_OPTIONS: ReadonlyArray<CookieSameSite> = ['Lax', 'Strict', 'None'];

export const COOKIE_RELATED_TOOLS: ReadonlyArray<BuRelatedToolLink> = [
  {
    label: 'Storage Viewer',
    path: '/browser-utils/storage-viewer',
    description: 'Inspect localStorage and sessionStorage'
  },
  {
    label: 'User Agent Parser',
    path: '/testing-tools/user-agent-parser',
    description: 'Confirm browser and client profile'
  },
  {
    label: 'JWT Decoder',
    path: '/testing-tools/jwt-decoder',
    description: 'Decode token-like cookie values'
  },
  {
    label: 'Base64 Encode / Decode',
    path: '/text-utilities/base64-encode-and-decode',
    description: 'Decode encoded cookie payloads'
  }
];
