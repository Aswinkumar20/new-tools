import type { CmapRelatedToolLink } from '../types/concept-map-viewer.types';

export const CMAP_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.cxl', '.cmap', '.xml', '.json', '.md', '.txt', '.dot'];

export const CMAP_ACCEPT_ATTR =
  '.cxl,.cmap,.xml,.json,.md,.txt,.dot,text/plain,text/markdown,application/json,application/xml,text/xml';

export const CMAP_FORMATS_LABEL = '.cxl, .cmap, .xml, .json, .md, .txt, .dot';

export const CMAP_FORMATS_HINT = 'Concept nodes and labeled links. Education/research only.';

export const CMAP_MAX_FILE_BYTES = 20 * 1024 * 1024;

export const CMAP_RELATED_TOOLS: ReadonlyArray<CmapRelatedToolLink> = [
  { label: 'Mind Map Viewer', description: 'Outline and branch maps', path: '/diagram-viewers/mind-map-viewer' },
  { label: 'FreeMind Viewer', description: 'FreeMind .mm trees', path: '/diagram-viewers/freemind-viewer' },
  { label: 'Architecture Diagram Viewer', description: 'Boxes and connectors', path: '/diagram-viewers/architecture-diagram-viewer' },
  { label: 'C4 Model Viewer', description: 'Context and containers', path: '/diagram-viewers/c4-model-viewer' }
];
