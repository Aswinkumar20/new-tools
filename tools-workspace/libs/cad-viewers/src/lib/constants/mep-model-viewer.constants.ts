import type { MeRelatedToolLink } from '../types/mep-model-viewer.types';

export const ME_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.ifc', '.ifcxml', '.txt', '.json', '.csv', '.md'];

export const ME_ACCEPT_ATTR =
  '.ifc,.ifcxml,.txt,.json,.csv,.md,application/x-step,application/octet-stream,application/json,text/plain,text/csv,text/markdown';

export const ME_FORMATS_LABEL = '.ifc, .ifcxml, .json, .csv, .md, .txt';

export const ME_FORMATS_HINT = 'MEP models with discipline filters and 3D. Education/research only.';

export const ME_MAX_FILE_BYTES = 64 * 1024 * 1024;

export const ME_RELATED_TOOLS: ReadonlyArray<MeRelatedToolLink> = [
  { label: 'Building Floor Plan Viewer', description: 'Levels and rooms', path: '/cad-viewers/building-floor-plan-viewer' },
  { label: 'IFC Viewer', description: 'OpenBIM building models', path: '/cad-viewers/ifc-viewer' },
  { label: 'Navisworks Viewer', description: 'AEC coordination', path: '/cad-viewers/navisworks-viewer' },
  { label: 'BIM Clash Viewer', description: 'Clash list and 3D focus', path: '/cad-viewers/bim-clash-viewer' }
];
