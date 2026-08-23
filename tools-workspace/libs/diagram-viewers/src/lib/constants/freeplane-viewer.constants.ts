import type { FpRelatedToolLink } from '../types/freeplane-viewer.types';

export const FP_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.mm', '.xml', '.json', '.md', '.txt'];

export const FP_ACCEPT_ATTR =
  '.mm,.xml,.json,.md,.txt,application/x-freeplane,application/xml,text/xml,application/json,text/plain,text/markdown';

export const FP_FORMATS_LABEL = '.mm, .xml, .json, .md, .txt';

export const FP_FORMATS_HINT = 'Freeplane maps with nodes and icons. Education/research only.';

export const FP_MAX_FILE_BYTES = 20 * 1024 * 1024;

export const FP_RELATED_TOOLS: ReadonlyArray<FpRelatedToolLink> = [
  { label: 'FreeMind Viewer', description: 'Tree and notes', path: '/diagram-viewers/freemind-viewer' },
  { label: 'Mind Map Viewer', description: 'Collapse and search', path: '/diagram-viewers/mind-map-viewer' },
  { label: 'Concept Map Viewer', description: 'Concept relationships', path: '/diagram-viewers/concept-map-viewer' },
  { label: 'Mermaid Diagram Viewer', description: 'Mermaid mindmaps', path: '/diagram-viewers/mermaid-diagram-viewer' }
];
