import type { HttpTraceRelatedToolLink } from '../types/http-trace-viewer.types';

export const HTTP_TRACE_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.har', '.json', '.txt', '.http', '.trace'];

export const HTTP_TRACE_ACCEPT_ATTR =
  '.har,.json,.txt,.http,.trace,application/json,application/har+json,text/plain';

export const HTTP_TRACE_FORMATS_LABEL = '.har, .trace, .http, .json';

export const HTTP_TRACE_FORMATS_HINT =
  'HTTP conversation review: requests, responses, and paired traces. Education/research only.';

export const HTTP_TRACE_MAX_FILE_BYTES = 20 * 1024 * 1024;

export const HTTP_TRACE_RELATED_TOOLS: ReadonlyArray<HttpTraceRelatedToolLink> = [
  { label: 'HAR Viewer', description: 'Browser waterfall analysis', path: '/network-viewers/har-viewer' },
  { label: 'API Request Viewer', description: 'Bodies and headers', path: '/network-viewers/api-request-viewer' },
  { label: 'Packet Analyzer', description: 'Layer decode and hex', path: '/network-viewers/packet-analyzer' }
];
