import type { PnmlRelatedToolLink } from '../types/pnml-viewer.types';

export const PNML_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.pnml', '.xml', '.json', '.csv'];

export const PNML_ACCEPT_ATTR =
  '.pnml,.xml,.json,.csv,application/xml,text/xml,application/json,text/csv,text/plain';

export const PNML_FORMATS_LABEL = '.pnml, .xml, .json, .csv';

export const PNML_FORMATS_HINT = 'PNML Petri nets with places, transitions, and tokens. Education/research only.';

export const PNML_MAX_FILE_BYTES = 20 * 1024 * 1024;

export const PNML_RELATED_TOOLS: ReadonlyArray<PnmlRelatedToolLink> = [
  { label: 'EPC Diagram Viewer', description: 'Event-driven process chains', path: '/process-viewers/epc-diagram-viewer' },
  { label: 'Petri Net Viewer', description: 'Token-flow simulation view', path: '/process-viewers/petri-net-viewer' },
  { label: 'BPMN Viewer', description: 'Interactive process diagrams', path: '/process-viewers/bpmn-viewer' },
  { label: 'Business Process Simulator', description: 'Lightweight scenarios', path: '/process-viewers/business-process-simulator' }
];
