import type { MmapRelatedToolLink } from '../types/mind-map-viewer.types';

export const MMAP_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.md', '.mmd', '.opml', '.json', '.txt', '.xml'];

export const MMAP_ACCEPT_ATTR =
  '.md,.mmd,.opml,.json,.txt,.xml,text/markdown,text/plain,application/json,application/xml,text/xml,text/x-opml';

export const MMAP_FORMATS_LABEL = '.md, .mmd, .opml, .json, .txt, .xml';

export const MMAP_FORMATS_HINT = 'Mind maps with collapse and search. Education/research only.';

export const MMAP_MAX_FILE_BYTES = 20 * 1024 * 1024;

export const MMAP_RELATED_TOOLS: ReadonlyArray<MmapRelatedToolLink> = [
  { label: 'FreeMind Viewer', description: 'FreeMind .mm maps', path: '/diagram-viewers/freemind-viewer' },
  { label: 'Freeplane Viewer', description: 'Freeplane mind maps', path: '/diagram-viewers/freeplane-viewer' },
  { label: 'Concept Map Viewer', description: 'Concept relationships', path: '/diagram-viewers/concept-map-viewer' },
  { label: 'Mermaid Diagram Viewer', description: 'Mermaid mindmaps', path: '/diagram-viewers/mermaid-diagram-viewer' }
];
