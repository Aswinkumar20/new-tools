import {
  FASTQ_MAX_FILE_BYTES,
  FASTQ_SAMPLE,
  FASTQ_SUPPORTED_EXTENSIONS
} from '../constants/fastq-viewer.constants';
import type {
  FastqEncoding,
  FastqHistogramBar,
  FastqLoadedFile,
  FastqMetadataRow,
  FastqRead,
  FastqSuggestion,
  ParsedFastq
} from '../types/fastq-viewer.types';
import { parseFastqText, reparseFastqWithEncoding } from './fastq-parse.utils';
import { formatScienceFileSize, getFileExtension } from './science-file.utils';
import { bytesToText, qualityColor } from './sequence.utils';

export {
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatScienceFileSize as formatFastqFileSize,
  readFileBytes as readFastqFileBytes
} from './science-file.utils';

export { parseFastqText, reparseFastqWithEncoding } from './fastq-parse.utils';
export { qualityColor, residueColor, wrapSequence, NT_COLORS } from './sequence.utils';

export function isSupportedFastqFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  const ext = getFileExtension(file.name);
  return (FASTQ_SUPPORTED_EXTENSIONS as readonly string[]).includes(ext);
}

export function validateFastqFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > FASTQ_MAX_FILE_BYTES) {
    return `File is too large (max ${formatScienceFileSize(FASTQ_MAX_FILE_BYTES)})`;
  }
  return null;
}

export function filterValidFastqFiles(files: FileList | File[]): {
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
    if (!isSupportedFastqFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .fastq / .fq)' });
      continue;
    }
    const sizeError = validateFastqFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleFastqFile(): File {
  return new File([FASTQ_SAMPLE], 'sample-reads.fastq', {
    type: 'text/plain',
    lastModified: 0
  });
}

export function createFastqFileRecord(file: File, bytes: Uint8Array, encoding?: FastqEncoding): FastqLoadedFile {
  const extension = getFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: ParsedFastq | null = null;
  let softFail = false;
  try {
    parsed = encoding ? reparseFastqWithEncoding(text, encoding) : parseFastqText(text);
    warnings.push(...parsed.warnings);
    if (!parsed.reads.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse FASTQ');
  }
  return { id, name: file.name, size: file.size, extension, text, parsed, warnings, softFail };
}

export function canExportFastq(file: FastqLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildFastqMetadataRows(parsed: ParsedFastq): FastqMetadataRow[] {
  return [
    { key: 'Reads', value: String(parsed.totalReads) },
    { key: 'Previewed', value: String(parsed.reads.length) },
    { key: 'Encoding', value: parsed.encoding === 'phred64' ? 'Phred+64' : 'Phred+33' },
    { key: 'Mean length', value: parsed.meanLength.toFixed(1) },
    { key: 'Mean Q', value: parsed.meanQ.toFixed(1) }
  ];
}

export function buildReadMetadataRows(read: FastqRead): FastqMetadataRow[] {
  return [
    { key: 'ID', value: read.id },
    { key: 'Length', value: String(read.length) },
    { key: 'Mean Q', value: read.meanQ.toFixed(1) },
    { key: 'Min / max Q', value: `${read.minQ} / ${read.maxQ}` },
    { key: 'GC %', value: read.gcPercent.toFixed(1) },
    { key: 'N count', value: String(read.nCount) }
  ];
}

export function filterFastqReads(
  reads: FastqRead[],
  query: string,
  minLength: number,
  minMeanQ: number
): FastqRead[] {
  const q = query.trim().toLowerCase();
  return reads.filter((read) => {
    if (read.length < minLength) return false;
    if (read.meanQ < minMeanQ) return false;
    if (!q) return true;
    return (
      read.id.toLowerCase().includes(q) ||
      read.description.toLowerCase().includes(q) ||
      read.sequence.toLowerCase().includes(q)
    );
  });
}

export function qualityHistogramBars(hist: number[]): FastqHistogramBar[] {
  const max = Math.max(1, ...hist);
  return hist.map((count, q) => ({
    label: String(q),
    count,
    heightPct: count ? Math.max(4, Math.round((count / max) * 100)) : 0,
    color: qualityColor(q)
  }));
}

export function exportFastqSummaryJson(file: FastqLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed FASTQ');
  return JSON.stringify(
    {
      file: file.name,
      encoding: parsed.encoding,
      totalReads: parsed.totalReads,
      previewed: parsed.reads.length,
      meanLength: parsed.meanLength,
      meanQ: parsed.meanQ,
      reads: parsed.reads.map((r) => ({
        id: r.id,
        length: r.length,
        meanQ: Number(r.meanQ.toFixed(2)),
        minQ: r.minQ,
        maxQ: r.maxQ,
        gcPercent: Number(r.gcPercent.toFixed(2)),
        nCount: r.nCount
      }))
    },
    null,
    2
  );
}

export function exportFastqReadsCsv(reads: FastqRead[]): string {
  const lines = ['id,length,meanQ,minQ,maxQ,gcPercent,nCount'];
  for (const read of reads) {
    lines.push(
      `${read.id},${read.length},${read.meanQ.toFixed(2)},${read.minQ},${read.maxQ},${read.gcPercent.toFixed(2)},${read.nCount}`
    );
  }
  return lines.join('\n');
}

export function exportFilteredFastq(reads: FastqRead[]): string {
  return reads.map((read) => `@${read.id}${read.description ? ` ${read.description}` : ''}\n${read.sequence}\n+\n${read.quality}`).join('\n') + '\n';
}

export function resolveFastqSuggestion(opts: { hasFiles: boolean; hasError: boolean }): FastqSuggestion | null {
  if (opts.hasError) {
    return {
      id: 'try-sample',
      title: 'Try the sample FASTQ reads',
      reason: 'Load synthetic Illumina-like reads to verify quality plots, filters, and Phred decoding.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!opts.hasFiles) {
    return {
      id: 'upload-fastq',
      title: 'Upload a FASTQ file',
      reason: 'Reads stay in your browser — inspect quality, filter, and export locally.',
      actionLabel: 'Choose file',
      action: 'upload'
    };
  }
  return null;
}
