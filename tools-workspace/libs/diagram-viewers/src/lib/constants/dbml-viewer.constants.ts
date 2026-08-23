import type { DbmlRelatedToolLink } from '../types/dbml-viewer.types';

export const DBML_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.dbml', '.md', '.txt', '.json', '.xml'];

export const DBML_ACCEPT_ATTR =
  '.dbml,.md,.txt,.json,.xml,text/plain,text/markdown,application/json,application/xml,text/xml';

export const DBML_FORMATS_LABEL = '.dbml, .md, .txt, .json, .xml';

export const DBML_FORMATS_HINT = 'DBML tables and refs. Education/research only.';

export const DBML_MAX_FILE_BYTES = 20 * 1024 * 1024;

export const DBML_RELATED_TOOLS: ReadonlyArray<DbmlRelatedToolLink> = [
  { label: 'ER Diagram Viewer', description: 'Entities and keys', path: '/diagram-viewers/er-diagram-viewer' },
  { label: 'SQL Schema Viewer', description: 'CREATE TABLE schemas', path: '/diagram-viewers/sql-schema-viewer' },
  { label: 'Prisma Schema Viewer', description: 'Prisma models', path: '/diagram-viewers/prisma-schema-viewer' },
  { label: 'Class Diagram Viewer', description: 'Types and relations', path: '/diagram-viewers/class-diagram-viewer' }
];
