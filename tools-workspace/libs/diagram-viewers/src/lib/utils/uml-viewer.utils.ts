import { UML_CLASS_SAMPLE } from '../constants/uml-viewer-sample.data';
import { UML_MAX_FILE_BYTES, UML_SUPPORTED_EXTENSIONS } from '../constants/uml-viewer.constants';
import type {
  UmlDataset,
  UmlLink,
  UmlLoadedFile,
  UmlMetadataRow,
  UmlNode,
  UmlSuggestion
} from '../types/uml-viewer.types';
import { parseUmlBytes } from './uml-viewer-parse.utils';
import { bytesToText, formatDiagramFileSize, getDiagramFileExtension } from './diagram-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatDiagramFileSize as formatUmlFileSize,
  readFileBytes as readUmlFileBytes
} from './diagram-file.utils';

export { filterUmlLinks, filterUmlNodes, parseUmlBytes, parseUmlText } from './uml-viewer-parse.utils';
export { renderUmlClassDiagram, renderUmlLinks, renderUmlNodes, renderUmlSequence, umlNodeColor } from './uml-viewer-render.utils';

export function isSupportedUmlFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (UML_SUPPORTED_EXTENSIONS as readonly string[]).includes(getDiagramFileExtension(file.name));
}

export function validateUmlFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > UML_MAX_FILE_BYTES) return `File is too large (max ${formatDiagramFileSize(UML_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidUmlFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed UML files are not supported — decompress first' });
      continue;
    }
    if (!isSupportedUmlFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .uml, .puml, .xmi, .xml, .md, .txt, or .json)' });
      continue;
    }
    const sizeError = validateUmlFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleUmlFile(): File {
  return new File([UML_CLASS_SAMPLE], 'sample-order-uml.puml', { type: 'text/plain', lastModified: 0 });
}

export function createUmlFileRecord(file: File, bytes: Uint8Array): UmlLoadedFile {
  const extension = getDiagramFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: UmlDataset | null = null;
  let softFail = false;
  try {
    parsed = parseUmlBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.nodes.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse UML diagram');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportUml(file: UmlLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildUmlMetadataRows(dataset: UmlDataset): UmlMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Title', value: dataset.title || '—' },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Kind', value: dataset.kind },
    { key: 'Classifiers', value: String(dataset.nodes.filter((n) => n.kind === 'class' || n.kind === 'interface' || n.kind === 'enum').length) },
    { key: 'Lifelines', value: String(dataset.nodes.filter((n) => n.kind === 'actor' || n.kind === 'participant').length) },
    { key: 'Links', value: String(dataset.links.length) }
  ];
}

export function buildUmlNodeMetadata(node: UmlNode): UmlMetadataRow[] {
  return [
    { key: 'Id', value: node.id },
    { key: 'Name', value: node.name },
    { key: 'Kind', value: node.kind },
    { key: 'Members', value: node.members.length ? node.members.join(', ') : '—' }
  ];
}

export function buildUmlLinkMetadata(link: UmlLink): UmlMetadataRow[] {
  return [
    { key: 'From', value: link.sourceName || link.source },
    { key: 'To', value: link.targetName || link.target },
    { key: 'Label', value: link.label || '—' },
    { key: 'Style', value: link.style },
    { key: 'Kind', value: link.linkKind }
  ];
}

export function exportUmlSummaryJson(file: UmlLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed UML diagram');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      kind: parsed.kind,
      title: parsed.title,
      nodes: parsed.nodes.map((n) => ({ id: n.id, name: n.name, kind: n.kind, members: n.members })),
      links: parsed.links.map((l) => ({
        source: l.source,
        target: l.target,
        label: l.label,
        style: l.style,
        linkKind: l.linkKind
      }))
    },
    null,
    2
  );
}

export function exportUmlClassifiersCsv(dataset: UmlDataset): string {
  const lines = ['index,id,name,kind,members'];
  for (const n of dataset.nodes) {
    lines.push([n.index + 1, csv(n.id), csv(n.name), n.kind, csv(n.members.join('|'))].join(','));
  }
  return lines.join('\n');
}

export function exportUmlLinksCsv(dataset: UmlDataset): string {
  const lines = ['index,source,target,label,style,link_kind'];
  for (const l of dataset.links) {
    lines.push([l.index + 1, csv(l.source), csv(l.target), csv(l.label), l.style, l.linkKind].join(','));
  }
  return lines.join('\n');
}

export function resolveUmlSuggestion(state: { hasFiles: boolean; hasError: boolean }): UmlSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the order UML sample',
      reason: 'Load a local class diagram with Customer, Order, and Payable.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a UML diagram',
      reason: 'Drop .uml, .puml, XMI, Markdown, or JSON — or load the sample order domain.',
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
