import type { DioRelatedToolLink } from '../types/draw-io-viewer.types';

export const DIO_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.drawio', '.dio', '.xml', '.svg', '.json', '.md', '.txt'];

export const DIO_ACCEPT_ATTR =
  '.drawio,.dio,.xml,.svg,.json,.md,.txt,text/plain,text/markdown,application/json,application/xml,text/xml,image/svg+xml';

export const DIO_FORMATS_LABEL = '.drawio, .dio, .xml, .svg, .json, .md, .txt';

export const DIO_FORMATS_HINT = 'Draw.io pages, shapes, and zoom. Education/research only.';

export const DIO_MAX_FILE_BYTES = 20 * 1024 * 1024;

export const DIO_RELATED_TOOLS: ReadonlyArray<DioRelatedToolLink> = [
  { label: 'GraphML Viewer', description: 'Graph nodes and edges', path: '/diagram-viewers/graphml-viewer' },
  { label: 'Architecture Diagram Viewer', description: 'Boxes and connectors', path: '/diagram-viewers/architecture-diagram-viewer' },
  { label: 'C4 Model Viewer', description: 'Context and containers', path: '/diagram-viewers/c4-model-viewer' },
  { label: 'Visio Viewer', description: 'Visio pages and shapes', path: '/diagram-viewers/visio-viewer' }
];
