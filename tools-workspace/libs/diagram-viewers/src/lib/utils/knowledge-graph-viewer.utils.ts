import { KG_SAMPLE } from '../constants/knowledge-graph-viewer-sample.data';
import { KG_MAX_FILE_BYTES, KG_SUPPORTED_EXTENSIONS } from '../constants/knowledge-graph-viewer.constants';
import type { KgDataset, KgEntity, KgLink, KgLoadedFile, KgMetadataRow, KgSuggestion } from '../types/knowledge-graph-viewer.types';
import { parseKnowledgeGraphBytes } from './knowledge-graph-viewer-parse.utils';
import { bytesToText, formatDiagramFileSize, getDiagramFileExtension } from './diagram-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatDiagramFileSize as formatKgFileSize,
  readFileBytes as readKgFileBytes
} from './diagram-file.utils';

export {
  filterKgEntities,
  filterKgLinks,
  parseKnowledgeGraphBytes,
  parseKnowledgeGraphText
} from './knowledge-graph-viewer-parse.utils';
export { kgEntityColor, renderKgDiagram, renderKgEntities, renderKgLinks } from './knowledge-graph-viewer-render.utils';

export function isSupportedKgFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (KG_SUPPORTED_EXTENSIONS as readonly string[]).includes(getDiagramFileExtension(file.name));
}

export function validateKgFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > KG_MAX_FILE_BYTES) return `File is too large (max ${formatDiagramFileSize(KG_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidKgFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed knowledge graph files are not supported — decompress first' });
      continue;
    }
    if (!isSupportedKgFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .json, .xml, .csv, .md, or .txt)' });
      continue;
    }
    const sizeError = validateKgFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleKgFile(): File {
  return new File([KG_SAMPLE], 'sample-shop-kg.json', { type: 'application/json', lastModified: 0 });
}

export function createKgFileRecord(file: File, bytes: Uint8Array): KgLoadedFile {
  const extension = getDiagramFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: KgDataset | null = null;
  let softFail = false;
  try {
    parsed = parseKnowledgeGraphBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.entities.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse knowledge graph');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportKg(file: KgLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildKgMetadataRows(dataset: KgDataset): KgMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Title', value: dataset.title || '—' },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Entities', value: String(dataset.entities.length) },
    { key: 'Links', value: String(dataset.links.length) }
  ];
}

export function buildKgEntityMetadata(entity: KgEntity): KgMetadataRow[] {
  return [
    { key: 'Id', value: entity.id },
    { key: 'Name', value: entity.name },
    { key: 'Type', value: entity.type },
    { key: 'Label', value: entity.label || '—' }
  ];
}

export function buildKgLinkMetadata(link: KgLink): KgMetadataRow[] {
  return [
    { key: 'From', value: link.sourceName || link.source },
    { key: 'Rel', value: link.rel },
    { key: 'To', value: link.targetName || link.target }
  ];
}

export function exportKgSummaryJson(file: KgLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed knowledge graph');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      title: parsed.title,
      entities: parsed.entities.map((e) => ({ id: e.id, name: e.name, type: e.type, label: e.label })),
      links: parsed.links.map((l) => ({ source: l.source, target: l.target, rel: l.rel }))
    },
    null,
    2
  );
}

export function exportKgEntitiesCsv(dataset: KgDataset): string {
  const lines = ['index,id,name,type,label'];
  for (const e of dataset.entities) {
    lines.push([e.index + 1, csv(e.id), csv(e.name), csv(e.type), csv(e.label)].join(','));
  }
  return lines.join('\n');
}

export function exportKgLinksCsv(dataset: KgDataset): string {
  const lines = ['index,source,rel,target'];
  for (const l of dataset.links) {
    lines.push([l.index + 1, csv(l.sourceName), csv(l.rel), csv(l.targetName)].join(','));
  }
  return lines.join('\n');
}

export function resolveKgSuggestion(state: { hasFiles: boolean; hasError: boolean }): KgSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the shop knowledge graph sample',
      reason: 'Load a local Web/Api/Catalog graph with uses and dependsOn links.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a knowledge graph',
      reason: 'Drop JSON, XML, or CSV — or load the sample shop graph.',
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
