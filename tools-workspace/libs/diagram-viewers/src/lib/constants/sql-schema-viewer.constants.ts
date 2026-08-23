import type { SqlsRelatedToolLink } from '../types/sql-schema-viewer.types';

export const SQLS_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.sql', '.ddl', '.md', '.txt', '.json', '.xml'];

export const SQLS_ACCEPT_ATTR =
  '.sql,.ddl,.md,.txt,.json,.xml,text/plain,text/markdown,application/json,application/xml,text/xml';

export const SQLS_FORMATS_LABEL = '.sql, .ddl, .md, .txt, .json, .xml';

export const SQLS_FORMATS_HINT = 'SQL tables and foreign keys. Education/research only.';

export const SQLS_MAX_FILE_BYTES = 20 * 1024 * 1024;

export const SQLS_RELATED_TOOLS: ReadonlyArray<SqlsRelatedToolLink> = [
  { label: 'ER Diagram Viewer', description: 'Entities and keys', path: '/diagram-viewers/er-diagram-viewer' },
  { label: 'DBML Viewer', description: 'Database markup tables', path: '/diagram-viewers/dbml-viewer' },
  { label: 'Prisma Schema Viewer', description: 'Prisma models', path: '/diagram-viewers/prisma-schema-viewer' },
  { label: 'Class Diagram Viewer', description: 'Types and relations', path: '/diagram-viewers/class-diagram-viewer' }
];
