import { DIO_SAMPLE } from '../constants/draw-io-viewer-sample.data';
import { DIO_MAX_FILE_BYTES, DIO_SUPPORTED_EXTENSIONS } from '../constants/draw-io-viewer.constants';
import type {
  DioConnector,
  DioDataset,
  DioLoadedFile,
  DioMetadataRow,
  DioPage,
  DioShape,
  DioSuggestion
} from '../types/draw-io-viewer.types';
import { parseDrawioBytes } from './draw-io-viewer-parse.utils';
import { bytesToText, formatDiagramFileSize, getDiagramFileExtension } from './diagram-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatDiagramFileSize as formatDioFileSize,
  readFileBytes as readDioFileBytes
} from './diagram-file.utils';

export {
  filterDioConnectors,
  filterDioPages,
  filterDioShapes,
  parseDrawioBytes,
  parseDrawioText
} from './draw-io-viewer-parse.utils';
export {
  dioShapeColor,
  renderDioConnectors,
  renderDioDiagram,
  renderDioPages,
  renderDioShapes
} from './draw-io-viewer-render.utils';

export function isSupportedDioFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (DIO_SUPPORTED_EXTENSIONS as readonly string[]).includes(getDiagramFileExtension(file.name));
}

export function validateDioFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > DIO_MAX_FILE_BYTES) return `File is too large (max ${formatDiagramFileSize(DIO_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidDioFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed draw.io files are not supported — decompress first' });
      continue;
    }
    if (!isSupportedDioFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .drawio, .dio, .xml, .svg, .json, .md, or .txt)' });
      continue;
    }
    const sizeError = validateDioFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleDioFile(): File {
  return new File([DIO_SAMPLE], 'sample-shop.drawio', { type: 'application/xml', lastModified: 0 });
}

export function createDioFileRecord(file: File, bytes: Uint8Array): DioLoadedFile {
  const extension = getDiagramFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: DioDataset | null = null;
  let softFail = false;
  try {
    parsed = parseDrawioBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.pages.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse draw.io diagram');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportDio(file: DioLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildDioMetadataRows(dataset: DioDataset): DioMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Title', value: dataset.title || '—' },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Pages', value: String(dataset.pages.length) },
    { key: 'Shapes', value: String(dataset.shapes.length) },
    { key: 'Connectors', value: String(dataset.connectors.length) }
  ];
}

export function buildDioPageMetadata(page: DioPage): DioMetadataRow[] {
  return [
    { key: 'Id', value: page.id },
    { key: 'Name', value: page.name },
    { key: 'Size', value: `${page.width} × ${page.height}` },
    { key: 'Shapes', value: String(page.shapeCount) },
    { key: 'Connectors', value: String(page.connectorCount) }
  ];
}

export function buildDioShapeMetadata(shape: DioShape): DioMetadataRow[] {
  return [
    { key: 'Id', value: shape.id },
    { key: 'Label', value: shape.label },
    { key: 'Page', value: shape.pageName },
    { key: 'Size', value: `${Math.round(shape.width)} × ${Math.round(shape.height)}` }
  ];
}

export function buildDioConnectorMetadata(connector: DioConnector): DioMetadataRow[] {
  return [
    { key: 'From', value: connector.sourceName || connector.source },
    { key: 'To', value: connector.targetName || connector.target },
    { key: 'Label', value: connector.label || '—' },
    { key: 'Page', value: connector.pageName }
  ];
}

export function exportDioSummaryJson(file: DioLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed draw.io diagram');
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

export function exportDioShapesCsv(dataset: DioDataset): string {
  const lines = ['index,id,label,page,x,y,width,height'];
  for (const s of dataset.shapes) {
    lines.push([s.index + 1, csv(s.id), csv(s.label), csv(s.pageName), s.x, s.y, s.width, s.height].join(','));
  }
  return lines.join('\n');
}

export function exportDioConnectorsCsv(dataset: DioDataset): string {
  const lines = ['index,source,target,label,page'];
  for (const c of dataset.connectors) {
    lines.push([c.index + 1, csv(c.source), csv(c.target), csv(c.label), csv(c.pageName)].join(','));
  }
  return lines.join('\n');
}

export function resolveDioSuggestion(state: { hasFiles: boolean; hasError: boolean }): DioSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the shop draw.io sample',
      reason: 'Load a local multi-page diagram of Shop and Payments with zoom.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a draw.io diagram',
      reason: 'Drop .drawio, .dio, XML, or SVG — or load the sample shop diagram.',
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
