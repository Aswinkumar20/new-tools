import type { WorkflowRelatedToolLink } from '../types/workflow-diagram-viewer.types';

export const WORKFLOW_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.xml', '.wf', '.json', '.csv'];

export const WORKFLOW_ACCEPT_ATTR =
  '.xml,.wf,.json,.csv,application/xml,text/xml,application/json,text/csv,text/plain';

export const WORKFLOW_FORMATS_LABEL = '.xml, .wf, .json, .csv';

export const WORKFLOW_FORMATS_HINT = 'Generic workflow diagrams with nodes and edges. Education/research only.';

export const WORKFLOW_MAX_FILE_BYTES = 20 * 1024 * 1024;

export const WORKFLOW_RELATED_TOOLS: ReadonlyArray<WorkflowRelatedToolLink> = [
  { label: 'BPMN Viewer', description: 'Interactive process diagrams', path: '/process-viewers/bpmn-viewer' },
  { label: 'BPEL Viewer', description: 'Orchestration and partners', path: '/process-viewers/bpel-viewer' },
  { label: 'EPC Diagram Viewer', description: 'Event-driven process chains', path: '/process-viewers/epc-diagram-viewer' },
  { label: 'Process Map Viewer', description: 'Variants and frequencies', path: '/process-viewers/process-map-viewer' }
];
