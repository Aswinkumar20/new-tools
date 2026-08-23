import type { GvzLayout, GvzRelatedToolLink } from '../types/graphviz-dot-viewer.types';

export const GVZ_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.dot', '.gv', '.md', '.txt', '.json'];

export const GVZ_ACCEPT_ATTR = '.dot,.gv,.md,.txt,.json,text/vnd.graphviz,text/plain,text/markdown,application/json';

export const GVZ_FORMATS_LABEL = '.dot, .gv, .md, .txt, .json';

export const GVZ_FORMATS_HINT = 'Graphviz DOT graphs with local layouts. Education/research only.';

export const GVZ_MAX_FILE_BYTES = 20 * 1024 * 1024;

export const GVZ_LAYOUTS: ReadonlyArray<GvzLayout> = ['dot', 'neato', 'fdp', 'circo', 'twopi'];

export const GVZ_RELATED_TOOLS: ReadonlyArray<GvzRelatedToolLink> = [
  { label: 'Mermaid Diagram Viewer', description: 'Flowcharts and sequence', path: '/diagram-viewers/mermaid-diagram-viewer' },
  { label: 'PlantUML Viewer', description: 'UML and C4 sources', path: '/diagram-viewers/plantuml-viewer' },
  { label: 'GraphML Viewer', description: 'GraphML networks', path: '/diagram-viewers/graphml-viewer' },
  { label: 'Architecture Diagram Viewer', description: 'Boxes and connectors', path: '/diagram-viewers/architecture-diagram-viewer' }
];
