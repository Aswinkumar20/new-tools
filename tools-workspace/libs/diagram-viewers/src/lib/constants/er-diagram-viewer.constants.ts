import type { ErRelatedToolLink } from '../types/er-diagram-viewer.types';

export const ER_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.puml', '.plantuml', '.erd', '.mmd', '.md', '.txt', '.json', '.xml'];

export const ER_ACCEPT_ATTR =
  '.puml,.plantuml,.erd,.mmd,.md,.txt,.json,.xml,text/plain,text/markdown,application/json,application/xml,text/xml';

export const ER_FORMATS_LABEL = '.puml, .erd, .mmd, .md, .txt, .json, .xml';

export const ER_FORMATS_HINT = 'Entities, keys, and relationships. Education/research only.';

export const ER_MAX_FILE_BYTES = 20 * 1024 * 1024;

export const ER_RELATED_TOOLS: ReadonlyArray<ErRelatedToolLink> = [
  { label: 'DBML Viewer', description: 'Database markup tables', path: '/diagram-viewers/dbml-viewer' },
  { label: 'SQL Schema Viewer', description: 'CREATE TABLE schemas', path: '/diagram-viewers/sql-schema-viewer' },
  { label: 'Class Diagram Viewer', description: 'Types and relations', path: '/diagram-viewers/class-diagram-viewer' },
  { label: 'C4 Model Viewer', description: 'Context and containers', path: '/diagram-viewers/c4-model-viewer' }
];
