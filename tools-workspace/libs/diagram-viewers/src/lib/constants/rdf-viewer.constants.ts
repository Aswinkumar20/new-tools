import type { RdfRelatedToolLink } from '../types/rdf-viewer.types';

export const RDF_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = [
  '.rdf',
  '.ttl',
  '.nt',
  '.json',
  '.jsonld',
  '.xml',
  '.md',
  '.txt'
];

export const RDF_ACCEPT_ATTR =
  '.rdf,.ttl,.nt,.json,.jsonld,.xml,.md,.txt,text/plain,text/markdown,text/turtle,application/rdf+xml,application/json,application/ld+json,application/xml,text/xml';

export const RDF_FORMATS_LABEL = '.rdf, .ttl, .nt, .json, .xml, .md, .txt';

export const RDF_FORMATS_HINT = 'RDF triples and graphs. Education/research only.';

export const RDF_MAX_FILE_BYTES = 20 * 1024 * 1024;

export const RDF_RELATED_TOOLS: ReadonlyArray<RdfRelatedToolLink> = [
  { label: 'OWL Ontology Viewer', description: 'Classes and properties', path: '/diagram-viewers/owl-ontology-viewer' },
  { label: 'Knowledge Graph Viewer', description: 'Entities and links', path: '/diagram-viewers/knowledge-graph-viewer' },
  { label: 'GraphML Viewer', description: 'Graph nodes and edges', path: '/diagram-viewers/graphml-viewer' },
  { label: 'Dependency Graph Viewer', description: 'Package graphs', path: '/diagram-viewers/dependency-graph-viewer' }
];
