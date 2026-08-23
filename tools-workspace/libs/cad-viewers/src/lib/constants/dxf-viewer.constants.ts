import type { DxRelatedToolLink } from '../types/dxf-viewer.types';

export const DX_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.dxf', '.txt', '.json', '.csv', '.md'];

export const DX_ACCEPT_ATTR =
  '.dxf,.txt,.json,.csv,.md,application/dxf,application/octet-stream,application/json,text/plain,text/csv,text/markdown';

export const DX_FORMATS_LABEL = '.dxf, .json, .csv, .md, .txt';

export const DX_FORMATS_HINT = 'ASCII DXF layers and entities. Education/research only.';

export const DX_MAX_FILE_BYTES = 64 * 1024 * 1024;

export const DX_RELATED_TOOLS: ReadonlyArray<DxRelatedToolLink> = [
  { label: 'DWG Viewer', description: 'AutoCAD drawings', path: '/cad-viewers/dwg-viewer' },
  { label: 'HPGL Viewer', description: 'Plotter language', path: '/cad-viewers/hpgl-viewer' },
  { label: 'PLT Plot Viewer', description: 'Legacy plotter output', path: '/cad-viewers/plt-plot-viewer' },
  { label: 'STEP Viewer', description: 'ISO 10303 solids', path: '/cad-viewers/step-viewer' }
];
