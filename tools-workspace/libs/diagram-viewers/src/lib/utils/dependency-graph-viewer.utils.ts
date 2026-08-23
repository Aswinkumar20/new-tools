import { DEP_SAMPLE } from '../constants/dependency-graph-viewer-sample.data';
import { DEP_MAX_FILE_BYTES, DEP_SUPPORTED_EXTENSIONS } from '../constants/dependency-graph-viewer.constants';
import type {
  DepCycle,
  DepDataset,
  DepEdge,
  DepLoadedFile,
  DepMetadataRow,
  DepPackage,
  DepSuggestion
} from '../types/dependency-graph-viewer.types';
import { parseDependencyGraphBytes } from './dependency-graph-viewer-parse.utils';
import { bytesToText, formatDiagramFileSize, getDiagramFileExtension } from './diagram-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatDiagramFileSize as formatDepFileSize,
  readFileBytes as readDepFileBytes
} from './diagram-file.utils';

export {
  filterDepCycles,
  filterDepEdges,
  filterDepPackages,
  filterDepTree,
  parseDependencyGraphBytes,
  parseDependencyGraphText
} from './dependency-graph-viewer-parse.utils';
export {
  depPackageColor,
  renderDepCycles,
  renderDepDiagram,
  renderDepEdges,
  renderDepTree
} from './dependency-graph-viewer-render.utils';

export function isSupportedDepFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  const base = file.name.split(/[/\\]/).pop()?.toLowerCase() || '';
  if (base === 'yarn.lock' || base === 'package-lock.json' || base === 'package.json' || base === 'pnpm-lock.yaml') return true;
  return (DEP_SUPPORTED_EXTENSIONS as readonly string[]).includes(getDiagramFileExtension(file.name));
}

export function validateDepFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > DEP_MAX_FILE_BYTES) return `File is too large (max ${formatDiagramFileSize(DEP_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidDepFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed lockfiles are not supported — decompress first' });
      continue;
    }
    if (!isSupportedDepFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use package-lock.json, yarn.lock, package.json, .json, .xml, .md, or .txt)' });
      continue;
    }
    const sizeError = validateDepFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleDepFile(): File {
  return new File([DEP_SAMPLE], 'sample-shop-lock.json', { type: 'application/json', lastModified: 0 });
}

export function createDepFileRecord(file: File, bytes: Uint8Array): DepLoadedFile {
  const extension = getDiagramFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: DepDataset | null = null;
  let softFail = false;
  try {
    parsed = parseDependencyGraphBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.packages.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse dependency graph');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportDep(file: DepLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildDepMetadataRows(dataset: DepDataset): DepMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Title', value: dataset.title || '—' },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Packages', value: String(dataset.packages.length) },
    { key: 'Edges', value: String(dataset.edges.length) },
    { key: 'Cycles', value: String(dataset.cycles.length) }
  ];
}

export function buildDepPackageMetadata(pkg: DepPackage): DepMetadataRow[] {
  return [
    { key: 'Id', value: pkg.id },
    { key: 'Name', value: pkg.name },
    { key: 'Version', value: pkg.version || '—' },
    { key: 'Kind', value: pkg.kind }
  ];
}

export function buildDepEdgeMetadata(edge: DepEdge): DepMetadataRow[] {
  return [
    { key: 'From', value: edge.sourceName || edge.source },
    { key: 'To', value: edge.targetName || edge.target },
    { key: 'Spec', value: edge.spec || '—' }
  ];
}

export function buildDepCycleMetadata(cycle: DepCycle): DepMetadataRow[] {
  return [
    { key: 'Path', value: cycle.path },
    { key: 'Nodes', value: String(Math.max(0, cycle.nodes.length - 1)) }
  ];
}

export function exportDepSummaryJson(file: DepLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed dependency graph');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      title: parsed.title,
      packages: parsed.packages.map((p) => ({ id: p.id, name: p.name, version: p.version, kind: p.kind })),
      edges: parsed.edges.map((e) => ({ source: e.source, target: e.target, spec: e.spec })),
      cycles: parsed.cycles.map((c) => c.path)
    },
    null,
    2
  );
}

export function exportDepPackagesCsv(dataset: DepDataset): string {
  const lines = ['index,id,name,version,kind'];
  for (const p of dataset.packages) {
    lines.push([p.index + 1, csv(p.id), csv(p.name), csv(p.version), p.kind].join(','));
  }
  return lines.join('\n');
}

export function exportDepEdgesCsv(dataset: DepDataset): string {
  const lines = ['index,source,target,spec'];
  for (const e of dataset.edges) {
    lines.push([e.index + 1, csv(e.source), csv(e.target), csv(e.spec)].join(','));
  }
  return lines.join('\n');
}

export function resolveDepSuggestion(state: { hasFiles: boolean; hasError: boolean }): DepSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the shop lockfile sample',
      reason: 'Load a local package-lock graph with a detectable cycle.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a dependency graph',
      reason: 'Drop package-lock.json, yarn.lock, or package.json — or load the sample shop graph.',
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
