import { RDF_SAMPLE } from '../constants/rdf-viewer-sample.data';
import { RDF_MAX_FILE_BYTES, RDF_SUPPORTED_EXTENSIONS } from '../constants/rdf-viewer.constants';
import type { RdfDataset, RdfLoadedFile, RdfMetadataRow, RdfNode, RdfSuggestion, RdfTriple } from '../types/rdf-viewer.types';
import { parseRdfBytes } from './rdf-viewer-parse.utils';
import { bytesToText, formatDiagramFileSize, getDiagramFileExtension } from './diagram-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatDiagramFileSize as formatRdfFileSize,
  readFileBytes as readRdfFileBytes
} from './diagram-file.utils';

export { filterRdfNodes, filterRdfTriples, parseRdfBytes, parseRdfText } from './rdf-viewer-parse.utils';
export { rdfNodeColor, renderRdfDiagram, renderRdfNodes, renderRdfTriples } from './rdf-viewer-render.utils';

export function isSupportedRdfFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (RDF_SUPPORTED_EXTENSIONS as readonly string[]).includes(getDiagramFileExtension(file.name));
}

export function validateRdfFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > RDF_MAX_FILE_BYTES) return `File is too large (max ${formatDiagramFileSize(RDF_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidRdfFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed RDF files are not supported — decompress first' });
      continue;
    }
    if (!isSupportedRdfFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .rdf, .ttl, .nt, .json, .xml, .md, or .txt)' });
      continue;
    }
    const sizeError = validateRdfFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleRdfFile(): File {
  return new File([RDF_SAMPLE], 'sample-shop.ttl', { type: 'text/turtle', lastModified: 0 });
}

export function createRdfFileRecord(file: File, bytes: Uint8Array): RdfLoadedFile {
  const extension = getDiagramFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: RdfDataset | null = null;
  let softFail = false;
  try {
    parsed = parseRdfBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.triples.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse RDF');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportRdf(file: RdfLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildRdfMetadataRows(dataset: RdfDataset): RdfMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Title', value: dataset.title || '—' },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Prefixes', value: String(dataset.prefixes.length) },
    { key: 'Nodes', value: String(dataset.nodes.length) },
    { key: 'Triples', value: String(dataset.triples.length) }
  ];
}

export function buildRdfNodeMetadata(node: RdfNode): RdfMetadataRow[] {
  return [
    { key: 'Id', value: node.id },
    { key: 'Name', value: node.name },
    { key: 'Kind', value: node.kind },
    { key: 'Prefix', value: node.prefix || '—' },
    { key: 'IRI', value: node.iri }
  ];
}

export function buildRdfTripleMetadata(triple: RdfTriple): RdfMetadataRow[] {
  return [
    { key: 'Subject', value: triple.subjectName || triple.subject },
    { key: 'Predicate', value: triple.predicateName || triple.predicate },
    { key: 'Object', value: triple.objectName || triple.object },
    { key: 'Literal', value: triple.literal ? 'yes' : 'no' }
  ];
}

export function exportRdfSummaryJson(file: RdfLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed RDF graph');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      title: parsed.title,
      prefixes: parsed.prefixes,
      nodes: parsed.nodes.map((n) => ({ id: n.id, name: n.name, kind: n.kind })),
      triples: parsed.triples.map((t) => ({
        subject: t.subjectName,
        predicate: t.predicateName,
        object: t.objectName,
        literal: t.literal
      }))
    },
    null,
    2
  );
}

export function exportRdfTriplesCsv(dataset: RdfDataset): string {
  const lines = ['index,subject,predicate,object,literal'];
  for (const t of dataset.triples) {
    lines.push([t.index + 1, csv(t.subjectName), csv(t.predicateName), csv(t.objectName), t.literal ? 'yes' : 'no'].join(','));
  }
  return lines.join('\n');
}

export function exportRdfNodesCsv(dataset: RdfDataset): string {
  const lines = ['index,id,name,kind,prefix'];
  for (const n of dataset.nodes) {
    lines.push([n.index + 1, csv(n.id), csv(n.name), n.kind, csv(n.prefix)].join(','));
  }
  return lines.join('\n');
}

export function resolveRdfSuggestion(state: { hasFiles: boolean; hasError: boolean }): RdfSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the shop RDF sample',
      reason: 'Load a local Turtle graph with services and dependsOn triples.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open an RDF graph',
      reason: 'Drop Turtle, RDF/XML, or JSON — or load the sample shop graph.',
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
