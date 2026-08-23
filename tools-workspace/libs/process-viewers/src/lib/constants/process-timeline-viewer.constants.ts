import type { ProcessTimelineRelatedToolLink } from '../types/process-timeline-viewer.types';

export const PROCESS_TIMELINE_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.xes', '.xml', '.json', '.csv'];

export const PROCESS_TIMELINE_ACCEPT_ATTR =
  '.xes,.xml,.json,.csv,application/xml,text/xml,application/json,text/csv,text/plain';

export const PROCESS_TIMELINE_FORMATS_LABEL = '.xes, .xml, .json, .csv';

export const PROCESS_TIMELINE_FORMATS_HINT = 'Process timelines with cases, resources, and timestamps. Education/research only.';

export const PROCESS_TIMELINE_MAX_FILE_BYTES = 20 * 1024 * 1024;

export const PROCESS_TIMELINE_RELATED_TOOLS: ReadonlyArray<ProcessTimelineRelatedToolLink> = [
  { label: 'Trace Explorer', description: 'Case path drill-down', path: '/process-viewers/trace-explorer' },
  { label: 'Event Log Viewer', description: 'Cases and activities', path: '/process-viewers/event-log-viewer' },
  { label: 'Process Mining Viewer', description: 'Variants and DFG', path: '/process-viewers/process-mining-viewer' },
  { label: 'Process Map Viewer', description: 'Discovered frequencies', path: '/process-viewers/process-map-viewer' }
];
