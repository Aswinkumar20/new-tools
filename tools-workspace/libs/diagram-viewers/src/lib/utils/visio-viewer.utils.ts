import { VSD_SAMPLE } from '../constants/visio-viewer-sample.data';
import { VSD_MAX_FILE_BYTES, VSD_SUPPORTED_EXTENSIONS } from '../constants/visio-viewer.constants';
import type {
  VsdConnector,
  VsdDataset,
  VsdLoadedFile,
  VsdMetadataRow,
  VsdPage,
  VsdShape,
  VsdSuggestion
} from '../types/visio-viewer.types';
import { parseVisioBytes } from './visio-viewer-parse.utils';
import { bytesToText, formatDiagramFileSize, getDiagramFileExtension } from './diagram-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatDiagramFileSize as formatVsdFileSize,
  readFileBytes as readVsdFileBytes
} from './diagram-file.utils';

export {
  filterVsdConnectors,
  filterVsdPages,
  filterVsdShapes,
  parseVisioBytes,
  parseVisioText
} from './visio-viewer-parse.utils';
export {
  renderVsdConnectors,
  renderVsdDiagram,
  renderVsdPages,
  renderVsdShapes,
  vsdShapeColor
} from './visio-viewer-render.utils';

export function isSupportedVsdFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (VSD_SUPPORTED_EXTENSIONS as readonly string[]).includes(getDiagramFileExtension(file.name));
}

export function validateVsdFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > VSD_MAX_FILE_BYTES) return `File is too large (max ${formatDiagramFileSize(VSD_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidVsdFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed Visio files are not supported — decompress first' });
      continue;
    }
    if (!isSupportedVsdFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .vdx, .vsdx, .vsx, .xml, .json, .md, or .txt)' });
      continue;
    }
    const sizeError = validateVsdFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleVsdFile(): File {
  return new File([VSD_SAMPLE], 'sample-shop.vdx', { type: 'application/xml', lastModified: 0 });
}

export function createVsdFileRecord(file: File, bytes: Uint8Array): VsdLoadedFile {
  const extension = getDiagramFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: VsdDataset | null = null;
  let softFail = false;
  try {
    parsed = parseVisioBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.pages.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse Visio diagram');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportVsd(file: VsdLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildVsdMetadataRows(dataset: VsdDataset): VsdMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Title', value: dataset.title || '—' },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Pages', value: String(dataset.pages.length) },
    { key: 'Shapes', value: String(dataset.shapes.length) },
    { key: 'Connectors', value: String(dataset.connectors.length) }
  ];
}

export function buildVsdPageMetadata(page: VsdPage): VsdMetadataRow[] {
  return [
    { key: 'Id', value: page.id },
    { key: 'Name', value: page.name },
    { key: 'Size', value: `${Math.round(page.width)} × ${Math.round(page.height)}` },
    { key: 'Shapes', value: String(page.shapeCount) },
    { key: 'Connectors', value: String(page.connectorCount) }
  ];
}

export function buildVsdShapeMetadata(shape: VsdShape): VsdMetadataRow[] {
  return [
    { key: 'Id', value: shape.id },
    { key: 'Label', value: shape.label },
    { key: 'Page', value: shape.pageName },
    { key: 'Master', value: shape.master || '—' },
    { key: 'Size', value: `${Math.round(shape.width)} × ${Math.round(shape.height)}` }
  ];
}

export function buildVsdConnectorMetadata(connector: VsdConnector): VsdMetadataRow[] {
  return [
    { key: 'From', value: connector.sourceName || connector.source },
    { key: 'To', value: connector.targetName || connector.target },
    { key: 'Label', value: connector.label || '—' },
    { key: 'Page', value: connector.pageName }
  ];
}

export function exportVsdSummaryJson(file: VsdLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed Visio diagram');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      title: parsed.title,
      pages: parsed.pages.map((p) => ({ id: p.id, name: p.name, shapes: p.shapeCount, connectors: p.connectorCount })),
      shapes: parsed.shapes.map((s) => ({ id: s.id, label: s.label, page: s.pageName, x: s.x, y: s.y })),
      connectors: parsed.connectors.map((c) => ({ source: c.source, target: c.target, label: c.label, page: c.pageName }))
    },
    null,
    2
  );
}

export function exportVsdShapesCsv(dataset: VsdDataset): string {
  const lines = ['index,id,label,page,master,x,y,width,height'];
  for (const s of dataset.shapes) {
    lines.push([s.index + 1, csv(s.id), csv(s.label), csv(s.pageName), csv(s.master), s.x, s.y, s.width, s.height].join(','));
  }
  return lines.join('\n');
}

export function exportVsdConnectorsCsv(dataset: VsdDataset): string {
  const lines = ['index,source,target,label,page'];
  for (const c of dataset.connectors) {
    lines.push([c.index + 1, csv(c.source), csv(c.target), csv(c.label), csv(c.pageName)].join(','));
  }
  return lines.join('\n');
}

export function resolveVsdSuggestion(state: { hasFiles: boolean; hasError: boolean }): VsdSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the shop Visio sample',
      reason: 'Load a local multi-page Visio XML drawing of Shop and Payments.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a Visio diagram',
      reason: 'Drop .vdx, page XML, or JSON — or load the sample shop drawing. Binary .vsdx zips need a .vdx export.',
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
