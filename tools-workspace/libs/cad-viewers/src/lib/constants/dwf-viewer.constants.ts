import type { WfRelatedToolLink } from '../types/dwf-viewer.types';

export const WF_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.dwf', '.dwfx', '.txt', '.json', '.csv', '.md'];

export const WF_ACCEPT_ATTR =
  '.dwf,.dwfx,.txt,.json,.csv,.md,application/octet-stream,model/vnd.dwf,application/json,text/plain,text/csv,text/markdown';

export const WF_FORMATS_LABEL = '.dwf, .dwfx, .json, .csv, .md, .txt';

export const WF_FORMATS_HINT = 'Design Web Format published sheets and layers. Education/research only.';

export const WF_MAX_FILE_BYTES = 64 * 1024 * 1024;

export const WF_RELATED_TOOLS: ReadonlyArray<WfRelatedToolLink> = [
  { label: 'DWG Viewer', description: 'AutoCAD drawings', path: '/cad-viewers/dwg-viewer' },
  { label: 'DXF Viewer', description: 'Open CAD exchange drawings', path: '/cad-viewers/dxf-viewer' },
  { label: 'DGN Viewer', description: 'MicroStation drawings', path: '/cad-viewers/dgn-viewer' },
  { label: 'PLT Plot Viewer', description: 'Legacy plotter output', path: '/cad-viewers/plt-plot-viewer' }
];
