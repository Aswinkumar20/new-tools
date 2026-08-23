import type { PlRelatedToolLink } from '../types/plt-plot-viewer.types';

export const PL_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.plt', '.txt', '.json', '.csv', '.md'];

export const PL_ACCEPT_ATTR =
  '.plt,.txt,.json,.csv,.md,application/vnd.hp-hpgl,application/octet-stream,application/json,text/plain,text/csv,text/markdown';

export const PL_FORMATS_LABEL = '.plt, .json, .csv, .md, .txt';

export const PL_FORMATS_HINT = 'HPGL/PLT pens and vector plot. Education/research only.';

export const PL_MAX_FILE_BYTES = 64 * 1024 * 1024;

export const PL_RELATED_TOOLS: ReadonlyArray<PlRelatedToolLink> = [
  { label: 'HPGL Viewer', description: 'Plotter language', path: '/cad-viewers/hpgl-viewer' },
  { label: 'DXF Viewer', description: 'ASCII CAD drawings', path: '/cad-viewers/dxf-viewer' },
  { label: 'DWG Viewer', description: 'AutoCAD drawings', path: '/cad-viewers/dwg-viewer' },
  { label: 'DGN Viewer', description: 'MicroStation drawings', path: '/cad-viewers/dgn-viewer' }
];
