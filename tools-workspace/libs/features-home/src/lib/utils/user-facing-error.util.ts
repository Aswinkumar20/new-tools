/**
 * Maps backend / network failures to clear, action-focused messages.
 * Keeps useful validation details from the server; hides status codes and infra wording.
 */

const TECHNICAL_PATTERNS: ReadonlyArray<RegExp> = [
  /tool\s*api\s*unreachable/i,
  /start\s+services\/tool-api/i,
  /npm\s+run\s+start:api/i,
  /\bapi\s*error\s*\(\d+\)/i,
  /\bhttp\s*(error|failure)\b/i,
  /\bstatus\s*[:=]?\s*\d{3}\b/i,
  /\b(pdf|model3d)\s+backend\b/i,
  /request\s+processing\s+failed/i,
  /server\s+returned\s+invalid\s+json/i,
  /failed\s+to\s+fetch/i,
  /network\s*error/i,
  /load\s+failed/i,
  /internal\s+error/i,
  /bad\s+gateway/i,
  /service\s+unavailable/i,
  /gateway\s+timeout/i,
  /ECONNREFUSED/i,
  /ENOTFOUND/i,
  /about:blank/i,
  /ProblemDetail/i,
  /^error$/i,
  /^unknown\s+error$/i,
  /^SERVICE_UNAVAILABLE$/i,
  /^SERVICE_ERROR$/i,
  /^REQUEST_FAILED$/i,
  /^Bad Request$/i,
  /^Processing Failed$/i,
  /^Payload Too Large$/i,
];

/** True when the message looks like infra / HTTP plumbing, not a user-facing validation tip. */
export function isTechnicalApiErrorMessage(message: string | null | undefined): boolean {
  const text = (message || '').trim();
  if (!text) return true;
  if (text.length > 280) return true;
  return TECHNICAL_PATTERNS.some((re) => re.test(text));
}

export function extractErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message.trim();
  if (typeof error === 'string') return error.trim();
  return '';
}

/**
 * Prefer a concrete validation detail from the server when it is already user-friendly;
 * otherwise return {@code actionFallback} (what the user was trying to do).
 */
export function toUserFacingError(error: unknown, actionFallback: string): string {
  const fallback = (actionFallback || 'Something went wrong').trim();
  const raw = extractErrorMessage(error);
  if (!raw) return fallback;
  if (isTechnicalApiErrorMessage(raw)) return fallback;
  // Server validation / business rules — keep as-is
  return raw;
}
