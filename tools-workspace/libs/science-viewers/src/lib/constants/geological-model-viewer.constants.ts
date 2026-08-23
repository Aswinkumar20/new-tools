import type { GeoModelRelatedToolLink } from '../types/geological-model-viewer.types';

export const GEO_MODEL_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.json', '.geojson', '.gmod', '.csv'];

export const GEO_MODEL_ACCEPT_ATTR = '.json,.geojson,.gmod,.csv,application/json,text/csv,text/plain';

export const GEO_MODEL_FORMATS_LABEL = '.json, .geojson, .gmod, .csv';

export const GEO_MODEL_FORMATS_HINT =
  'Geological models stay in your browser. Layer maps, cross-sections, and stratigraphic columns are for education/research only.';

export const GEO_MODEL_MAX_FILE_BYTES = 8 * 1024 * 1024;

export const GEO_MODEL_RELATED_TOOLS: ReadonlyArray<GeoModelRelatedToolLink> = [
  { label: 'SEG-Y Viewer', description: 'Seismic sections', path: '/science-viewers/seg-y-viewer' },
  { label: 'LAS Well Log Viewer', description: 'CWLS LAS depth tracks', path: '/science-viewers/las-well-log-viewer' },
  { label: 'Borehole Viewer', description: 'Well / borehole paths', path: '/science-viewers/borehole-viewer' },
  { label: 'Stratigraphy Viewer', description: 'Stratigraphic columns', path: '/science-viewers/stratigraphy-viewer' }
];
