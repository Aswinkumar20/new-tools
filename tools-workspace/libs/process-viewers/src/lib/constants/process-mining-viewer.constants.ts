import type { ProcessMiningRelatedToolLink } from '../types/process-mining-viewer.types';

export const PROCESS_MINING_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.xes', '.xml', '.json', '.csv'];

export const PROCESS_MINING_ACCEPT_ATTR =
  '.xes,.xml,.json,.csv,application/xml,text/xml,application/json,text/csv,text/plain';

export const PROCESS_MINING_FORMATS_LABEL = '.xes, .xml, .json, .csv';

export const PROCESS_MINING_FORMATS_HINT =
  'Event logs and mined maps with variants and DFG. Education/research only.';

export const PROCESS_MINING_MAX_FILE_BYTES = 20 * 1024 * 1024;

export const PROCESS_MINING_RELATED_TOOLS: ReadonlyArray<ProcessMiningRelatedToolLink> = [
  { label: 'Event Log Viewer', description: 'Cases and activities', path: '/process-viewers/event-log-viewer' },
  { label: 'Process Map Viewer', description: 'Discovered frequencies', path: '/process-viewers/process-map-viewer' },
  { label: 'XES Viewer', description: 'Full XES event logs', path: '/file-viewers/xes-viewer' },
  { label: 'Trace Explorer', description: 'Case path drill-down', path: '/process-viewers/trace-explorer' }
];
