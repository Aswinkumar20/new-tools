import type { HarRelatedToolLink } from '../types/har-viewer.types';

export const HAR_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.har', '.json'];

export const HAR_ACCEPT_ATTR = '.har,.json,application/json,application/har+json';

export const HAR_FORMATS_LABEL = '.har (HTTP Archive 1.2)';

export const HAR_FORMATS_HINT =
  'HAR 1.1/1.2 browser captures with waterfall, headers, and timing breakdown. Education/research only.';

export const HAR_MAX_FILE_BYTES = 20 * 1024 * 1024;

export const HAR_MAX_ENTRIES = 5000;

export const HAR_RELATED_TOOLS: ReadonlyArray<HarRelatedToolLink> = [
  { label: 'PCAP Viewer', description: 'Packet timeline and decode', path: '/network-viewers/pcap-viewer' },
  { label: 'HTTP Trace Viewer', description: 'HTTP conversation review', path: '/network-viewers/http-trace-viewer' },
  { label: 'API Request Viewer', description: 'API call inspection', path: '/network-viewers/api-request-viewer' }
];
