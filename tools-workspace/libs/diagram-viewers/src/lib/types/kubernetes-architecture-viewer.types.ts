export type K8sViewMode = 'diagram' | 'workloads' | 'services' | 'table';
export type K8sExportFormat = 'original' | 'summary-json' | 'workloads-csv' | 'services-csv' | 'png';
export type K8sSourceKind = 'yaml' | 'json' | 'xml' | 'markdown' | 'txt';
export type K8sLinkRel = 'selects' | 'routes' | 'exposes';

export interface K8sRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface K8sWorkload {
  id: string;
  index: number;
  name: string;
  kind: string;
  namespace: string;
  replicas: number;
  labels: Record<string, string>;
  x: number;
  y: number;
}

export interface K8sService {
  id: string;
  index: number;
  name: string;
  kind: string;
  namespace: string;
  type: string;
  selector: Record<string, string>;
  ports: string;
  x: number;
  y: number;
}

export interface K8sLink {
  id: string;
  index: number;
  source: string;
  target: string;
  sourceName: string;
  targetName: string;
  rel: K8sLinkRel;
}

export interface K8sDataset {
  name: string;
  sourceKind: K8sSourceKind;
  title: string;
  workloads: K8sWorkload[];
  services: K8sService[];
  links: K8sLink[];
  warnings: string[];
}

export interface K8sLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: K8sDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface K8sMetadataRow {
  key: string;
  value: string;
}

export interface K8sSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
