/**
 * Shared sql.js helpers for GeoPackage / MBTiles viewers.
 * sql.js is loaded only from the `sql.js` package in node_modules
 * (declared in the workspace package.json). WASM is served from /assets/sqljs/.
 */

import type { SqlJsStatic, Database } from 'sql.js';

type InitSqlJs = (config?: { locateFile?: (file: string) => string }) => Promise<SqlJsStatic>;

let sqlJsPromise: Promise<SqlJsStatic> | null = null;

export async function loadSqlJs(wasmAssetBase: string): Promise<SqlJsStatic> {
  if (!sqlJsPromise) {
    sqlJsPromise = (async () => {
      const mod = await import('sql.js');
      const initSqlJs = (mod.default ?? mod) as InitSqlJs;
      const base = wasmAssetBase.replace(/\/$/, '');
      return initSqlJs({
        locateFile: (file: string) => `${base}/${file}`
      });
    })();
  }
  return sqlJsPromise;
}

export async function openSqliteDatabase(
  wasmAssetBase: string,
  data: ArrayBuffer | Uint8Array
): Promise<Database> {
  const SQL = await loadSqlJs(wasmAssetBase);
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  return new SQL.Database(bytes);
}

export function queryAll(
  db: Database,
  sql: string,
  params: Array<string | number | null | Uint8Array> = []
): Record<string, unknown>[] {
  const stmt = db.prepare(sql);
  try {
    if (params.length) {
      stmt.bind(params as never);
    }
    const rows: Record<string, unknown>[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as Record<string, unknown>);
    }
    return rows;
  } finally {
    stmt.free();
  }
}

export function tableExists(db: Database, tableName: string): boolean {
  const rows = queryAll(
    db,
    `SELECT name FROM sqlite_master WHERE type IN ('table','view') AND name = ? LIMIT 1`,
    [tableName]
  );
  return rows.length > 0;
}

export function closeDatabase(db: Database | null | undefined): void {
  try {
    db?.close();
  } catch {
    // ignore close errors
  }
}

export function downloadBinaryFile(bytes: Uint8Array, fileName: string, mime: string): void {
  if (typeof document === 'undefined') {
    throw new Error('Download is only available in the browser');
  }
  if (!bytes?.length) {
    throw new Error('Nothing to download');
  }
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy.buffer], { type: mime || 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName.trim() || 'download.bin';
  anchor.click();
  URL.revokeObjectURL(url);
}
