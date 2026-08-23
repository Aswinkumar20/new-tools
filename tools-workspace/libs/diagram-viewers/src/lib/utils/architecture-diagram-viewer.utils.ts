import { ARCH_PUML_SAMPLE } from '../constants/architecture-diagram-viewer-sample.data';
import { ARCH_MAX_FILE_BYTES, ARCH_SUPPORTED_EXTENSIONS } from '../constants/architecture-diagram-viewer.constants';
import type {
  ArchBox,
  ArchConnector,
  ArchDataset,
  ArchLoadedFile,
  ArchMetadataRow,
  ArchSuggestion
} from '../types/architecture-diagram-viewer.types';
import { parseArchitectureBytes } from './architecture-diagram-viewer-parse.utils';
import { bytesToText, formatDiagramFileSize, getDiagramFileExtension } from './diagram-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatDiagramFileSize as formatArchFileSize,
  readFileBytes as readArchFileBytes
} from './diagram-file.utils';

export {
  filterArchBoxes,
  filterArchConnectors,
  parseArchitectureBytes,
  parseArchitectureText
} from './architecture-diagram-viewer-parse.utils';
export { archBoxColor, renderArchBoxes, renderArchConnectors, renderArchDiagram } from './architecture-diagram-viewer-render.utils';

export function isSupportedArchFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (ARCH_SUPPORTED_EXTENSIONS as readonly string[]).includes(getDiagramFileExtension(file.name));
}

export function validateArchFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > ARCH_MAX_FILE_BYTES) return `File is too large (max ${formatDiagramFileSize(ARCH_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidArchFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed architecture files are not supported — decompress first' });
      continue;
    }
    if (!isSupportedArchFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .puml, .arch, .mmd, .md, .txt, .json, or .xml)' });
      continue;
    }
    const sizeError = validateArchFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleArchFile(): File {
  return new File([ARCH_PUML_SAMPLE], 'sample-shop-arch.puml', { type: 'text/plain', lastModified: 0 });
}

export function createArchFileRecord(file: File, bytes: Uint8Array): ArchLoadedFile {
  const extension = getDiagramFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: ArchDataset | null = null;
  let softFail = false;
  try {
    parsed = parseArchitectureBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.boxes.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse architecture diagram');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportArch(file: ArchLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildArchMetadataRows(dataset: ArchDataset): ArchMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Title', value: dataset.title || '—' },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Boxes', value: String(dataset.boxes.length) },
    { key: 'Connectors', value: String(dataset.connectors.length) }
  ];
}

export function buildArchBoxMetadata(box: ArchBox): ArchMetadataRow[] {
  return [
    { key: 'Id', value: box.id },
    { key: 'Name', value: box.name },
    { key: 'Kind', value: box.kind },
    { key: 'Stereotype', value: box.stereotype || '—' }
  ];
}

export function buildArchConnectorMetadata(connector: ArchConnector): ArchMetadataRow[] {
  return [
    { key: 'From', value: connector.sourceName || connector.source },
    { key: 'To', value: connector.targetName || connector.target },
    { key: 'Label', value: connector.label || '—' },
    { key: 'Style', value: connector.style }
  ];
}

export function exportArchSummaryJson(file: ArchLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed architecture diagram');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      title: parsed.title,
      boxes: parsed.boxes.map((b) => ({ id: b.id, name: b.name, kind: b.kind, stereotype: b.stereotype })),
      connectors: parsed.connectors.map((c) => ({
        source: c.source,
        target: c.target,
        label: c.label,
        style: c.style
      }))
    },
    null,
    2
  );
}

export function exportArchBoxesCsv(dataset: ArchDataset): string {
  const lines = ['index,id,name,kind,stereotype'];
  for (const b of dataset.boxes) {
    lines.push([b.index + 1, csv(b.id), csv(b.name), b.kind, csv(b.stereotype)].join(','));
  }
  return lines.join('\n');
}

export function exportArchConnectorsCsv(dataset: ArchDataset): string {
  const lines = ['index,source,target,label,style'];
  for (const c of dataset.connectors) {
    lines.push([c.index + 1, csv(c.source), csv(c.target), csv(c.label), c.style].join(','));
  }
  return lines.join('\n');
}

export function resolveArchSuggestion(state: { hasFiles: boolean; hasError: boolean }): ArchSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the shop architecture sample',
      reason: 'Load a local box-and-connector view of Web, API, Orders, and Payments.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open an architecture diagram',
      reason: 'Drop .puml, Mermaid, JSON, or XML — or load the sample shop architecture.',
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
