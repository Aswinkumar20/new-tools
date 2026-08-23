import type { ProcessMapRelatedToolLink } from '../types/process-map-viewer.types';

export const PROCESS_MAP_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.json', '.xml', '.csv'];

export const PROCESS_MAP_ACCEPT_ATTR =
  '.json,.xml,.csv,application/json,application/xml,text/xml,text/csv,text/plain';

export const PROCESS_MAP_FORMATS_LABEL = '.json, .xml, .csv';

export const PROCESS_MAP_FORMATS_HINT =
  'Discovered process maps with variants and activity frequencies. Education/research only.';

export const PROCESS_MAP_MAX_FILE_BYTES = 20 * 1024 * 1024;

export const PROCESS_MAP_RELATED_TOOLS: ReadonlyArray<ProcessMapRelatedToolLink> = [
  { label: 'Process Mining Viewer', description: 'Variants and DFG', path: '/process-viewers/process-mining-viewer' },
  { label: 'Event Log Viewer', description: 'Cases and activities', path: '/process-viewers/event-log-viewer' },
  { label: 'BPMN Analytics Viewer', description: 'Bottlenecks and overlays', path: '/process-viewers/bpmn-analytics-viewer' },
  { label: 'Workflow Diagram Viewer', description: 'Generic workflow graphs', path: '/process-viewers/workflow-diagram-viewer' }
];
