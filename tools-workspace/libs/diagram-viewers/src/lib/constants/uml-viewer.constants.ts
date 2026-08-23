import type { UmlRelatedToolLink } from '../types/uml-viewer.types';

export const UML_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.uml', '.puml', '.xmi', '.xml', '.md', '.txt', '.json'];

export const UML_ACCEPT_ATTR =
  '.uml,.puml,.xmi,.xml,.md,.txt,.json,application/xml,text/xml,text/plain,text/markdown,application/json';

export const UML_FORMATS_LABEL = '.uml, .puml, .xmi, .xml, .md, .txt, .json';

export const UML_FORMATS_HINT = 'UML class and sequence sources. Education/research only.';

export const UML_MAX_FILE_BYTES = 20 * 1024 * 1024;

export const UML_RELATED_TOOLS: ReadonlyArray<UmlRelatedToolLink> = [
  { label: 'Class Diagram Viewer', description: 'Types and relations', path: '/diagram-viewers/class-diagram-viewer' },
  { label: 'PlantUML Viewer', description: 'UML and C4 sources', path: '/diagram-viewers/plantuml-viewer' },
  { label: 'Sequence Diagram Viewer', description: 'Interaction diagrams', path: '/diagram-viewers/sequence-diagram-viewer' },
  { label: 'Mermaid Diagram Viewer', description: 'Flowcharts and sequence', path: '/diagram-viewers/mermaid-diagram-viewer' }
];
