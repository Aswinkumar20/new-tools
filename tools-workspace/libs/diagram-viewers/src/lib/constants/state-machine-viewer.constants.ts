import type { SmRelatedToolLink } from '../types/state-machine-viewer.types';

export const SM_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.scxml', '.fsm', '.xml', '.json', '.md', '.txt'];

export const SM_ACCEPT_ATTR =
  '.scxml,.fsm,.xml,.json,.md,.txt,text/plain,text/markdown,application/json,application/xml,text/xml,application/scxml+xml';

export const SM_FORMATS_LABEL = '.scxml, .fsm, .xml, .json, .md, .txt';

export const SM_FORMATS_HINT = 'SCXML / FSM states and transitions. Education/research only.';

export const SM_MAX_FILE_BYTES = 20 * 1024 * 1024;

export const SM_RELATED_TOOLS: ReadonlyArray<SmRelatedToolLink> = [
  { label: 'Sequence Diagram Viewer', description: 'Messages over time', path: '/diagram-viewers/sequence-diagram-viewer' },
  { label: 'UML Viewer', description: 'UML diagrams', path: '/diagram-viewers/uml-viewer' },
  { label: 'Mermaid Diagram Viewer', description: 'Mermaid charts', path: '/diagram-viewers/mermaid-diagram-viewer' },
  { label: 'Decision Tree Viewer', description: 'Branches and leaves', path: '/diagram-viewers/decision-tree-viewer' }
];
