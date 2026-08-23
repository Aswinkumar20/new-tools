import type { IcRelatedToolLink } from '../types/ifc-viewer.types';

export const IC_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.ifc', '.ifcxml', '.txt', '.json', '.csv', '.md'];

export const IC_ACCEPT_ATTR =
  '.ifc,.ifcxml,.txt,.json,.csv,.md,application/x-step,application/octet-stream,application/json,text/plain,text/csv,text/markdown';

export const IC_FORMATS_LABEL = '.ifc, .ifcxml, .json, .csv, .md, .txt';

export const IC_FORMATS_HINT = 'IFC OpenBIM building, properties, and disciplines. Education/research only.';

export const IC_MAX_FILE_BYTES = 64 * 1024 * 1024;

export const IC_RELATED_TOOLS: ReadonlyArray<IcRelatedToolLink> = [
  { label: 'Revit Viewer', description: 'Autodesk Revit preview', path: '/cad-viewers/revit-viewer' },
  { label: 'Navisworks Viewer', description: 'AEC coordination', path: '/cad-viewers/navisworks-viewer' },
  { label: 'BIM Clash Viewer', description: 'Clash detection review', path: '/cad-viewers/bim-clash-viewer' },
  { label: 'STEP Viewer', description: 'ISO 10303 solids', path: '/cad-viewers/step-viewer' }
];
