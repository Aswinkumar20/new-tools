import type { DmnRelatedToolLink } from '../types/dmn-viewer.types';

export const DMN_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.dmn', '.xml', '.json', '.csv'];

export const DMN_ACCEPT_ATTR = '.dmn,.xml,.json,.csv,application/xml,text/xml,application/json,text/csv,text/plain';

export const DMN_FORMATS_LABEL = '.dmn, .xml, .json, .csv';

export const DMN_FORMATS_HINT =
  'DMN 1.3 decision tables and DRD graphs. Education/research only.';

export const DMN_MAX_FILE_BYTES = 20 * 1024 * 1024;

export const DMN_RELATED_TOOLS: ReadonlyArray<DmnRelatedToolLink> = [
  { label: 'Decision Model Viewer', description: 'Logic and dependencies', path: '/process-viewers/decision-model-viewer' },
  { label: 'BPMN Viewer', description: 'Interactive process diagrams', path: '/process-viewers/bpmn-viewer' },
  { label: 'BPMN Analytics Viewer', description: 'Bottlenecks and overlays', path: '/process-viewers/bpmn-analytics-viewer' },
  { label: 'Event Log Viewer', description: 'Cases and activities', path: '/process-viewers/event-log-viewer' }
];
