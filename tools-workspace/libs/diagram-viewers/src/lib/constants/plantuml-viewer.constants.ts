import type { PumlRelatedToolLink } from '../types/plantuml-viewer.types';

export const PUML_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.puml', '.plantuml', '.pu', '.md', '.txt', '.json'];

export const PUML_ACCEPT_ATTR =
  '.puml,.plantuml,.pu,.md,.txt,.json,text/plain,text/markdown,application/json';

export const PUML_FORMATS_LABEL = '.puml, .plantuml, .pu, .md, .txt, .json';

export const PUML_FORMATS_HINT = 'PlantUML class, C4, and relation diagrams. Education/research only.';

export const PUML_MAX_FILE_BYTES = 20 * 1024 * 1024;

export const PUML_RELATED_TOOLS: ReadonlyArray<PumlRelatedToolLink> = [
  { label: 'Mermaid Diagram Viewer', description: 'Flowcharts and sequence', path: '/diagram-viewers/mermaid-diagram-viewer' },
  { label: 'Graphviz DOT Viewer', description: 'DOT layouts', path: '/diagram-viewers/graphviz-dot-viewer' },
  { label: 'UML Viewer', description: 'Class and sequence UML', path: '/diagram-viewers/uml-viewer' },
  { label: 'C4 Model Viewer', description: 'Context and containers', path: '/diagram-viewers/c4-model-viewer' }
];
