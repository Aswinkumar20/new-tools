import type { BpsimRelatedToolLink } from '../types/business-process-simulator.types';

export const BPSIM_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.bpmn', '.pnml', '.xml', '.json', '.csv'];

export const BPSIM_ACCEPT_ATTR =
  '.bpmn,.pnml,.xml,.json,.csv,application/xml,text/xml,application/json,text/csv,text/plain';

export const BPSIM_FORMATS_LABEL = '.bpmn, .pnml, .xml, .json, .csv';

export const BPSIM_FORMATS_HINT = 'BPMN or PNML token scenarios. Education/research only.';

export const BPSIM_MAX_FILE_BYTES = 20 * 1024 * 1024;

export const BPSIM_RELATED_TOOLS: ReadonlyArray<BpsimRelatedToolLink> = [
  { label: 'Petri Net Viewer', description: 'Token-flow stepping', path: '/process-viewers/petri-net-viewer' },
  { label: 'PNML Viewer', description: 'Places and transitions', path: '/process-viewers/pnml-viewer' },
  { label: 'BPMN Viewer', description: 'Process diagrams', path: '/process-viewers/bpmn-viewer' },
  { label: 'Process Mining Viewer', description: 'Variants and DFG', path: '/process-viewers/process-mining-viewer' }
];
