import type { SrRelatedToolLink } from '../types/structural-model-viewer.types';

export const SR_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.ifc', '.ifcxml', '.txt', '.json', '.csv', '.md'];

export const SR_ACCEPT_ATTR =
  '.ifc,.ifcxml,.txt,.json,.csv,.md,application/x-step,application/octet-stream,application/json,text/plain,text/csv,text/markdown';

export const SR_FORMATS_LABEL = '.ifc, .ifcxml, .json, .csv, .md, .txt';

export const SR_FORMATS_HINT = 'Structural BIM members and properties. Education/research only.';

export const SR_MAX_FILE_BYTES = 64 * 1024 * 1024;

export const SR_RELATED_TOOLS: ReadonlyArray<SrRelatedToolLink> = [
  { label: 'MEP Model Viewer', description: 'MEP discipline 3D', path: '/cad-viewers/mep-model-viewer' },
  { label: 'IFC Viewer', description: 'OpenBIM building models', path: '/cad-viewers/ifc-viewer' },
  { label: 'Building Floor Plan Viewer', description: 'Levels and rooms', path: '/cad-viewers/building-floor-plan-viewer' },
  { label: 'Navisworks Viewer', description: 'AEC coordination', path: '/cad-viewers/navisworks-viewer' }
];
