import type { DdRelatedToolLink } from '../shared/dd-tool-suggestion.model';

export const WEBSOCKET_DEFAULT_URL = 'wss://echo.websocket.events';
export const WEBSOCKET_CONNECT_TIMEOUT_MS = 10_000;
export const WEBSOCKET_MESSAGE_LIMIT = 100;
export const WEBSOCKET_URL_HISTORY_LIMIT = 10;
export const WEBSOCKET_URL_HISTORY_KEY = 'websocket-client-url-history';
export const WEBSOCKET_URL_PATTERN = /^wss?:\/\/.+/;

export const WEBSOCKET_RELATED_TOOLS: ReadonlyArray<DdRelatedToolLink> = [
  {
    label: 'Postman Lite',
    path: '/dev-design-tools/postman-lite',
    description: 'Fall back to HTTP request/response testing when sockets are not required'
  },
  {
    label: 'HTTP Request Generator',
    path: '/dev-design-tools/http-request-generator',
    description: 'Generate REST client snippets for the same API surface'
  },
  {
    label: 'JSON Formatter',
    path: '/data-converters/json-formatter-beautifier-validator',
    description: 'Pretty-print and validate JSON payloads from the message log'
  },
  {
    label: 'CORS Test Tool',
    path: '/dev-design-tools/cors-test-tool',
    description: 'Diagnose browser blocks that can also affect websocket upgrades'
  }
];
