import type { SwRelatedToolLink } from '../types/solidworks-viewer.types';

export const SW_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.sldprt', '.sldasm', '.txt', '.json', '.csv', '.md'];

export const SW_ACCEPT_ATTR =
  '.sldprt,.sldasm,.txt,.json,.csv,.md,application/octet-stream,application/json,text/plain,text/csv,text/markdown';

export const SW_FORMATS_LABEL = '.sldprt, .sldasm, .json, .csv, .md, .txt';

export const SW_FORMATS_HINT = 'SolidWorks parts and assemblies. Education/research only.';

export const SW_MAX_FILE_BYTES = 64 * 1024 * 1024;

export const SW_RELATED_TOOLS: ReadonlyArray<SwRelatedToolLink> = [
  { label: 'STEP Viewer', description: 'ISO 10303 solids', path: '/cad-viewers/step-viewer' },
  { label: 'CATIA Viewer', description: 'Dassault CATIA parts', path: '/cad-viewers/catia-viewer' },
  { label: 'Fusion 360 Viewer', description: 'Autodesk Fusion designs', path: '/cad-viewers/fusion-360-viewer' },
  { label: 'Inventor Viewer', description: 'Autodesk Inventor models', path: '/cad-viewers/inventor-viewer' }
];
