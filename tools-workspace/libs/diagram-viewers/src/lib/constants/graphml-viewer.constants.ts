import type { GmlRelatedToolLink } from '../types/graphml-viewer.types';

export const GML_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.graphml', '.xml', '.json', '.md', '.txt'];

export const GML_ACCEPT_ATTR =
  '.graphml,.xml,.json,.md,.txt,application/graphml+xml,application/xml,text/xml,application/json,text/plain,text/markdown';

export const GML_FORMATS_LABEL = '.graphml, .xml, .json, .md, .txt';

export const GML_FORMATS_HINT = 'GraphML networks with layout and communities. Education/research only.';

export const GML_MAX_FILE_BYTES = 20 * 1024 * 1024;

export const GML_RELATED_TOOLS: ReadonlyArray<GmlRelatedToolLink> = [
  { label: 'GEXF Viewer', description: 'Dynamic network graphs', path: '/diagram-viewers/gexf-viewer' },
  { label: 'Graphviz DOT Viewer', description: 'DOT layouts and SVG', path: '/diagram-viewers/graphviz-dot-viewer' },
  { label: 'Architecture Diagram Viewer', description: 'Boxes and connectors', path: '/diagram-viewers/architecture-diagram-viewer' },
  { label: 'C4 Model Viewer', description: 'Context and containers', path: '/diagram-viewers/c4-model-viewer' }
];
