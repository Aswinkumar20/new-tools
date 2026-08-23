import type { HgRelatedToolLink } from '../types/hpgl-viewer.types';

export const HG_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.hpgl', '.hgl', '.txt', '.json', '.csv', '.md'];

export const HG_ACCEPT_ATTR =
  '.hpgl,.hgl,.txt,.json,.csv,.md,application/vnd.hp-hpgl,application/octet-stream,application/json,text/plain,text/csv,text/markdown';

export const HG_FORMATS_LABEL = '.hpgl, .hgl, .json, .csv, .md, .txt';

export const HG_FORMATS_HINT = 'HP-GL layers and vector plot. Education/research only.';

export const HG_MAX_FILE_BYTES = 64 * 1024 * 1024;

export const HG_RELATED_TOOLS: ReadonlyArray<HgRelatedToolLink> = [
  { label: 'PLT Plot Viewer', description: 'Legacy plotter output', path: '/cad-viewers/plt-plot-viewer' },
  { label: 'DXF Viewer', description: 'ASCII CAD drawings', path: '/cad-viewers/dxf-viewer' },
  { label: 'DWG Viewer', description: 'AutoCAD drawings', path: '/cad-viewers/dwg-viewer' },
  { label: 'DWF Viewer', description: 'Published sheets', path: '/cad-viewers/dwf-viewer' }
];
