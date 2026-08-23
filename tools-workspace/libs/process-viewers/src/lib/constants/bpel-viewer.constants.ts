import type { BpelRelatedToolLink } from '../types/bpel-viewer.types';

export const BPEL_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.bpel', '.xml', '.json', '.csv'];

export const BPEL_ACCEPT_ATTR = '.bpel,.xml,.json,.csv,application/xml,text/xml,application/json,text/csv,text/plain';

export const BPEL_FORMATS_LABEL = '.bpel, .xml, .json, .csv';

export const BPEL_FORMATS_HINT = 'WS-BPEL 2.0 orchestration with partner links. Education/research only.';

export const BPEL_MAX_FILE_BYTES = 20 * 1024 * 1024;

export const BPEL_RELATED_TOOLS: ReadonlyArray<BpelRelatedToolLink> = [
  { label: 'BPMN Viewer', description: 'Interactive process diagrams', path: '/process-viewers/bpmn-viewer' },
  { label: 'Petri Net Viewer', description: 'Token-flow simulation', path: '/process-viewers/petri-net-viewer' },
  { label: 'DMN Viewer', description: 'Decision tables and DRD', path: '/process-viewers/dmn-viewer' },
  { label: 'Workflow Diagram Viewer', description: 'Generic workflow graphs', path: '/process-viewers/workflow-diagram-viewer' }
];
