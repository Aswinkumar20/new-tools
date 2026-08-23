import type { DepRelatedToolLink } from '../types/dependency-graph-viewer.types';

export const DEP_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.json', '.lock', '.yaml', '.yml', '.xml', '.md', '.txt', '.dot'];

export const DEP_ACCEPT_ATTR =
  '.json,.lock,.yaml,.yml,.xml,.md,.txt,.dot,text/plain,text/markdown,application/json,application/xml,text/xml,text/yaml,text/vnd.graphviz';

export const DEP_FORMATS_LABEL = 'package-lock.json, yarn.lock, package.json, .json, .xml, .md, .txt';

export const DEP_FORMATS_HINT = 'Package dependency trees and cycles. Education/research only.';

export const DEP_MAX_FILE_BYTES = 20 * 1024 * 1024;

export const DEP_RELATED_TOOLS: ReadonlyArray<DepRelatedToolLink> = [
  { label: 'Terraform Graph Viewer', description: 'Infra dependency graphs', path: '/diagram-viewers/terraform-graph-viewer' },
  { label: 'Graphviz DOT Viewer', description: 'DOT graphs', path: '/diagram-viewers/graphviz-dot-viewer' },
  { label: 'Kubernetes Architecture Viewer', description: 'Cluster workloads', path: '/diagram-viewers/kubernetes-architecture-viewer' },
  { label: 'GraphML Viewer', description: 'Graph nodes and edges', path: '/diagram-viewers/graphml-viewer' }
];
