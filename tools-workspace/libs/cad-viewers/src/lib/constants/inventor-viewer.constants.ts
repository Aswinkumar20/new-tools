import type { IvRelatedToolLink } from '../types/inventor-viewer.types';

export const IV_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.ipt', '.iam', '.txt', '.json', '.csv', '.md'];

export const IV_ACCEPT_ATTR =
  '.ipt,.iam,.txt,.json,.csv,.md,application/octet-stream,application/json,text/plain,text/csv,text/markdown';

export const IV_FORMATS_LABEL = '.ipt, .iam, .json, .csv, .md, .txt';

export const IV_FORMATS_HINT = 'Inventor parts and assemblies. Education/research only.';

export const IV_MAX_FILE_BYTES = 64 * 1024 * 1024;

export const IV_RELATED_TOOLS: ReadonlyArray<IvRelatedToolLink> = [
  { label: 'Fusion 360 Viewer', description: 'Autodesk Fusion designs', path: '/cad-viewers/fusion-360-viewer' },
  { label: 'SolidWorks Viewer', description: 'SolidWorks parts', path: '/cad-viewers/solidworks-viewer' },
  { label: 'STEP Viewer', description: 'ISO 10303 solids', path: '/cad-viewers/step-viewer' },
  { label: 'Creo Viewer', description: 'PTC Creo models', path: '/cad-viewers/creo-viewer' }
];
