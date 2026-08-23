import type { DdRelatedToolLink } from '../shared/dd-tool-suggestion.model';
import type { HeaderCategory } from '../types/http-header-decoder.types';

export const HTTP_HEADER_HISTORY_LIMIT = 10;

export const HTTP_HEADER_SAMPLE = `date: Tue, 09 Aug 2026 12:00:00 GMT
content-type: application/json; charset=utf-8
content-length: 312
server: GitHub.com
x-github-media-type: github.v3; format=json
access-control-allow-origin: *
access-control-expose-headers: ETag, Link, X-GitHub-Request-Id
cache-control: public, max-age=60, s-maxage=60
etag: W/"abc123"
`;

export const HTTP_HEADER_DESCRIPTIONS: Readonly<Record<string, string>> = {
  'content-type': 'Specifies the media type of the resource',
  'content-length': 'Indicates the size of the entity-body',
  'content-encoding': 'Specifies what content codings have been applied',
  'content-language': 'Describes the natural language(s) of the intended audience',
  'content-location': 'Indicates an alternate location for the returned entity',
  'content-disposition': 'Indicates how the content should be displayed',
  accept: 'Specifies which content types the client can understand',
  'accept-encoding': 'Specifies which content encodings the client can understand',
  'accept-language': 'Specifies which languages the client can understand',
  authorization: 'Contains credentials for authenticating the client',
  'cache-control': 'Specifies directives for caching mechanisms',
  connection: 'Controls whether the network connection stays open',
  cookie: 'Contains stored HTTP cookies',
  date: 'The date and time at which the message was originated',
  etag: 'Entity tag for the requested variant',
  expires: 'Gives the date/time after which the response is considered stale',
  host: 'Specifies the domain name of the server',
  'if-modified-since': 'Makes the request conditional',
  'if-none-match': 'Makes the request conditional',
  'last-modified': 'The date and time at which the origin server believes the variant was last modified',
  location: 'Used in redirection, or when a new resource has been created',
  referer: 'The address of the previous web page',
  server: 'Contains information about the software used by the origin server',
  'set-cookie': 'Sends cookies from the server to the user agent',
  'user-agent': 'Contains a characteristic string that allows the network protocol peers to identify the application',
  'x-forwarded-for': 'Identifies the originating IP address of a client',
  'x-forwarded-proto': 'Identifies the protocol (HTTP or HTTPS)',
  'x-real-ip': 'Identifies the real IP address of the client',
  'access-control-allow-origin': 'Specifies which origins can access the resource',
  'access-control-allow-methods': 'Specifies the methods allowed when accessing the resource',
  'access-control-allow-headers': 'Specifies which headers can be used during the request',
  'access-control-expose-headers': 'Specifies which headers can be exposed to the client',
  'access-control-max-age': 'Indicates how long the results of a preflight request can be cached',
  'access-control-allow-credentials': 'Indicates whether the response can be shared with credentials'
};

export const ENTITY_HEADER_KEYS = [
  'content-type',
  'content-length',
  'content-encoding',
  'content-language',
  'content-location',
  'content-disposition'
] as const;

export const REQUEST_HEADER_KEYS = [
  'accept',
  'accept-encoding',
  'accept-language',
  'authorization',
  'cookie',
  'host',
  'referer',
  'user-agent'
] as const;

export const RESPONSE_HEADER_KEYS = [
  'cache-control',
  'connection',
  'date',
  'etag',
  'expires',
  'last-modified',
  'location',
  'server',
  'set-cookie'
] as const;

export const GENERAL_HEADER_KEYS = [
  'connection',
  'date',
  'pragma',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'via',
  'warning'
] as const;

export const HEADER_CATEGORY_LABELS: Readonly<Record<HeaderCategory, string>> = {
  general: 'General',
  request: 'Request',
  response: 'Response',
  entity: 'Entity',
  cors: 'CORS',
  custom: 'Custom'
};

export const HEADER_CATEGORY_COLORS: Readonly<Record<HeaderCategory, string>> = {
  general: '#6b7280',
  request: '#007bff',
  response: '#28a745',
  entity: '#ffc107',
  cors: '#dc3545',
  custom: '#9ca3af'
};

export const HTTP_HEADER_RELATED_TOOLS: ReadonlyArray<DdRelatedToolLink> = [
  {
    label: 'CORS Test Tool',
    path: '/dev-design-tools/cors-test-tool',
    description: 'Verify Access-Control headers against a live origin'
  },
  {
    label: 'HTTP Request Generator',
    path: '/dev-design-tools/http-request-generator',
    description: 'Turn decoded headers into a reusable request snippet'
  },
  {
    label: 'JWT Decoder',
    path: '/testing-tools/jwt-decoder',
    description: 'Inspect Bearer tokens found in Authorization headers'
  }
];
