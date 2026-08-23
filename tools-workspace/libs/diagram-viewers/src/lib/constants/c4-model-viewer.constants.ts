import type { C4RelatedToolLink } from '../types/c4-model-viewer.types';

export const C4_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.puml', '.c4', '.dsl', '.md', '.txt', '.json', '.xml'];

export const C4_ACCEPT_ATTR =
  '.puml,.c4,.dsl,.md,.txt,.json,.xml,text/plain,text/markdown,application/json,application/xml,text/xml';

export const C4_FORMATS_LABEL = '.puml, .c4, .dsl, .md, .txt, .json, .xml';

export const C4_FORMATS_HINT = 'C4 context, container, and component models. Education/research only.';

export const C4_MAX_FILE_BYTES = 20 * 1024 * 1024;

export const C4_RELATED_TOOLS: ReadonlyArray<C4RelatedToolLink> = [
  { label: 'Architecture Diagram Viewer', description: 'Boxes and connectors', path: '/diagram-viewers/architecture-diagram-viewer' },
  { label: 'PlantUML Viewer', description: 'UML and C4 sources', path: '/diagram-viewers/plantuml-viewer' },
  { label: 'UML Viewer', description: 'Class and sequence UML', path: '/diagram-viewers/uml-viewer' },
  { label: 'Class Diagram Viewer', description: 'Types and relations', path: '/diagram-viewers/class-diagram-viewer' }
];
