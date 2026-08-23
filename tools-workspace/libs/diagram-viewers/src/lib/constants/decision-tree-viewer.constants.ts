import type { DtRelatedToolLink } from '../types/decision-tree-viewer.types';

export const DT_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.json', '.xml', '.csv', '.md', '.txt'];

export const DT_ACCEPT_ATTR =
  '.json,.xml,.csv,.md,.txt,text/plain,text/markdown,text/csv,application/json,application/xml,text/xml';

export const DT_FORMATS_LABEL = '.json, .xml, .csv, .md, .txt';

export const DT_FORMATS_HINT = 'Decision tree branches and leaves. Education/research only.';

export const DT_MAX_FILE_BYTES = 20 * 1024 * 1024;

export const DT_RELATED_TOOLS: ReadonlyArray<DtRelatedToolLink> = [
  { label: 'State Machine Viewer', description: 'SCXML / FSM', path: '/diagram-viewers/state-machine-viewer' },
  { label: 'Mermaid Diagram Viewer', description: 'Mermaid charts', path: '/diagram-viewers/mermaid-diagram-viewer' },
  { label: 'Mind Map Viewer', description: 'Hierarchical maps', path: '/diagram-viewers/mind-map-viewer' },
  { label: 'Drools Rule Viewer', description: 'Rules and conditions', path: '/diagram-viewers/drools-rule-viewer' }
];
