import { OWL_SAMPLE } from '../constants/owl-ontology-viewer-sample.data';
import { OWL_MAX_FILE_BYTES, OWL_SUPPORTED_EXTENSIONS } from '../constants/owl-ontology-viewer.constants';
import type {
  OwlAxiom,
  OwlClass,
  OwlDataset,
  OwlLoadedFile,
  OwlMetadataRow,
  OwlProperty,
  OwlSuggestion
} from '../types/owl-ontology-viewer.types';
import { parseOwlBytes } from './owl-ontology-viewer-parse.utils';
import { bytesToText, formatDiagramFileSize, getDiagramFileExtension } from './diagram-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatDiagramFileSize as formatOwlFileSize,
  readFileBytes as readOwlFileBytes
} from './diagram-file.utils';

export {
  filterOwlAxioms,
  filterOwlClasses,
  filterOwlProperties,
  parseOwlBytes,
  parseOwlText
} from './owl-ontology-viewer-parse.utils';
export { owlNodeColor, renderOwlAxioms, renderOwlClasses, renderOwlDiagram, renderOwlProperties } from './owl-ontology-viewer-render.utils';

export function isSupportedOwlFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (OWL_SUPPORTED_EXTENSIONS as readonly string[]).includes(getDiagramFileExtension(file.name));
}

export function validateOwlFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > OWL_MAX_FILE_BYTES) return `File is too large (max ${formatDiagramFileSize(OWL_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidOwlFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed OWL files are not supported — decompress first' });
      continue;
    }
    if (!isSupportedOwlFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .owl, .rdf, .ttl, .json, .xml, .md, or .txt)' });
      continue;
    }
    const sizeError = validateOwlFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleOwlFile(): File {
  return new File([OWL_SAMPLE], 'sample-shop.owl', { type: 'application/rdf+xml', lastModified: 0 });
}

export function createOwlFileRecord(file: File, bytes: Uint8Array): OwlLoadedFile {
  const extension = getDiagramFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: OwlDataset | null = null;
  let softFail = false;
  try {
    parsed = parseOwlBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.classes.length && !parsed.properties.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse OWL ontology');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportOwl(file: OwlLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildOwlMetadataRows(dataset: OwlDataset): OwlMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Title', value: dataset.title || '—' },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Classes', value: String(dataset.classes.length) },
    { key: 'Properties', value: String(dataset.properties.length) },
    { key: 'Axioms', value: String(dataset.axioms.length) }
  ];
}

export function buildOwlClassMetadata(cls: OwlClass): OwlMetadataRow[] {
  return [
    { key: 'Id', value: cls.id },
    { key: 'Name', value: cls.name },
    { key: 'Label', value: cls.label || '—' },
    { key: 'Super', value: cls.superClasses.join(', ') || '—' },
    { key: 'IRI', value: cls.iri }
  ];
}

export function buildOwlPropertyMetadata(prop: OwlProperty): OwlMetadataRow[] {
  return [
    { key: 'Id', value: prop.id },
    { key: 'Name', value: prop.name },
    { key: 'Kind', value: prop.kind },
    { key: 'Domain', value: prop.domain || '—' },
    { key: 'Range', value: prop.range || '—' }
  ];
}

export function buildOwlAxiomMetadata(axiom: OwlAxiom): OwlMetadataRow[] {
  return [
    { key: 'From', value: axiom.sourceName || axiom.source },
    { key: 'Rel', value: axiom.rel },
    { key: 'To', value: axiom.targetName || axiom.target }
  ];
}

export function exportOwlSummaryJson(file: OwlLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed OWL ontology');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      title: parsed.title,
      classes: parsed.classes.map((c) => ({ id: c.id, name: c.name, super: c.superClasses })),
      properties: parsed.properties.map((p) => ({ id: p.id, name: p.name, kind: p.kind, domain: p.domain, range: p.range })),
      axioms: parsed.axioms.map((a) => ({ source: a.sourceName, rel: a.rel, target: a.targetName }))
    },
    null,
    2
  );
}

export function exportOwlClassesCsv(dataset: OwlDataset): string {
  const lines = ['index,id,name,label,super'];
  for (const c of dataset.classes) {
    lines.push([c.index + 1, csv(c.id), csv(c.name), csv(c.label), csv(c.superClasses.join('|'))].join(','));
  }
  return lines.join('\n');
}

export function exportOwlPropertiesCsv(dataset: OwlDataset): string {
  const lines = ['index,id,name,kind,domain,range'];
  for (const p of dataset.properties) {
    lines.push([p.index + 1, csv(p.id), csv(p.name), p.kind, csv(p.domain), csv(p.range)].join(','));
  }
  return lines.join('\n');
}

export function resolveOwlSuggestion(state: { hasFiles: boolean; hasError: boolean }): OwlSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the shop OWL sample',
      reason: 'Load a local Product/Book ontology with object and datatype properties.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open an OWL ontology',
      reason: 'Drop OWL/RDF/XML, Turtle, or JSON — or load the sample shop ontology.',
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
