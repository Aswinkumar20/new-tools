import type { TtRelatedToolLink } from '../shared/tt-tool-suggestion.model';
import type { JwtDecoderFormValues } from '../types/jwt-decoder.types';

export const JWT_DECODER_DEFAULT_FORM: JwtDecoderFormValues = {
  token: '',
  prettyPrint: true,
  showDecoded: true
};

export const JWT_DECODER_PART_COUNT_ERROR =
  'A JWT should have 2 or 3 parts separated by dots (header.payload[.signature]).';

export const JWT_DECODER_NO_SIGNATURE_WARNING =
  'No signature part present. This may be an unsecured JWT (alg: none).';

export const JWT_DECODER_RELATED_TOOLS: ReadonlyArray<TtRelatedToolLink> = [
  {
    label: 'JSON Formatter / Beautifier / Validator',
    path: '/data-converters/json-formatter-beautifier-validator',
    description: 'Pretty-print or fix JSON copied from header/payload claims'
  },
  {
    label: 'JSON Schema Validator',
    path: '/testing-tools/json-schema-validator',
    description: 'Validate decoded payloads against an API contract schema'
  },
  {
    label: 'Email / URL / IP Checker',
    path: '/testing-tools/email-url-ip-checker',
    description: 'Check email/URL claim values extracted from the payload'
  },
  {
    label: 'Hash Generator',
    path: '/security-tools/hash-generator',
    description: 'Compute digests when comparing opaque token material locally'
  }
];
