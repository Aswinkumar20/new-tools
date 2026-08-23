import type { PetriNetRelatedToolLink } from '../types/petri-net-viewer.types';

export const PETRI_NET_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.pnml', '.xml', '.json', '.csv'];

export const PETRI_NET_ACCEPT_ATTR =
  '.pnml,.xml,.json,.csv,application/xml,text/xml,application/json,text/csv,text/plain';

export const PETRI_NET_FORMATS_LABEL = '.pnml, .xml, .json, .csv';

export const PETRI_NET_FORMATS_HINT =
  'Petri nets with graph layout and token-flow simulation. Education/research only.';

export const PETRI_NET_MAX_FILE_BYTES = 20 * 1024 * 1024;

export const PETRI_NET_RELATED_TOOLS: ReadonlyArray<PetriNetRelatedToolLink> = [
  { label: 'PNML Viewer', description: 'Places, transitions, markings', path: '/process-viewers/pnml-viewer' },
  { label: 'EPC Diagram Viewer', description: 'Event-driven process chains', path: '/process-viewers/epc-diagram-viewer' },
  { label: 'BPMN Viewer', description: 'Interactive process diagrams', path: '/process-viewers/bpmn-viewer' },
  { label: 'Business Process Simulator', description: 'Lightweight scenarios', path: '/process-viewers/business-process-simulator' }
];
