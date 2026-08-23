import type { StRelatedToolLink } from '../types/step-viewer.types';

export const ST_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.step', '.stp', '.txt', '.json', '.csv', '.md'];

export const ST_ACCEPT_ATTR =
  '.step,.stp,.txt,.json,.csv,.md,application/octet-stream,model/step,application/json,text/plain,text/csv,text/markdown';

export const ST_FORMATS_LABEL = '.step, .stp, .json, .csv, .md, .txt';

export const ST_FORMATS_HINT = 'ISO 10303 STEP solids and measurements. Education/research only.';

export const ST_MAX_FILE_BYTES = 64 * 1024 * 1024;

export const ST_RELATED_TOOLS: ReadonlyArray<StRelatedToolLink> = [
  { label: 'IGES Viewer', description: 'Legacy surface CAD', path: '/cad-viewers/iges-viewer' },
  { label: 'Parasolid Viewer', description: 'Industrial CAD kernel solids', path: '/cad-viewers/parasolid-viewer' },
  { label: 'DWG Viewer', description: 'AutoCAD drawings', path: '/cad-viewers/dwg-viewer' },
  { label: 'SolidWorks Viewer', description: 'SolidWorks parts', path: '/cad-viewers/solidworks-viewer' }
];
