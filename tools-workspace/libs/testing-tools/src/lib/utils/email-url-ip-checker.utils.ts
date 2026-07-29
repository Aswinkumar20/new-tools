import type { TtToolSuggestion } from '../shared/tt-tool-suggestion.model';
import {
  EMAIL_URL_IP_DISPOSABLE_DOMAINS,
  EMAIL_URL_IP_EMAIL_REGEX,
  EMAIL_URL_IP_IPV6_REGEX,
  EMAIL_URL_IP_MODE_LABELS
} from '../constants/email-url-ip-checker.constants';
import type {
  EmailUrlIpAnalysisResult,
  EmailUrlIpAnalyzeOutcome,
  EmailUrlIpCheckMode,
  EmailUrlIpFormValues,
  EmailUrlIpInfoValue,
  EmailUrlIpSuggestionContext,
  EmailUrlIpValueType
} from '../types/email-url-ip-checker.types';

export function resolveEmailUrlIpModeLabel(mode: EmailUrlIpCheckMode): string {
  return EMAIL_URL_IP_MODE_LABELS[mode];
}

export function formatEmailUrlIpInfoValue(value: EmailUrlIpInfoValue): string {
  if (value === null || value === undefined) {
    return '-';
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  return String(value);
}

export function getEmailUrlIpInfoKeys(
  info: Record<string, EmailUrlIpInfoValue>
): string[] {
  return Object.keys(info);
}

export function countEmailUrlIpTypes(
  results: EmailUrlIpAnalysisResult[]
): Record<EmailUrlIpValueType, number> {
  const counts: Record<EmailUrlIpValueType, number> = {
    email: 0,
    url: 0,
    ip: 0,
    unknown: 0
  };
  for (const result of results) {
    counts[result.type] = (counts[result.type] ?? 0) + 1;
  }
  return counts;
}

export function buildEmailUrlIpResultsSummary(results: EmailUrlIpAnalysisResult[]): string {
  return results
    .map((r, i) => {
      const status = r.valid ? 'Valid' : 'Invalid';
      const issues = r.issues.length ? ` — ${r.issues.join('; ')}` : '';
      return `#${i + 1} [${r.type}] ${status}: ${r.value}${issues}`;
    })
    .join('\n');
}

export function analyzeEmailUrlIpValues(options: EmailUrlIpFormValues): EmailUrlIpAnalyzeOutcome {
  const { input, mode, allowMultiple, ignoreEmpty } = options;
  const raw = input ?? '';

  if (!raw.trim()) {
    return {
      results: [],
      errors: ['Enter at least one value to analyze.']
    };
  }

  const values = allowMultiple ? raw.split(/\r?\n/) : [raw];
  const processed: EmailUrlIpAnalysisResult[] = [];

  for (const line of values) {
    const trimmed = line.trim();
    if (!trimmed && ignoreEmpty) {
      continue;
    }
    if (!trimmed) {
      processed.push({
        value: line,
        trimmed,
        type: 'unknown',
        modeUsed: mode,
        valid: false,
        issues: ['Empty line'],
        info: {}
      });
      continue;
    }

    processed.push(analyzeEmailUrlIpValue(trimmed, mode));
  }

  if (!processed.length) {
    return {
      results: [],
      errors: ['No non-empty values to analyze.']
    };
  }

  return { results: processed, errors: [] };
}

export function analyzeEmailUrlIpValue(
  value: string,
  mode: EmailUrlIpCheckMode
): EmailUrlIpAnalysisResult {
  const usedMode: EmailUrlIpCheckMode = mode === 'auto' ? detectEmailUrlIpMode(value) : mode;
  const issues: string[] = [];
  let type: EmailUrlIpValueType = 'unknown';
  let valid = false;
  let info: Record<string, EmailUrlIpInfoValue> = {};

  switch (usedMode) {
    case 'email': {
      const res = validateEmailValue(value);
      type = 'email';
      valid = res.valid;
      issues.push(...res.issues);
      info = res.info;
      break;
    }
    case 'url': {
      const res = validateUrlValue(value);
      type = 'url';
      valid = res.valid;
      issues.push(...res.issues);
      info = res.info;
      break;
    }
    case 'ip': {
      const res = validateIpValue(value);
      type = 'ip';
      valid = res.valid;
      issues.push(...res.issues);
      info = res.info;
      break;
    }
    default: {
      type = 'unknown';
      valid = false;
      issues.push('Could not determine value type.');
    }
  }

  return {
    value,
    trimmed: value.trim(),
    type,
    modeUsed: usedMode,
    valid,
    issues,
    info
  };
}

export function detectEmailUrlIpMode(value: string): EmailUrlIpCheckMode {
  const trimmed = value.trim();
  if (trimmed.includes('@') && /\S+@\S+\.\S+/.test(trimmed)) {
    return 'email';
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return 'url';
  }
  if (looksLikeIp(trimmed)) {
    return 'ip';
  }
  return 'auto';
}

export function validateEmailValue(value: string): {
  valid: boolean;
  issues: string[];
  info: Record<string, string | boolean | null>;
} {
  const issues: string[] = [];
  const valid = EMAIL_URL_IP_EMAIL_REGEX.test(value);
  if (!valid) {
    issues.push('Email does not match common email format.');
  }

  const [local = '', domain = ''] = value.split('@');
  const tld = domain.includes('.') ? domain.split('.').pop() ?? '' : '';
  if (!domain) {
    issues.push('Missing domain part after "@".');
  }
  if (!local) {
    issues.push('Missing local part before "@".');
  }

  const looksDisposable = EMAIL_URL_IP_DISPOSABLE_DOMAINS.includes(domain.toLowerCase());

  return {
    valid,
    issues,
    info: {
      localPart: local || null,
      domain: domain || null,
      tld: tld || null,
      isDisposableDomain: looksDisposable
    }
  };
}

export function validateUrlValue(value: string): {
  valid: boolean;
  issues: string[];
  info: Record<string, string | boolean | null>;
} {
  const issues: string[] = [];
  let url: URL | null = null;
  try {
    url = new URL(value);
  } catch {
    issues.push('Value is not a valid URL according to URL parser.');
  }

  const protocol = url?.protocol.replace(':', '') ?? '';
  const isSecure = protocol === 'https';
  if (!protocol) {
    issues.push('Missing or invalid protocol (e.g. http, https).');
  }

  const host = url?.hostname ?? '';
  if (!host) {
    issues.push('Missing hostname.');
  }

  const info: Record<string, string | boolean | null> = {
    protocol: protocol || null,
    host: host || null,
    port: url?.port || null,
    path: url?.pathname || null,
    query: url?.search || null,
    secure: isSecure
  };

  const valid = !!url && !!host && !!protocol;
  return { valid, issues, info };
}

export function validateIpValue(value: string): {
  valid: boolean;
  issues: string[];
  info: Record<string, string | boolean | null>;
} {
  const issues: string[] = [];
  const trimmed = value.trim();
  const isV4 = isValidIPv4(trimmed);
  const isV6 = !isV4 && isValidIPv6(trimmed);

  if (!isV4 && !isV6) {
    issues.push('Not a valid IPv4 or IPv6 address.');
  }

  const info: Record<string, string | boolean | null> = {
    version: isV4 ? 'IPv4' : isV6 ? 'IPv6' : null,
    isPrivate: isV4 ? isPrivateIPv4(trimmed) : null,
    isLoopback: isV4 ? trimmed === '127.0.0.1' : trimmed === '::1',
    isMulticast: isV4 ? isMulticastIPv4(trimmed) : null
  };

  return { valid: isV4 || isV6, issues, info };
}

export function looksLikeIp(value: string): boolean {
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(value) || /^[0-9a-fA-F:]+$/.test(value);
}

export function isValidIPv4(value: string): boolean {
  const parts = value.split('.');
  if (parts.length !== 4) {
    return false;
  }
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) {
      return false;
    }
    const n = Number(part);
    if (n < 0 || n > 255) {
      return false;
    }
  }
  return true;
}

export function isPrivateIPv4(value: string): boolean {
  const [a, b] = value.split('.').map((p) => Number(p));
  if (a === 10) {
    return true;
  }
  if (a === 172 && b >= 16 && b <= 31) {
    return true;
  }
  if (a === 192 && b === 168) {
    return true;
  }
  return false;
}

export function isMulticastIPv4(value: string): boolean {
  const first = Number(value.split('.')[0]);
  return first >= 224 && first <= 239;
}

export function isValidIPv6(value: string): boolean {
  return EMAIL_URL_IP_IPV6_REGEX.test(value);
}

export function resolveEmailUrlIpSuggestion(
  context: EmailUrlIpSuggestionContext
): TtToolSuggestion | null {
  const {
    hasInput,
    hasResults,
    validCount,
    invalidCount,
    typeCounts,
    results,
    errorMessage
  } = context;

  if (errorMessage) {
    return {
      id: 'eui-empty',
      title: 'Nothing to analyze yet',
      reason: errorMessage,
      actionLabel: 'Open JSON Schema Validator',
      path: '/testing-tools/json-schema-validator'
    };
  }

  if (!hasInput) {
    return {
      id: 'eui-get-started',
      title: 'Validate emails, URLs, or IPs?',
      reason:
        'Paste one value per line. Auto-detect picks the type, or lock the mode in Options.',
      actionLabel: 'Open User Agent Parser',
      path: '/testing-tools/user-agent-parser'
    };
  }

  if (!hasResults) {
    return {
      id: 'eui-ready',
      title: 'Ready to analyze',
      reason: 'Click Analyze or keep typing — results update as you change the input.',
      actionLabel: 'Open JWT Decoder',
      path: '/testing-tools/jwt-decoder'
    };
  }

  const disposable = results.some(
    (r) => r.type === 'email' && r.info['isDisposableDomain'] === true
  );
  if (disposable) {
    return {
      id: 'eui-disposable',
      title: 'Disposable email domain detected',
      reason:
        'At least one address uses a known throwaway domain. Fine for tests; avoid for production accounts.',
      actionLabel: 'Open Password Rule Validator',
      path: '/testing-tools/password-rule-validator'
    };
  }

  const insecureUrl = results.some(
    (r) => r.type === 'url' && r.valid && r.info['secure'] === false
  );
  if (insecureUrl) {
    return {
      id: 'eui-http',
      title: 'Non-HTTPS URL found',
      reason:
        'HTTP endpoints are valid structurally but may be unsafe in production. Prefer HTTPS when possible.',
      actionLabel: 'Open User Agent Parser',
      path: '/testing-tools/user-agent-parser'
    };
  }

  if (invalidCount > 0) {
    return {
      id: 'eui-invalid',
      title: `${invalidCount} invalid value${invalidCount === 1 ? '' : 's'}`,
      reason:
        'Review issues under each result. For schema-level field rules, validate the full payload next.',
      actionLabel: 'Open JSON Schema Validator',
      path: '/testing-tools/json-schema-validator'
    };
  }

  if (validCount > 0 && typeCounts.ip > 0) {
    return {
      id: 'eui-ip-ok',
      title: 'IP checks look good',
      reason:
        'Private/loopback flags are informational. Pair with User Agent Parser when debugging client connectivity.',
      actionLabel: 'Open User Agent Parser',
      path: '/testing-tools/user-agent-parser'
    };
  }

  return {
    id: 'eui-valid',
    title: 'All checked values look valid',
    reason:
      'Structure checks passed locally. Use JSON Schema Validator if these fields belong in an API contract.',
    actionLabel: 'Open JSON Schema Validator',
    path: '/testing-tools/json-schema-validator'
  };
}
