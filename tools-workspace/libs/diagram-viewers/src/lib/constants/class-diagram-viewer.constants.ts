import type { CdgRelatedToolLink } from '../types/class-diagram-viewer.types';

export const CDG_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.puml', '.uml', '.cdm', '.cls', '.xmi', '.xml', '.md', '.txt', '.json'];

export const CDG_ACCEPT_ATTR =
  '.puml,.uml,.cdm,.cls,.xmi,.xml,.md,.txt,.json,application/xml,text/xml,text/plain,text/markdown,application/json';

export const CDG_FORMATS_LABEL = '.puml, .uml, .cdm, .cls, .xmi, .xml, .md, .txt, .json';

export const CDG_FORMATS_HINT = 'Class types, attributes, operations, and relations. Education/research only.';

export const CDG_MAX_FILE_BYTES = 20 * 1024 * 1024;

export const CDG_RELATED_TOOLS: ReadonlyArray<CdgRelatedToolLink> = [
  { label: 'UML Viewer', description: 'Class and sequence UML', path: '/diagram-viewers/uml-viewer' },
  { label: 'PlantUML Viewer', description: 'UML and C4 sources', path: '/diagram-viewers/plantuml-viewer' },
  { label: 'C4 Model Viewer', description: 'Context and containers', path: '/diagram-viewers/c4-model-viewer' },
  { label: 'Architecture Diagram Viewer', description: 'Boxes and connectors', path: '/diagram-viewers/architecture-diagram-viewer' }
];
