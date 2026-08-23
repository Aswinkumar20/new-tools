import type { FmRelatedToolLink } from '../types/freemind-viewer.types';

export const FM_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.mm', '.xml', '.json', '.md', '.txt'];

export const FM_ACCEPT_ATTR =
  '.mm,.xml,.json,.md,.txt,application/x-freemind,application/xml,text/xml,application/json,text/plain,text/markdown';

export const FM_FORMATS_LABEL = '.mm, .xml, .json, .md, .txt';

export const FM_FORMATS_HINT = 'FreeMind maps with tree and notes. Education/research only.';

export const FM_MAX_FILE_BYTES = 20 * 1024 * 1024;

export const FM_RELATED_TOOLS: ReadonlyArray<FmRelatedToolLink> = [
  { label: 'Freeplane Viewer', description: 'Nodes and icons', path: '/diagram-viewers/freeplane-viewer' },
  { label: 'Mind Map Viewer', description: 'Collapse and search', path: '/diagram-viewers/mind-map-viewer' },
  { label: 'Concept Map Viewer', description: 'Concept relationships', path: '/diagram-viewers/concept-map-viewer' },
  { label: 'Mermaid Diagram Viewer', description: 'Mermaid mindmaps', path: '/diagram-viewers/mermaid-diagram-viewer' }
];
