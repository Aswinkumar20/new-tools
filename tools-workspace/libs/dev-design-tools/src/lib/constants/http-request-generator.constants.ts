import type { DdRelatedToolLink } from '../shared/dd-tool-suggestion.model';
import type { HttpRequestCodeFormatOption } from '../types/http-request-generator.types';

export const HTTP_REQUEST_HISTORY_LIMIT = 10;
export const HTTP_REQUEST_DEFAULT_URL = 'https://api.github.com/users/octocat';
export const HTTP_REQUEST_DEFAULT_METHOD = 'GET';
export const HTTP_REQUEST_DEFAULT_FORMAT = 'fetch';
export const HTTP_REQUEST_DEFAULT_CONTENT_TYPE = 'application/json';
export const HTTP_REQUEST_URL_PATTERN = /^https?:\/\/.+/;
export const HTTP_REQUEST_URL_PATTERN_LOOSE = /^https?:\/\/.+/i;

export const HTTP_REQUEST_METHODS: ReadonlyArray<string> = [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS'
];

export const HTTP_REQUEST_CODE_FORMATS: ReadonlyArray<HttpRequestCodeFormatOption> = [
  { value: 'fetch', label: 'JavaScript (Fetch API)' },
  { value: 'axios', label: 'JavaScript (Axios)' },
  { value: 'curl', label: 'cURL' },
  { value: 'python', label: 'Python (requests)' },
  { value: 'node', label: 'Node.js (http)' },
  { value: 'php', label: 'PHP (cURL)' }
];

export const HTTP_REQUEST_RELATED_TOOLS: ReadonlyArray<DdRelatedToolLink> = [
  {
    label: 'CORS Test Tool',
    path: '/dev-design-tools/cors-test-tool',
    description: 'Verify the target URL allows browser cross-origin calls'
  },
  {
    label: 'HTTP Header Decoder',
    path: '/dev-design-tools/http-header-decoder',
    description: 'Inspect and categorize request headers before generating code'
  },
  {
    label: 'WebSocket Client',
    path: '/dev-design-tools/websocket-client',
    description: 'Switch to realtime sockets when REST is not enough'
  }
];
