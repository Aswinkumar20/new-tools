import type { BuToolSuggestion } from '../shared/bu-tool-suggestion.model';
import { COOKIE_VALUE_PREVIEW_MAX_LENGTH } from '../constants/cookie-editor.constants';
import type { CookieEntry, CookieFormValues } from '../types/cookie-editor.types';

const JWT_LIKE_PATTERN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const BASE64_LIKE_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

export function parseDocumentCookies(cookieHeader: string | undefined | null): CookieEntry[] {
  if (!cookieHeader) {
    return [];
  }

  const entries: CookieEntry[] = [];
  for (const cookieStr of cookieHeader.split(';')) {
    const trimmed = cookieStr.trim();
    if (!trimmed) continue;

    const equalIndex = trimmed.indexOf('=');
    if (equalIndex === -1) continue;

    const rawName = trimmed.substring(0, equalIndex).trim();
    const rawValue = trimmed.substring(equalIndex + 1).trim();

    try {
      entries.push({
        name: decodeURIComponent(rawName),
        value: decodeURIComponent(rawValue)
      });
    } catch {
      entries.push({
        name: rawName,
        value: rawValue
      });
    }
  }

  return entries;
}

export function filterCookieEntries(entries: CookieEntry[], query: string): CookieEntry[] {
  const normalizedQuery = query.toLowerCase().trim();
  if (!normalizedQuery) {
    return entries;
  }

  return entries.filter(
    (cookie) =>
      cookie.name.toLowerCase().includes(normalizedQuery) ||
      cookie.value.toLowerCase().includes(normalizedQuery)
  );
}

export function formatCookieValuePreview(
  value: string,
  maxLength = COOKIE_VALUE_PREVIEW_MAX_LENGTH
): string {
  if (value.length > maxLength) {
    return `${value.substring(0, maxLength)}...`;
  }
  return value;
}

export function buildCookieSetString(values: CookieFormValues): string {
  const parts: string[] = [
    `${encodeURIComponent(values.name.trim())}=${encodeURIComponent(values.value)}`
  ];

  if (values.domain.trim()) {
    parts.push(`Domain=${values.domain.trim()}`);
  }

  if (values.path.trim()) {
    parts.push(`Path=${values.path.trim()}`);
  }

  if (values.daysToExpire !== null && Number.isFinite(values.daysToExpire) && values.daysToExpire > 0) {
    const date = new Date();
    date.setTime(date.getTime() + values.daysToExpire * 24 * 60 * 60 * 1000);
    parts.push(`Expires=${date.toUTCString()}`);
  }

  if (values.secure) {
    parts.push('Secure');
  }

  if (values.sameSite) {
    parts.push(`SameSite=${values.sameSite}`);
  }

  return parts.join('; ');
}

export function buildCookieDeleteString(
  name: string,
  path: string,
  domain: string
): string {
  const parts: string[] = [
    `${encodeURIComponent(name)}=`,
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT'
  ];

  if (path) {
    parts.push(`Path=${path}`);
  }
  if (domain) {
    parts.push(`Domain=${domain}`);
  }

  return parts.join('; ');
}

export function serializeCookieLine(cookie: CookieEntry): string {
  return `${cookie.name}=${cookie.value}`;
}

export function serializeAllCookies(entries: CookieEntry[]): string {
  return entries.map((cookie) => serializeCookieLine(cookie)).join('\n');
}

export function looksLikeJwt(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length > 20 && JWT_LIKE_PATTERN.test(trimmed);
}

export function looksLikeBase64(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length >= 16 && trimmed.length % 4 === 0 && BASE64_LIKE_PATTERN.test(trimmed);
}

export function resolveCookieSuggestion(
  formValues: Pick<CookieFormValues, 'sameSite' | 'secure' | 'value'>,
  cookieCount: number
): BuToolSuggestion | null {
  if (looksLikeJwt(formValues.value)) {
    return {
      id: 'jwt-cookie-value',
      title: 'Cookie value looks like a JWT',
      reason:
        'This value appears to be a three-part token. Decode it in JWT Decoder to inspect claims without leaving EasyToolHub.',
      actionLabel: 'Open JWT Decoder',
      path: '/testing-tools/jwt-decoder'
    };
  }

  if (looksLikeBase64(formValues.value) && !looksLikeJwt(formValues.value)) {
    return {
      id: 'base64-cookie-value',
      title: 'Cookie value looks Base64 encoded',
      reason:
        'Decode the payload first if you need to inspect structured data stored in this cookie.',
      actionLabel: 'Open Base64 Encode / Decode',
      path: '/text-utilities/base64-encode-and-decode'
    };
  }

  if (cookieCount === 0) {
    return {
      id: 'empty-try-storage',
      title: 'No cookies on this domain yet',
      reason:
        'If the app stores data in Web Storage instead, Storage Viewer can inspect localStorage and sessionStorage next.',
      actionLabel: 'Open Storage Viewer',
      path: '/browser-utils/storage-viewer'
    };
  }

  return {
    id: 'pair-with-storage',
    title: 'Continue client-state inspection',
    reason:
      'Cookies are only part of browser state. Pair this editor with Storage Viewer for a full local persistence check.',
    actionLabel: 'Open Storage Viewer',
    path: '/browser-utils/storage-viewer'
  };
}
