import type { TfRelatedToolLink } from '../types/terraform-graph-viewer.types';

export const TF_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.dot', '.gv', '.tfgraph', '.json', '.xml', '.md', '.txt'];

export const TF_ACCEPT_ATTR =
  '.dot,.gv,.tfgraph,.json,.xml,.md,.txt,text/plain,text/markdown,application/json,application/xml,text/xml,text/vnd.graphviz';

export const TF_FORMATS_LABEL = '.dot, .gv, .tfgraph, .json, .xml, .md, .txt';

export const TF_FORMATS_HINT = 'Terraform graph resources and edges. Education/research only.';

export const TF_MAX_FILE_BYTES = 20 * 1024 * 1024;

export const TF_RELATED_TOOLS: ReadonlyArray<TfRelatedToolLink> = [
  { label: 'Graphviz DOT Viewer', description: 'DOT graphs', path: '/diagram-viewers/graphviz-dot-viewer' },
  { label: 'Kubernetes Architecture Viewer', description: 'Cluster workloads', path: '/diagram-viewers/kubernetes-architecture-viewer' },
  { label: 'Dependency Graph Viewer', description: 'Package graphs', path: '/diagram-viewers/dependency-graph-viewer' },
  { label: 'Architecture Diagram Viewer', description: 'Boxes and connectors', path: '/diagram-viewers/architecture-diagram-viewer' }
];
