import type { BpmnAnalyticsRelatedToolLink } from '../types/bpmn-analytics-viewer.types';

export const BPMN_ANALYTICS_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.json', '.bpmn', '.xml', '.csv'];

export const BPMN_ANALYTICS_ACCEPT_ATTR =
  '.json,.bpmn,.xml,.csv,application/json,application/xml,text/xml,text/csv,text/plain';

export const BPMN_ANALYTICS_FORMATS_LABEL = '.json, .bpmn, .xml, .csv';

export const BPMN_ANALYTICS_FORMATS_HINT =
  'BPMN analytics with activity frequency, wait time, and bottleneck overlays. Education/research only.';

export const BPMN_ANALYTICS_MAX_FILE_BYTES = 20 * 1024 * 1024;

export const BPMN_ANALYTICS_RELATED_TOOLS: ReadonlyArray<BpmnAnalyticsRelatedToolLink> = [
  { label: 'BPMN Viewer', description: 'Interactive process diagrams', path: '/process-viewers/bpmn-viewer' },
  { label: 'DMN Viewer', description: 'Decision tables and DRD', path: '/process-viewers/dmn-viewer' },
  { label: 'Decision Model Viewer', description: 'Logic and dependencies', path: '/process-viewers/decision-model-viewer' },
  { label: 'Process Mining Viewer', description: 'Variants and DFG', path: '/process-viewers/process-mining-viewer' },
  { label: 'Event Log Viewer', description: 'Cases and activities', path: '/process-viewers/event-log-viewer' }
];
