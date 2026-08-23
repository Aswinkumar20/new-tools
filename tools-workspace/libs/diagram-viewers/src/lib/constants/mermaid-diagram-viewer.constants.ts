import type { MmdRelatedToolLink } from '../types/mermaid-diagram-viewer.types';

export const MMD_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.mmd', '.mermaid', '.md', '.txt', '.json'];

export const MMD_ACCEPT_ATTR =
  '.mmd,.mermaid,.md,.txt,.json,text/markdown,text/plain,application/json';

export const MMD_FORMATS_LABEL = '.mmd, .mermaid, .md, .txt, .json';

export const MMD_FORMATS_HINT = 'Mermaid flowcharts and sequence diagrams. Education/research only.';

export const MMD_MAX_FILE_BYTES = 20 * 1024 * 1024;

export const MMD_RELATED_TOOLS: ReadonlyArray<MmdRelatedToolLink> = [
  { label: 'BPMN Viewer', description: 'Business process diagrams', path: '/process-viewers/bpmn-viewer' },
  { label: 'PlantUML Viewer', description: 'UML and C4 sources', path: '/diagram-viewers/plantuml-viewer' },
  { label: 'Graphviz DOT Viewer', description: 'DOT layouts', path: '/diagram-viewers/graphviz-dot-viewer' },
  { label: 'Sequence Diagram Viewer', description: 'Interaction diagrams', path: '/diagram-viewers/sequence-diagram-viewer' }
];
