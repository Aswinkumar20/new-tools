import type { DdRelatedToolLink } from '../shared/dd-tool-suggestion.model';

export const POSTMAN_HISTORY_LIMIT = 20;
export const POSTMAN_SAVED_LIMIT = 20;
export const POSTMAN_DEFAULT_URL = 'https://api.github.com/users/octocat';
export const POSTMAN_DEFAULT_METHOD = 'GET';
export const POSTMAN_DEFAULT_ACCEPT = 'application/json';
export const POSTMAN_URL_PATTERN = /^https?:\/\/.+/;
export const POSTMAN_SAVED_STORAGE_KEY = 'postman-lite-saved-requests';

export const POSTMAN_HTTP_METHODS: ReadonlyArray<string> = [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS'
];

export const POSTMAN_RELATED_TOOLS: ReadonlyArray<DdRelatedToolLink> = [
  {
    label: 'CORS Test Tool',
    path: '/dev-design-tools/cors-test-tool',
    description: 'Diagnose Access-Control failures when the browser blocks a call'
  },
  {
    label: 'HTTP Request Generator',
    path: '/dev-design-tools/http-request-generator',
    description: 'Turn a working request into fetch, curl, or axios snippets'
  },
  {
    label: 'HTTP Header Decoder',
    path: '/dev-design-tools/http-header-decoder',
    description: 'Categorize response headers after a successful call'
  },
  {
    label: 'JSON Formatter',
    path: '/data-converters/json-formatter-beautifier-validator',
    description: 'Pretty-print and validate JSON request or response bodies'
  }
];
