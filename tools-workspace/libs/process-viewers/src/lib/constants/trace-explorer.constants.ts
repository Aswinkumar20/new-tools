import type { TraceExplorerRelatedToolLink } from '../types/trace-explorer.types';

export const TRACE_EXPLORER_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.xes', '.xml', '.json', '.csv'];

export const TRACE_EXPLORER_ACCEPT_ATTR =
  '.xes,.xml,.json,.csv,application/xml,text/xml,application/json,text/csv,text/plain';

export const TRACE_EXPLORER_FORMATS_LABEL = '.xes, .xml, .json, .csv';

export const TRACE_EXPLORER_FORMATS_HINT = 'Case traces with paths and attributes. Education/research only.';

export const TRACE_EXPLORER_MAX_FILE_BYTES = 20 * 1024 * 1024;

export const TRACE_EXPLORER_RELATED_TOOLS: ReadonlyArray<TraceExplorerRelatedToolLink> = [
  { label: 'Event Log Viewer', description: 'Cases and activities', path: '/process-viewers/event-log-viewer' },
  { label: 'Process Timeline Viewer', description: 'Gantt-like timelines', path: '/process-viewers/process-timeline-viewer' },
  { label: 'Process Mining Viewer', description: 'Variants and DFG', path: '/process-viewers/process-mining-viewer' },
  { label: 'XES Viewer', description: 'Full XES event logs', path: '/file-viewers/xes-viewer' }
];
