import type { OwlRelatedToolLink } from '../types/owl-ontology-viewer.types';

export const OWL_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.owl', '.rdf', '.ttl', '.xml', '.json', '.md', '.txt'];

export const OWL_ACCEPT_ATTR =
  '.owl,.rdf,.ttl,.xml,.json,.md,.txt,text/plain,text/markdown,text/turtle,application/rdf+xml,application/owl+xml,application/json,application/xml,text/xml';

export const OWL_FORMATS_LABEL = '.owl, .rdf, .ttl, .json, .xml, .md, .txt';

export const OWL_FORMATS_HINT = 'OWL classes and properties. Education/research only.';

export const OWL_MAX_FILE_BYTES = 20 * 1024 * 1024;

export const OWL_RELATED_TOOLS: ReadonlyArray<OwlRelatedToolLink> = [
  { label: 'RDF Viewer', description: 'Triples and graphs', path: '/diagram-viewers/rdf-viewer' },
  { label: 'Knowledge Graph Viewer', description: 'Entities and links', path: '/diagram-viewers/knowledge-graph-viewer' },
  { label: 'Class Diagram Viewer', description: 'Types and relations', path: '/diagram-viewers/class-diagram-viewer' },
  { label: 'Concept Map Viewer', description: 'Concepts and links', path: '/diagram-viewers/concept-map-viewer' }
];
