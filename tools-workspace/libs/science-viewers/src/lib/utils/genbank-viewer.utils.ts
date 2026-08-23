import { GENBANK_FEATURE_COLORS, GENBANK_MAX_FILE_BYTES, GENBANK_SAMPLE, GENBANK_SUPPORTED_EXTENSIONS } from '../constants/genbank-viewer.constants';
import type {
  GenbankFeature,
  GenbankLoadedFile,
  GenbankMetadataRow,
  GenbankRecord,
  GenbankSuggestion,
  ParsedGenbank
} from '../types/genbank-viewer.types';
import { extractFeatureSequence, parseGenbankText } from './genbank-parse.utils';
import { formatScienceFileSize, getFileExtension } from './science-file.utils';
import { bytesToText, gcPercent, translateSequence } from './sequence.utils';

export {
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatScienceFileSize as formatGenbankFileSize,
  readFileBytes as readGenbankFileBytes
} from './science-file.utils';

export { extractFeatureSequence, parseGenbankLocation, parseGenbankText } from './genbank-parse.utils';
export { residueColor, reverseComplement, translateSequence, wrapSequence } from './sequence.utils';

export function featureColor(type: string): string {
  return GENBANK_FEATURE_COLORS[type.toLowerCase()] ?? '#fb7185';
}

export function isSupportedGenbankFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  const ext = getFileExtension(file.name);
  return (GENBANK_SUPPORTED_EXTENSIONS as readonly string[]).includes(ext);
}

export function validateGenbankFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > GENBANK_MAX_FILE_BYTES) {
    return `File is too large (max ${formatScienceFileSize(GENBANK_MAX_FILE_BYTES)})`;
  }
  return null;
}

export function filterValidGenbankFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed .gz is not supported — decompress first' });
      continue;
    }
    if (!isSupportedGenbankFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .gb / .gbk / .gbff)' });
      continue;
    }
    const sizeError = validateGenbankFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleGenbankFile(): File {
  return new File([GENBANK_SAMPLE], 'sample-adh.gb', {
    type: 'chemical/seq-na-genbank',
    lastModified: 0
  });
}

export function createGenbankFileRecord(file: File, bytes: Uint8Array): GenbankLoadedFile {
  const extension = getFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: ParsedGenbank | null = null;
  let softFail = false;
  try {
    parsed = parseGenbankText(text);
    warnings.push(...parsed.warnings);
    if (!parsed.records.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse GenBank');
  }
  return { id, name: file.name, size: file.size, extension, text, parsed, warnings, softFail };
}

export function canExportGenbank(file: GenbankLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildGenbankFileMetadata(parsed: ParsedGenbank): GenbankMetadataRow[] {
  const first = parsed.records[0];
  return [
    { key: 'Records', value: String(parsed.totalRecords) },
    { key: 'Locus', value: first?.locus || '—' },
    { key: 'Length', value: String(first?.length ?? 0) },
    { key: 'Molecule', value: first?.molType || '—' },
    { key: 'Topology', value: first?.topology || '—' },
    { key: 'Features', value: String(parsed.records.reduce((n, r) => n + r.features.length, 0)) }
  ];
}

export function buildGenbankRecordMetadata(record: GenbankRecord): GenbankMetadataRow[] {
  const gc = gcPercent(record.sequence, 'dna');
  const rows: GenbankMetadataRow[] = [
    { key: 'Accession', value: record.accession || record.locus },
    { key: 'Version', value: record.version || '—' },
    { key: 'Definition', value: record.definition || '—' },
    { key: 'Organism', value: record.organism || record.source || '—' },
    { key: 'Keywords', value: record.keywords || '—' }
  ];
  if (gc != null) rows.push({ key: 'GC %', value: gc.toFixed(1) });
  return rows;
}

export function buildFeatureMetadata(feature: GenbankFeature): GenbankMetadataRow[] {
  const rows: GenbankMetadataRow[] = [
    { key: 'Type', value: feature.type },
    { key: 'Location', value: feature.location },
    { key: 'Span', value: feature.start && feature.end ? `${feature.start}–${feature.end}` : '—' },
    { key: 'Strand', value: feature.complement ? 'complement (−)' : 'forward (+)' }
  ];
  if (feature.gene) rows.push({ key: 'Gene', value: feature.gene });
  if (feature.locusTag) rows.push({ key: 'Locus tag', value: feature.locusTag });
  if (feature.product) rows.push({ key: 'Product', value: feature.product });
  if (feature.note) rows.push({ key: 'Note', value: feature.note });
  for (const q of feature.qualifiers) {
    if (['gene', 'product', 'note', 'locus_tag'].includes(q.key.toLowerCase())) continue;
    rows.push({ key: q.key, value: q.value || 'true' });
  }
  return rows;
}

export function filterGenbankFeatures(
  features: GenbankFeature[],
  query: string,
  typeFilter: string | null
): GenbankFeature[] {
  const q = query.trim().toLowerCase();
  return features.filter((f) => {
    if (typeFilter && f.type !== typeFilter) return false;
    if (!q) return true;
    return (
      f.type.toLowerCase().includes(q) ||
      f.gene.toLowerCase().includes(q) ||
      f.product.toLowerCase().includes(q) ||
      f.note.toLowerCase().includes(q) ||
      f.locusTag.toLowerCase().includes(q) ||
      f.location.toLowerCase().includes(q)
    );
  });
}

export function featureTranslation(record: GenbankRecord, feature: GenbankFeature): string {
  const fromQual = feature.qualifiers.find((q) => q.key.toLowerCase() === 'translation')?.value ?? '';
  if (fromQual) return fromQual.replace(/\s+/g, '');
  if (feature.type.toLowerCase() !== 'cds') return '';
  return translateSequence(extractFeatureSequence(record, feature), 0);
}

export function exportGenbankSummaryJson(file: GenbankLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed GenBank');
  return JSON.stringify(
    {
      file: file.name,
      totalRecords: parsed.totalRecords,
      records: parsed.records.map((r) => ({
        locus: r.locus,
        accession: r.accession,
        length: r.length,
        molType: r.molType,
        topology: r.topology,
        definition: r.definition,
        organism: r.organism,
        featureCount: r.features.length,
        featureTypes: r.featureTypes
      }))
    },
    null,
    2
  );
}

export function exportGenbankFeaturesCsv(record: GenbankRecord): string {
  const lines = ['type,gene,product,location,start,end,strand,note'];
  for (const f of record.features) {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    lines.push(
      [f.type, esc(f.gene), esc(f.product), esc(f.location), f.start, f.end, f.complement ? '-' : '+', esc(f.note)].join(',')
    );
  }
  return lines.join('\n');
}

export function exportGenbankFeatureFasta(record: GenbankRecord, feature: GenbankFeature): string {
  const seq = extractFeatureSequence(record, feature) || record.sequence;
  const id = feature.gene || feature.locusTag || feature.type;
  const wrapped = seq.match(/.{1,80}/g)?.join('\n') ?? seq;
  return `>${record.locus}_${id} ${feature.type} ${feature.location}\n${wrapped}\n`;
}

export function renderGenbankFeatureMap(
  canvas: HTMLCanvasElement,
  record: GenbankRecord,
  highlightIndex: number | null
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const len = Math.max(1, record.length || record.sequence.length || 1);
  const pad = 28;
  const trackH = 18;
  const types = record.featureTypes.length ? record.featureTypes : ['feature'];
  const innerW = canvas.width - pad * 2;
  ctx.fillStyle = '#94a3b8';
  ctx.font = '12px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText(`1`, pad, 18);
  ctx.fillText(`${len}`, canvas.width - pad - 24, 18);
  ctx.strokeStyle = '#334155';
  ctx.beginPath();
  ctx.moveTo(pad, 28);
  ctx.lineTo(pad + innerW, 28);
  ctx.stroke();

  types.forEach((type, ti) => {
    const y = 48 + ti * (trackH + 14);
    ctx.fillStyle = '#64748b';
    ctx.font = '11px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText(type, pad, y - 4);
    for (const feature of record.features.filter((f) => f.type === type)) {
      if (!feature.start || !feature.end) continue;
      const x1 = pad + ((feature.start - 1) / len) * innerW;
      const x2 = pad + (feature.end / len) * innerW;
      const w = Math.max(3, x2 - x1);
      ctx.fillStyle = feature.index === highlightIndex ? '#f8fafc' : featureColor(type);
      ctx.globalAlpha = feature.index === highlightIndex ? 1 : 0.85;
      ctx.fillRect(x1, y, w, trackH);
      ctx.globalAlpha = 1;
      if (feature.complement) {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(x1 + 2, y + trackH - 5, Math.max(2, w - 4), 2);
      }
    }
  });
}

export function resolveGenbankSuggestion(opts: { hasFiles: boolean; hasError: boolean }): GenbankSuggestion | null {
  if (opts.hasError) {
    return {
      id: 'try-sample',
      title: 'Try the sample GenBank record',
      reason: 'Load the synthetic adhS fragment to verify the feature map, CDS translation, and sequence view.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!opts.hasFiles) {
    return {
      id: 'upload-gb',
      title: 'Upload a GenBank file',
      reason: 'Records stay in your browser — inspect features, sequence, and export locally.',
      actionLabel: 'Choose file',
      action: 'upload'
    };
  }
  return null;
}
