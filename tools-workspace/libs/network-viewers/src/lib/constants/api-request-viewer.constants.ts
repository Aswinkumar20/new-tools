import type { ApiRequestRelatedToolLink } from '../types/api-request-viewer.types';

export const API_REQUEST_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.json', '.har', '.http', '.txt'];

export const API_REQUEST_ACCEPT_ATTR =
  '.json,.har,.http,.txt,application/json,application/har+json,text/plain';

export const API_REQUEST_FORMATS_LABEL = '.json, .har, .http';

export const API_REQUEST_FORMATS_HINT =
  'API call inspection with headers, query params, and pretty-printed bodies. Education/research only.';

export const API_REQUEST_MAX_FILE_BYTES = 20 * 1024 * 1024;

export const API_REQUEST_RELATED_TOOLS: ReadonlyArray<ApiRequestRelatedToolLink> = [
  { label: 'HTTP Trace Viewer', description: 'Request/response conversations', path: '/network-viewers/http-trace-viewer' },
  { label: 'HAR Viewer', description: 'Browser waterfall analysis', path: '/network-viewers/har-viewer' },
  { label: 'Protocol Analyzer', description: 'Protocol-centric dissectors', path: '/network-viewers/protocol-analyzer' }
];
