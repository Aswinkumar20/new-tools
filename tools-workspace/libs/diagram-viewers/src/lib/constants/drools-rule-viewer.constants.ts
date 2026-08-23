import type { DrlRelatedToolLink } from '../types/drools-rule-viewer.types';

export const DRL_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.drl', '.xml', '.json', '.md', '.txt'];

export const DRL_ACCEPT_ATTR =
  '.drl,.xml,.json,.md,.txt,text/plain,text/markdown,application/json,application/xml,text/xml';

export const DRL_FORMATS_LABEL = '.drl, .xml, .json, .md, .txt';

export const DRL_FORMATS_HINT = 'Drools .drl rules and conditions. Education/research only.';

export const DRL_MAX_FILE_BYTES = 20 * 1024 * 1024;

export const DRL_RELATED_TOOLS: ReadonlyArray<DrlRelatedToolLink> = [
  { label: 'Decision Tree Viewer', description: 'Branches and leaves', path: '/diagram-viewers/decision-tree-viewer' },
  { label: 'State Machine Viewer', description: 'SCXML / FSM', path: '/diagram-viewers/state-machine-viewer' },
  { label: 'DMN Viewer', description: 'Decision tables', path: '/process-viewers/dmn-viewer' },
  { label: 'Decision Model Viewer', description: 'Decision models', path: '/process-viewers/decision-model-viewer' }
];
