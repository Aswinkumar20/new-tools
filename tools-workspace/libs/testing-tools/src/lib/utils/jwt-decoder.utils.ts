import type { TtToolSuggestion } from '../shared/tt-tool-suggestion.model';
import {
  JWT_DECODER_NO_SIGNATURE_WARNING,
  JWT_DECODER_PART_COUNT_ERROR
} from '../constants/jwt-decoder.constants';
import type {
  DecodedJwt,
  JwtDecodeOutcome,
  JwtDecodedSection,
  JwtPart,
  JwtSuggestionContext
} from '../types/jwt-decoder.types';

export function countJwtParts(token: string): number {
  const trimmed = token.trim();
  return trimmed ? trimmed.split('.').length : 0;
}

export function padJwtBase64(value: string): string {
  const remainder = value.length % 4;
  if (remainder === 2) return `${value}==`;
  if (remainder === 3) return `${value}=`;
  if (remainder === 1) throw new Error('Invalid base64url string length');
  return value;
}

export function decodeJwtPart(
  part: string,
  type: JwtPart,
  prettyPrint: boolean
): JwtDecodedSection {
  if (!part) {
    return {
      raw: '',
      json: null,
      error: `${type === 'header' ? 'Header' : 'Payload'} part is missing.`
    };
  }

  try {
    const padded = padJwtBase64(part.replace(/-/g, '+').replace(/_/g, '/'));
    const decoded = atob(padded);
    let json: unknown;
    try {
      json = JSON.parse(decoded);
    } catch (e) {
      return {
        raw: decoded,
        json: null,
        error: `Could not parse ${type} JSON: ${(e as Error).message}`
      };
    }

    const jsonText = prettyPrint ? JSON.stringify(json, null, 2) : JSON.stringify(json);

    return {
      raw: decoded,
      json: jsonText,
      error: null
    };
  } catch (e) {
    return {
      raw: part,
      json: null,
      error: `Failed to base64url-decode ${type}: ${(e as Error).message}`
    };
  }
}

export function decodeJwtToken(token: string, prettyPrint: boolean): JwtDecodeOutcome {
  const trimmed = token.trim();
  if (!trimmed) {
    return { decoded: null, errors: [], warnings: [] };
  }

  const errors: string[] = [];
  const warnings: string[] = [];
  const parts = trimmed.split('.');

  if (parts.length < 2 || parts.length > 3) {
    errors.push(JWT_DECODER_PART_COUNT_ERROR);
  }

  const [headerPart = '', payloadPart = '', signaturePart = ''] = parts;

  const header = decodeJwtPart(headerPart, 'header', prettyPrint);
  const payload = decodeJwtPart(payloadPart, 'payload', prettyPrint);
  const signature = {
    raw: signaturePart,
    present: !!signaturePart
  };

  const decoded: DecodedJwt = { header, payload, signature };

  if (!signaturePart) {
    warnings.push(JWT_DECODER_NO_SIGNATURE_WARNING);
  }

  return { decoded, errors, warnings };
}

export function buildDecodedJwtCopyText(decoded: DecodedJwt): string {
  return [
    '--- Header ---',
    decoded.header.json ?? decoded.header.raw,
    '',
    '--- Payload ---',
    decoded.payload.json ?? decoded.payload.raw,
    '',
    '--- Signature ---',
    decoded.signature.present ? decoded.signature.raw : '(none)'
  ].join('\n');
}

export function resolveJwtSuggestion(context: JwtSuggestionContext): TtToolSuggestion | null {
  const {
    hasToken,
    hasDecoded,
    partCount,
    errorMessage,
    warningMessage,
    headerError,
    payloadError,
    signaturePresent
  } = context;

  if (!hasToken) {
    return {
      id: 'jwt-get-started',
      title: 'Decode a JWT locally?',
      reason:
        'Paste a token to inspect header and payload. Signatures are shown but never verified here.',
      actionLabel: 'Open JSON Schema Validator',
      path: '/testing-tools/json-schema-validator'
    };
  }

  if (errorMessage === JWT_DECODER_PART_COUNT_ERROR || partCount < 2 || partCount > 3) {
    return {
      id: 'jwt-parts',
      title: 'Unexpected JWT structure',
      reason:
        'A JWT is usually header.payload.signature (2–3 base64url segments). Check for missing dots or extra text.',
      actionLabel: 'Open JSON Formatter',
      path: '/data-converters/json-formatter-beautifier-validator'
    };
  }

  if (headerError || payloadError) {
    return {
      id: 'jwt-decode-error',
      title: 'Could not decode a JWT segment',
      reason:
        headerError ||
        payloadError ||
        'Base64url or JSON parsing failed for header/payload. Confirm the token was copied completely.',
      actionLabel: 'Open JSON Formatter',
      path: '/data-converters/json-formatter-beautifier-validator'
    };
  }

  if (warningMessage === JWT_DECODER_NO_SIGNATURE_WARNING || (hasDecoded && !signaturePresent)) {
    return {
      id: 'jwt-unsigned',
      title: 'No signature segment',
      reason:
        'This may be an unsecured JWT (alg: none). Treat claims as untrusted unless verified elsewhere.',
      actionLabel: 'Open Hash Generator',
      path: '/security-tools/hash-generator'
    };
  }

  if (hasDecoded) {
    return {
      id: 'jwt-decoded',
      title: 'Token decoded',
      reason:
        'Inspect claims carefully. Validate payload shape with JSON Schema, or check email/URL claim values next.',
      actionLabel: 'Open JSON Schema Validator',
      path: '/testing-tools/json-schema-validator'
    };
  }

  return {
    id: 'jwt-ready',
    title: 'Ready to decode',
    reason: 'Click Decode or keep typing — results update as the token changes.',
    actionLabel: 'Open Email / URL / IP Checker',
    path: '/testing-tools/email-url-ip-checker'
  };
}
