import { K8S_SAMPLE } from '../constants/kubernetes-architecture-viewer-sample.data';
import { K8S_MAX_FILE_BYTES, K8S_SUPPORTED_EXTENSIONS } from '../constants/kubernetes-architecture-viewer.constants';
import type {
  K8sDataset,
  K8sLink,
  K8sLoadedFile,
  K8sMetadataRow,
  K8sService,
  K8sSuggestion,
  K8sWorkload
} from '../types/kubernetes-architecture-viewer.types';
import { parseKubernetesBytes } from './kubernetes-architecture-viewer-parse.utils';
import { bytesToText, formatDiagramFileSize, getDiagramFileExtension } from './diagram-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatDiagramFileSize as formatK8sFileSize,
  readFileBytes as readK8sFileBytes
} from './diagram-file.utils';

export {
  filterK8sLinks,
  filterK8sServices,
  filterK8sWorkloads,
  parseKubernetesBytes,
  parseKubernetesText
} from './kubernetes-architecture-viewer-parse.utils';
export {
  k8sNodeColor,
  renderK8sDiagram,
  renderK8sLinks,
  renderK8sServices,
  renderK8sWorkloads
} from './kubernetes-architecture-viewer-render.utils';

export function isSupportedK8sFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (K8S_SUPPORTED_EXTENSIONS as readonly string[]).includes(getDiagramFileExtension(file.name));
}

export function validateK8sFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > K8S_MAX_FILE_BYTES) return `File is too large (max ${formatDiagramFileSize(K8S_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidK8sFiles(files: FileList | File[]): {
  accepted: File[];
  rejected: Array<{ name: string; reason: string }>;
} {
  const accepted: File[] = [];
  const rejected: Array<{ name: string; reason: string }> = [];
  const seen = new Set<string>();
  for (const file of Array.from(files)) {
    const key = `${file.name}|${file.size}|${file.lastModified}`;
    if (seen.has(key)) {
      rejected.push({ name: file.name, reason: 'Duplicate file in this selection' });
      continue;
    }
    seen.add(key);
    if (/\.gz$/i.test(file.name)) {
      rejected.push({ name: file.name, reason: 'Compressed Kubernetes files are not supported — decompress first' });
      continue;
    }
    if (!isSupportedK8sFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .yaml, .yml, .json, .xml, .md, or .txt)' });
      continue;
    }
    const sizeError = validateK8sFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleK8sFile(): File {
  return new File([K8S_SAMPLE], 'sample-shop.yaml', { type: 'text/yaml', lastModified: 0 });
}

export function createK8sFileRecord(file: File, bytes: Uint8Array): K8sLoadedFile {
  const extension = getDiagramFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: K8sDataset | null = null;
  let softFail = false;
  try {
    parsed = parseKubernetesBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.workloads.length && !parsed.services.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse Kubernetes manifest');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportK8s(file: K8sLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildK8sMetadataRows(dataset: K8sDataset): K8sMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Title', value: dataset.title || '—' },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Workloads', value: String(dataset.workloads.length) },
    { key: 'Services', value: String(dataset.services.length) },
    { key: 'Links', value: String(dataset.links.length) }
  ];
}

export function buildK8sWorkloadMetadata(workload: K8sWorkload): K8sMetadataRow[] {
  return [
    { key: 'Id', value: workload.id },
    { key: 'Name', value: workload.name },
    { key: 'Kind', value: workload.kind },
    { key: 'Namespace', value: workload.namespace },
    { key: 'Replicas', value: String(workload.replicas) },
    { key: 'Labels', value: Object.entries(workload.labels).map(([k, v]) => `${k}=${v}`).join(', ') || '—' }
  ];
}

export function buildK8sServiceMetadata(service: K8sService): K8sMetadataRow[] {
  return [
    { key: 'Id', value: service.id },
    { key: 'Name', value: service.name },
    { key: 'Kind', value: service.kind },
    { key: 'Namespace', value: service.namespace },
    { key: 'Type', value: service.type || '—' },
    { key: 'Ports', value: service.ports || '—' },
    { key: 'Selector', value: Object.entries(service.selector).map(([k, v]) => `${k}=${v}`).join(', ') || '—' }
  ];
}

export function buildK8sLinkMetadata(link: K8sLink): K8sMetadataRow[] {
  return [
    { key: 'From', value: link.sourceName || link.source },
    { key: 'To', value: link.targetName || link.target },
    { key: 'Rel', value: link.rel }
  ];
}

export function exportK8sSummaryJson(file: K8sLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed Kubernetes manifest');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      title: parsed.title,
      workloads: parsed.workloads.map((w) => ({ id: w.id, name: w.name, kind: w.kind, namespace: w.namespace, replicas: w.replicas })),
      services: parsed.services.map((s) => ({ id: s.id, name: s.name, kind: s.kind, namespace: s.namespace, ports: s.ports })),
      links: parsed.links.map((l) => ({ source: l.source, target: l.target, rel: l.rel }))
    },
    null,
    2
  );
}

export function exportK8sWorkloadsCsv(dataset: K8sDataset): string {
  const lines = ['index,id,name,kind,namespace,replicas'];
  for (const w of dataset.workloads) {
    lines.push([w.index + 1, csv(w.id), csv(w.name), csv(w.kind), csv(w.namespace), w.replicas].join(','));
  }
  return lines.join('\n');
}

export function exportK8sServicesCsv(dataset: K8sDataset): string {
  const lines = ['index,id,name,kind,namespace,type,ports'];
  for (const s of dataset.services) {
    lines.push([s.index + 1, csv(s.id), csv(s.name), csv(s.kind), csv(s.namespace), csv(s.type), csv(s.ports)].join(','));
  }
  return lines.join('\n');
}

export function resolveK8sSuggestion(state: { hasFiles: boolean; hasError: boolean }): K8sSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the shop Kubernetes sample',
      reason: 'Load a local web/api Deployment + Service + Ingress manifest.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a Kubernetes manifest',
      reason: 'Drop YAML, JSON, or XML — or load the sample shop cluster.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  return null;
}

function csv(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
