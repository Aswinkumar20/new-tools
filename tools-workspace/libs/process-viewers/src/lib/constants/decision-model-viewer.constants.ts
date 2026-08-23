import type { DecisionModelRelatedToolLink } from '../types/decision-model-viewer.types';

export const DECISION_MODEL_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.json', '.dmn', '.xml', '.csv'];

export const DECISION_MODEL_ACCEPT_ATTR =
  '.json,.dmn,.xml,.csv,application/json,application/xml,text/xml,text/csv,text/plain';

export const DECISION_MODEL_FORMATS_LABEL = '.json, .dmn, .xml, .csv';

export const DECISION_MODEL_FORMATS_HINT =
  'Decision models with tables, rules, and dependency graphs. Education/research only.';

export const DECISION_MODEL_MAX_FILE_BYTES = 20 * 1024 * 1024;

export const DECISION_MODEL_RELATED_TOOLS: ReadonlyArray<DecisionModelRelatedToolLink> = [
  { label: 'DMN Viewer', description: 'Decision tables and DRD', path: '/process-viewers/dmn-viewer' },
  { label: 'BPMN Viewer', description: 'Interactive process diagrams', path: '/process-viewers/bpmn-viewer' },
  { label: 'BPMN Analytics Viewer', description: 'Bottlenecks and overlays', path: '/process-viewers/bpmn-analytics-viewer' },
  { label: 'Process Mining Viewer', description: 'Variants and DFG', path: '/process-viewers/process-mining-viewer' }
];
