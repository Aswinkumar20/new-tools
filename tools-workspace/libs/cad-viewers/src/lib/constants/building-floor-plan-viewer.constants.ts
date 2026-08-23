import type { FpRelatedToolLink } from '../types/building-floor-plan-viewer.types';

export const FP_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.ifc', '.ifcxml', '.txt', '.json', '.csv', '.md'];

export const FP_ACCEPT_ATTR =
  '.ifc,.ifcxml,.txt,.json,.csv,.md,application/x-step,application/octet-stream,application/json,text/plain,text/csv,text/markdown';

export const FP_FORMATS_LABEL = '.ifc, .ifcxml, .json, .csv, .md, .txt';

export const FP_FORMATS_HINT = 'Building floor plans with levels and rooms. Education/research only.';

export const FP_MAX_FILE_BYTES = 64 * 1024 * 1024;

export const FP_RELATED_TOOLS: ReadonlyArray<FpRelatedToolLink> = [
  { label: 'MEP Model Viewer', description: 'MEP discipline 3D', path: '/cad-viewers/mep-model-viewer' },
  { label: 'IFC Viewer', description: 'OpenBIM building models', path: '/cad-viewers/ifc-viewer' },
  { label: 'Revit Viewer', description: 'Autodesk Revit preview', path: '/cad-viewers/revit-viewer' },
  { label: 'DXF Viewer', description: '2D drawing layers', path: '/cad-viewers/dxf-viewer' }
];
