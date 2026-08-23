import type { VsdRelatedToolLink } from '../types/visio-viewer.types';

export const VSD_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.vdx', '.vsdx', '.vsx', '.xml', '.json', '.md', '.txt'];

export const VSD_ACCEPT_ATTR =
  '.vdx,.vsdx,.vsx,.xml,.json,.md,.txt,text/plain,text/markdown,application/json,application/xml,text/xml,application/vnd.ms-visio.drawing,application/vnd.visio';

export const VSD_FORMATS_LABEL = '.vdx, .vsdx, .vsx, .xml, .json, .md, .txt';

export const VSD_FORMATS_HINT = 'Visio pages and shapes. Education/research only.';

export const VSD_MAX_FILE_BYTES = 20 * 1024 * 1024;

export const VSD_RELATED_TOOLS: ReadonlyArray<VsdRelatedToolLink> = [
  { label: 'Draw.io Viewer', description: 'Pages, shapes, and zoom', path: '/diagram-viewers/draw-io-viewer' },
  { label: 'Architecture Diagram Viewer', description: 'Boxes and connectors', path: '/diagram-viewers/architecture-diagram-viewer' },
  { label: 'GraphML Viewer', description: 'Graph nodes and edges', path: '/diagram-viewers/graphml-viewer' },
  { label: 'C4 Model Viewer', description: 'Context and containers', path: '/diagram-viewers/c4-model-viewer' }
];
