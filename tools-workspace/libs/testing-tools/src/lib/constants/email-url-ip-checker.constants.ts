import type { TtRelatedToolLink } from '../shared/tt-tool-suggestion.model';
import type {
  EmailUrlIpCheckMode,
  EmailUrlIpFormValues
} from '../types/email-url-ip-checker.types';

export const EMAIL_URL_IP_DEFAULT_FORM: EmailUrlIpFormValues = {
  input: '',
  mode: 'auto',
  allowMultiple: true,
  ignoreEmpty: true
};

export const EMAIL_URL_IP_MODE_LABELS: Readonly<Record<EmailUrlIpCheckMode, string>> = {
  auto: 'Auto',
  email: 'Email',
  url: 'URL',
  ip: 'IP'
};

/** Same practical RFC5322-ish pattern used by the original tool. */
export const EMAIL_URL_IP_EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z]{2,})+$/;

export const EMAIL_URL_IP_DISPOSABLE_DOMAINS: ReadonlyArray<string> = [
  'mailinator.com',
  '10minutemail.com',
  'trashmail.com'
];

export const EMAIL_URL_IP_IPV6_REGEX =
  /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|(([0-9a-fA-F]{1,4}:){1,7}:)|(([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4})|(([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2})|(([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3})|(([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4})|(([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5})|([0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6}))|(:((:[0-9a-fA-F]{1,4}){1,7}|:)))(%.+)?$/;

export const EMAIL_URL_IP_RELATED_TOOLS: ReadonlyArray<TtRelatedToolLink> = [
  {
    label: 'User Agent Parser',
    path: '/testing-tools/user-agent-parser',
    description: 'Inspect client environment when debugging URL or network issues'
  },
  {
    label: 'JWT Decoder',
    path: '/testing-tools/jwt-decoder',
    description: 'Decode tokens from auth URLs or API responses'
  },
  {
    label: 'JSON Schema Validator',
    path: '/testing-tools/json-schema-validator',
    description: 'Validate payloads that include emails, URLs, or IPs'
  },
  {
    label: 'Credit Card Validator',
    path: '/testing-tools/credit-card-validator',
    description: 'Validate payment fields in the same form-testing workflow'
  }
];
