import type { SeqRelatedToolLink } from '../types/sequence-diagram-viewer.types';

export const SEQ_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.puml', '.uml', '.seq', '.sd', '.mmd', '.md', '.txt', '.json', '.xml'];

export const SEQ_ACCEPT_ATTR =
  '.puml,.uml,.seq,.sd,.mmd,.md,.txt,.json,.xml,text/plain,text/markdown,application/json,application/xml,text/xml';

export const SEQ_FORMATS_LABEL = '.puml, .uml, .seq, .sd, .mmd, .md, .txt, .json, .xml';

export const SEQ_FORMATS_HINT = 'Sequence lifelines and messages. Education/research only.';

export const SEQ_MAX_FILE_BYTES = 20 * 1024 * 1024;

export const SEQ_RELATED_TOOLS: ReadonlyArray<SeqRelatedToolLink> = [
  { label: 'UML Viewer', description: 'Class and sequence UML', path: '/diagram-viewers/uml-viewer' },
  { label: 'Mermaid Diagram Viewer', description: 'Flowcharts and sequence', path: '/diagram-viewers/mermaid-diagram-viewer' },
  { label: 'PlantUML Viewer', description: 'UML and C4 sources', path: '/diagram-viewers/plantuml-viewer' },
  { label: 'Architecture Diagram Viewer', description: 'Boxes and connectors', path: '/diagram-viewers/architecture-diagram-viewer' }
];
