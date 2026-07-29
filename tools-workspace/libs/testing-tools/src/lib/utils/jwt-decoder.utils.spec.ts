import {
  buildDecodedJwtCopyText,
  countJwtParts,
  decodeJwtToken,
  padJwtBase64,
  resolveJwtSuggestion
} from './jwt-decoder.utils';
import {
  JWT_DECODER_NO_SIGNATURE_WARNING,
  JWT_DECODER_PART_COUNT_ERROR
} from '../constants/jwt-decoder.constants';

/** Classic jwt.io sample token (HS256). */
const SAMPLE_JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

describe('jwt-decoder.utils', () => {
  it('counts JWT parts', () => {
    expect(countJwtParts('')).toBe(0);
    expect(countJwtParts('a.b')).toBe(2);
    expect(countJwtParts(SAMPLE_JWT)).toBe(3);
  });

  it('pads base64url lengths', () => {
    expect(padJwtBase64('ab')).toBe('ab==');
    expect(padJwtBase64('abc')).toBe('abc=');
    expect(padJwtBase64('abcd')).toBe('abcd');
    expect(() => padJwtBase64('a')).toThrow('Invalid base64url string length');
  });

  it('decodes a signed JWT with pretty print', () => {
    const { decoded, errors, warnings } = decodeJwtToken(SAMPLE_JWT, true);
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
    expect(decoded?.signature.present).toBe(true);
    expect(decoded?.header.json).toContain('\n');
    expect(decoded?.header.json).toContain('"alg"');
    expect(decoded?.payload.json).toContain('"sub"');
  });

  it('decodes compact JSON when pretty print is off', () => {
    const { decoded } = decodeJwtToken(SAMPLE_JWT, false);
    expect(decoded?.header.json).toBe('{"alg":"HS256","typ":"JWT"}');
  });

  it('warns when signature is missing but still decodes', () => {
    const unsigned = SAMPLE_JWT.split('.').slice(0, 2).join('.');
    const { decoded, errors, warnings } = decodeJwtToken(unsigned, true);
    expect(errors).toEqual([]);
    expect(warnings).toEqual([JWT_DECODER_NO_SIGNATURE_WARNING]);
    expect(decoded?.signature.present).toBe(false);
    expect(decoded?.header.error).toBeNull();
    expect(decoded?.payload.error).toBeNull();
  });

  it('records part-count error and still attempts decode', () => {
    const { decoded, errors } = decodeJwtToken('only-one-part', true);
    expect(errors).toEqual([JWT_DECODER_PART_COUNT_ERROR]);
    expect(decoded).not.toBeNull();
    expect(decoded?.header.error).toContain('Failed to base64url-decode');
  });

  it('builds copy text for decoded sections', () => {
    const { decoded } = decodeJwtToken(SAMPLE_JWT, false);
    expect(decoded).not.toBeNull();
    if (!decoded) return;
    const text = buildDecodedJwtCopyText(decoded);
    expect(text).toContain('--- Header ---');
    expect(text).toContain('--- Payload ---');
    expect(text).toContain('--- Signature ---');
    expect(text).toContain(decoded.signature.raw);
  });

  it('resolves contextual suggestions', () => {
    expect(
      resolveJwtSuggestion({
        hasToken: false,
        hasDecoded: false,
        partCount: 0,
        errorMessage: null,
        warningMessage: null,
        headerError: null,
        payloadError: null,
        signaturePresent: false
      })?.id
    ).toBe('jwt-get-started');

    expect(
      resolveJwtSuggestion({
        hasToken: true,
        hasDecoded: true,
        partCount: 1,
        errorMessage: JWT_DECODER_PART_COUNT_ERROR,
        warningMessage: null,
        headerError: null,
        payloadError: null,
        signaturePresent: false
      })?.id
    ).toBe('jwt-parts');

    expect(
      resolveJwtSuggestion({
        hasToken: true,
        hasDecoded: true,
        partCount: 3,
        errorMessage: null,
        warningMessage: null,
        headerError: 'Failed to base64url-decode header',
        payloadError: null,
        signaturePresent: true
      })?.id
    ).toBe('jwt-decode-error');

    expect(
      resolveJwtSuggestion({
        hasToken: true,
        hasDecoded: true,
        partCount: 2,
        errorMessage: null,
        warningMessage: JWT_DECODER_NO_SIGNATURE_WARNING,
        headerError: null,
        payloadError: null,
        signaturePresent: false
      })?.id
    ).toBe('jwt-unsigned');

    expect(
      resolveJwtSuggestion({
        hasToken: true,
        hasDecoded: true,
        partCount: 3,
        errorMessage: null,
        warningMessage: null,
        headerError: null,
        payloadError: null,
        signaturePresent: true
      })?.id
    ).toBe('jwt-decoded');
  });
});
