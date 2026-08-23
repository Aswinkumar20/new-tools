import {
  FASTA_MAX_FILE_BYTES,
  FASTA_SAMPLE,
  FASTA_SUPPORTED_EXTENSIONS
} from '../constants/fasta-viewer.constants';
import type {
  FastaHistogramBar,
  FastaLoadedFile,
  FastaMetadataRow,
  FastaRecord,
  FastaSuggestion,
  ParsedFasta
} from '../types/fasta-viewer.types';
import { parseFastaText } from './fasta-parse.utils';
import { formatScienceFileSize, getFileExtension } from './science-file.utils';
import { buildCompositionBars, bytesToText } from './sequence.utils';

export {
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatScienceFileSize as formatFastaFileSize,
  readFileBytes as readFastaFileBytes
} from './science-file.utils';

export { parseFastaText } from './fasta-parse.utils';
export {
  buildCompositionBars,
  residueColor,
  reverseComplement,
  translateSequence,
  wrapSequence,
  NT_COLORS,
  AA_COLORS
} from './sequence.utils';

export function isSupportedFastaFile(file: File): boolean {
  const name = file.name.toLowerCase();
  if (/\.gz$/i.test(name)) return false;
  const ext = getFileExtension(file.name);
  return (FASTA_SUPPORTED_EXTENSIONS as readonly string[]).includes(ext);
}

export function validateFastaFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > FASTA_MAX_FILE_BYTES) {
    return `File is too large (max ${formatScienceFileSize(FASTA_MAX_FILE_BYTES)})`;
  }
  return null;
}

export function filterValidFastaFiles(files: FileList | File[]): {
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
    if (!isSupportedFastaFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .fasta / .fa / .fna / .faa)' });
      continue;
    }
    const sizeError = validateFastaFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleFastaFile(): File {
  return new File([FASTA_SAMPLE], 'sample-sequences.fasta', {
    type: 'text/plain',
    lastModified: 0
  });
}

export function createFastaFileRecord(file: File, bytes: Uint8Array): FastaLoadedFile {
  const extension = getFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: ParsedFasta | null = null;
  let softFail = false;
  try {
    parsed = parseFastaText(text);
    warnings.push(...parsed.warnings);
    if (!parsed.records.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse FASTA');
  }
  return { id, name: file.name, size: file.size, extension, text, parsed, warnings, softFail };
}

export function canExportFasta(file: FastaLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildFastaMetadataRows(parsed: ParsedFasta): FastaMetadataRow[] {
  return [
    { key: 'Records', value: String(parsed.totalRecords) },
    { key: 'Previewed', value: String(parsed.records.length) },
    { key: 'Total bases', value: parsed.totalLength.toLocaleString() },
    { key: 'Alphabet', value: parsed.alphabetSummary }
  ];
}

export function buildRecordMetadataRows(record: FastaRecord): FastaMetadataRow[] {
  const rows: FastaMetadataRow[] = [
    { key: 'ID', value: record.id },
    { key: 'Length', value: record.length.toLocaleString() },
    { key: 'Alphabet', value: record.alphabet },
    { key: 'N / gaps', value: String(record.nCount) }
  ];
  if (record.gcPercent != null) {
    rows.push({ key: 'GC %', value: record.gcPercent.toFixed(1) });
  }
  if (record.description) {
    rows.push({ key: 'Description', value: record.description });
  }
  return rows;
}

export function filterFastaRecords(records: FastaRecord[], query: string): FastaRecord[] {
  const q = query.trim().toLowerCase();
  if (!q) return records;
  return records.filter(
    (r) =>
      r.id.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q) ||
      r.header.toLowerCase().includes(q) ||
      r.sequence.toLowerCase().includes(q)
  );
}

export function recordCompositionBars(record: FastaRecord): FastaHistogramBar[] {
  return buildCompositionBars(record.composition, record.alphabet);
}

export function exportFastaSummaryJson(file: FastaLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed FASTA');
  return JSON.stringify(
    {
      file: file.name,
      totalRecords: parsed.totalRecords,
      previewed: parsed.records.length,
      totalLength: parsed.totalLength,
      alphabet: parsed.alphabetSummary,
      records: parsed.records.map((r) => ({
        id: r.id,
        length: r.length,
        alphabet: r.alphabet,
        gcPercent: r.gcPercent,
        nCount: r.nCount
      }))
    },
    null,
    2
  );
}

export function exportFastaSequencesCsv(parsed: ParsedFasta): string {
  const lines = ['id,description,length,alphabet,gcPercent,nCount'];
  for (const record of parsed.records) {
    const desc = `"${record.description.replace(/"/g, '""')}"`;
    const gc = record.gcPercent == null ? '' : record.gcPercent.toFixed(2);
    lines.push(`${record.id},${desc},${record.length},${record.alphabet},${gc},${record.nCount}`);
  }
  return lines.join('\n');
}

export function exportSelectedFasta(record: FastaRecord): string {
  const wrapped = record.sequence.match(/.{1,80}/g)?.join('\n') ?? record.sequence;
  return `>${record.header}\n${wrapped}\n`;
}

export function resolveFastaSuggestion(opts: { hasFiles: boolean; hasError: boolean }): FastaSuggestion | null {
  if (opts.hasError) {
    return {
      id: 'try-sample',
      title: 'Try the sample multi-FASTA',
      reason: 'Load DNA, RNA, and peptide records to verify search, wrap, and composition.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!opts.hasFiles) {
    return {
      id: 'upload-fasta',
      title: 'Upload a FASTA file',
      reason: 'Sequences stay in your browser — search, color, reverse-complement, and export locally.',
      actionLabel: 'Choose file',
      action: 'upload'
    };
  }
  return null;
}
