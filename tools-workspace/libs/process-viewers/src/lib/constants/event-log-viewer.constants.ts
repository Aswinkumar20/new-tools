import type { EventLogRelatedToolLink } from '../types/event-log-viewer.types';

export const EVENT_LOG_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.xes', '.xml', '.json', '.csv'];

export const EVENT_LOG_ACCEPT_ATTR =
  '.xes,.xml,.json,.csv,application/xml,text/xml,application/json,text/csv,text/plain';

export const EVENT_LOG_FORMATS_LABEL = '.xes, .xml, .json, .csv';

export const EVENT_LOG_FORMATS_HINT = 'Process event logs with cases, activities, and timestamps. Education/research only.';

export const EVENT_LOG_MAX_FILE_BYTES = 20 * 1024 * 1024;

export const EVENT_LOG_RELATED_TOOLS: ReadonlyArray<EventLogRelatedToolLink> = [
  { label: 'Process Mining Viewer', description: 'Variants and DFG', path: '/process-viewers/process-mining-viewer' },
  { label: 'Trace Explorer', description: 'Case path drill-down', path: '/process-viewers/trace-explorer' },
  { label: 'Process Timeline Viewer', description: 'Gantt-like timelines', path: '/process-viewers/process-timeline-viewer' },
  { label: 'XES Viewer', description: 'Full XES event logs', path: '/file-viewers/xes-viewer' }
];
