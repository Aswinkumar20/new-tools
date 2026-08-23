import type { PrmRelatedToolLink } from '../types/prisma-schema-viewer.types';

export const PRM_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.prisma', '.md', '.txt', '.json', '.xml'];

export const PRM_ACCEPT_ATTR =
  '.prisma,.md,.txt,.json,.xml,text/plain,text/markdown,application/json,application/xml,text/xml';

export const PRM_FORMATS_LABEL = '.prisma, .md, .txt, .json, .xml';

export const PRM_FORMATS_HINT = 'Prisma models and relations. Education/research only.';

export const PRM_MAX_FILE_BYTES = 20 * 1024 * 1024;

export const PRM_RELATED_TOOLS: ReadonlyArray<PrmRelatedToolLink> = [
  { label: 'ER Diagram Viewer', description: 'Entities and keys', path: '/diagram-viewers/er-diagram-viewer' },
  { label: 'DBML Viewer', description: 'Database markup tables', path: '/diagram-viewers/dbml-viewer' },
  { label: 'SQL Schema Viewer', description: 'CREATE TABLE schemas', path: '/diagram-viewers/sql-schema-viewer' },
  { label: 'Class Diagram Viewer', description: 'Types and relations', path: '/diagram-viewers/class-diagram-viewer' }
];
