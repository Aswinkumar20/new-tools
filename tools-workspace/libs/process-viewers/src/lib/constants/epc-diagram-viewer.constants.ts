import type { EpcRelatedToolLink } from '../types/epc-diagram-viewer.types';

export const EPC_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.epc', '.xml', '.json', '.csv'];

export const EPC_ACCEPT_ATTR = '.epc,.xml,.json,.csv,application/xml,text/xml,application/json,text/csv,text/plain';

export const EPC_FORMATS_LABEL = '.epc, .xml, .json, .csv';

export const EPC_FORMATS_HINT = 'EPML / EPC event-driven process chains. Education/research only.';

export const EPC_MAX_FILE_BYTES = 20 * 1024 * 1024;

export const EPC_RELATED_TOOLS: ReadonlyArray<EpcRelatedToolLink> = [
  { label: 'PNML Viewer', description: 'Petri nets and tokens', path: '/process-viewers/pnml-viewer' },
  { label: 'BPMN Viewer', description: 'Interactive process diagrams', path: '/process-viewers/bpmn-viewer' },
  { label: 'BPMN Analytics Viewer', description: 'Bottlenecks and overlays', path: '/process-viewers/bpmn-analytics-viewer' },
  { label: 'Process Mining Viewer', description: 'Variants and DFG', path: '/process-viewers/process-mining-viewer' }
];
