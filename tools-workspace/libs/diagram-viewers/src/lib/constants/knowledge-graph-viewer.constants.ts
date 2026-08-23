import type { KgRelatedToolLink } from '../types/knowledge-graph-viewer.types';

export const KG_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.json', '.xml', '.csv', '.md', '.txt'];

export const KG_ACCEPT_ATTR =
  '.json,.xml,.csv,.md,.txt,text/plain,text/markdown,text/csv,application/json,application/xml,text/xml';

export const KG_FORMATS_LABEL = '.json, .xml, .csv, .md, .txt';

export const KG_FORMATS_HINT = 'Knowledge graph entities and links. Education/research only.';

export const KG_MAX_FILE_BYTES = 20 * 1024 * 1024;

export const KG_RELATED_TOOLS: ReadonlyArray<KgRelatedToolLink> = [
  { label: 'RDF Viewer', description: 'Triples and graphs', path: '/diagram-viewers/rdf-viewer' },
  { label: 'OWL Ontology Viewer', description: 'Classes and properties', path: '/diagram-viewers/owl-ontology-viewer' },
  { label: 'GraphML Viewer', description: 'Graph nodes and edges', path: '/diagram-viewers/graphml-viewer' },
  { label: 'Concept Map Viewer', description: 'Concepts and links', path: '/diagram-viewers/concept-map-viewer' }
];
