import type { DdRelatedToolLink } from '../shared/dd-tool-suggestion.model';

export const CORS_TEST_HISTORY_LIMIT = 10;
export const CORS_TEST_DEFAULT_URL = 'https://api.github.com';
export const CORS_TEST_DEFAULT_METHOD = 'GET';
export const CORS_TEST_DEFAULT_ACCEPT = 'application/json';

export const CORS_HTTP_METHODS: ReadonlyArray<string> = [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS'
];

export const CORS_URL_PATTERN = /^https?:\/\/.+/;

export const CORS_TEST_RELATED_TOOLS: ReadonlyArray<DdRelatedToolLink> = [
  {
    label: 'HTTP Request Generator',
    path: '/dev-design-tools/http-request-generator',
    description: 'Build fuller request snippets after you confirm CORS works'
  },
  {
    label: 'Network Speed Test',
    path: '/browser-utils/network-speed-test',
    description: 'Measure download speed once the endpoint allows cross-origin access'
  },
  {
    label: 'JSON Formatter',
    path: '/data-converters/json-formatter-beautifier-validator',
    description: 'Pretty-print and validate JSON response bodies'
  }
];
