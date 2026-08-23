import type { ArchRelatedToolLink } from '../types/architecture-diagram-viewer.types';

export const ARCH_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.puml', '.arch', '.mmd', '.md', '.txt', '.json', '.xml'];

export const ARCH_ACCEPT_ATTR =
  '.puml,.arch,.mmd,.md,.txt,.json,.xml,text/plain,text/markdown,application/json,application/xml,text/xml';

export const ARCH_FORMATS_LABEL = '.puml, .arch, .mmd, .md, .txt, .json, .xml';

export const ARCH_FORMATS_HINT = 'Architecture boxes and connectors. Education/research only.';

export const ARCH_MAX_FILE_BYTES = 20 * 1024 * 1024;

export const ARCH_RELATED_TOOLS: ReadonlyArray<ArchRelatedToolLink> = [
  { label: 'C4 Model Viewer', description: 'Context and containers', path: '/diagram-viewers/c4-model-viewer' },
  { label: 'PlantUML Viewer', description: 'UML and C4 sources', path: '/diagram-viewers/plantuml-viewer' },
  { label: 'UML Viewer', description: 'Class and sequence UML', path: '/diagram-viewers/uml-viewer' },
  { label: 'Sequence Diagram Viewer', description: 'Interaction diagrams', path: '/diagram-viewers/sequence-diagram-viewer' }
];
