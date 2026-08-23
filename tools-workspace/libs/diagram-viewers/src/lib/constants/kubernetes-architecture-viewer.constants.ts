import type { K8sRelatedToolLink } from '../types/kubernetes-architecture-viewer.types';

export const K8S_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.yaml', '.yml', '.json', '.xml', '.md', '.txt'];

export const K8S_ACCEPT_ATTR =
  '.yaml,.yml,.json,.xml,.md,.txt,text/plain,text/markdown,text/yaml,application/json,application/xml,text/xml,application/x-yaml';

export const K8S_FORMATS_LABEL = '.yaml, .yml, .json, .xml, .md, .txt';

export const K8S_FORMATS_HINT = 'Kubernetes workloads and services. Education/research only.';

export const K8S_MAX_FILE_BYTES = 20 * 1024 * 1024;

export const K8S_RELATED_TOOLS: ReadonlyArray<K8sRelatedToolLink> = [
  { label: 'Terraform Graph Viewer', description: 'Infra dependency graphs', path: '/diagram-viewers/terraform-graph-viewer' },
  { label: 'Architecture Diagram Viewer', description: 'Boxes and connectors', path: '/diagram-viewers/architecture-diagram-viewer' },
  { label: 'C4 Model Viewer', description: 'Context and containers', path: '/diagram-viewers/c4-model-viewer' },
  { label: 'Dependency Graph Viewer', description: 'Package graphs', path: '/diagram-viewers/dependency-graph-viewer' }
];
