import type { GxfRelatedToolLink } from '../types/gexf-viewer.types';

export const GXF_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.gexf', '.xml', '.json', '.md', '.txt'];

export const GXF_ACCEPT_ATTR =
  '.gexf,.xml,.json,.md,.txt,application/gexf+xml,application/xml,text/xml,application/json,text/plain,text/markdown';

export const GXF_FORMATS_LABEL = '.gexf, .xml, .json, .md, .txt';

export const GXF_FORMATS_HINT = 'GEXF dynamic networks with timeline and communities. Education/research only.';

export const GXF_MAX_FILE_BYTES = 20 * 1024 * 1024;

export const GXF_RELATED_TOOLS: ReadonlyArray<GxfRelatedToolLink> = [
  { label: 'GraphML Viewer', description: 'Layout and communities', path: '/diagram-viewers/graphml-viewer' },
  { label: 'Graphviz DOT Viewer', description: 'DOT layouts and SVG', path: '/diagram-viewers/graphviz-dot-viewer' },
  { label: 'Architecture Diagram Viewer', description: 'Boxes and connectors', path: '/diagram-viewers/architecture-diagram-viewer' },
  { label: 'C4 Model Viewer', description: 'Context and containers', path: '/diagram-viewers/c4-model-viewer' }
];
