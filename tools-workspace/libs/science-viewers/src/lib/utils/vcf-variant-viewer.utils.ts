import { VCF_MAX_FILE_BYTES, VCF_SAMPLE, VCF_SUPPORTED_EXTENSIONS, VCF_TYPE_COLORS } from '../constants/vcf-variant-viewer.constants';
import type {
  ParsedVcf,
  VcfChromCount,
  VcfLoadedFile,
  VcfMetadataRow,
  VcfSuggestion,
  VcfVariant,
  VcfVariantType
} from '../types/vcf-variant-viewer.types';
import { formatScienceFileSize, getFileExtension } from './science-file.utils';
import { bytesToText } from './sequence.utils';
import { parseVcfText } from './vcf-parse.utils';

export {
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatScienceFileSize as formatVcfFileSize,
  readFileBytes as readVcfFileBytes
} from './science-file.utils';

export { classifyVcfType, parseVcfText } from './vcf-parse.utils';

export function variantTypeColor(type: VcfVariantType): string {
  return VCF_TYPE_COLORS[type] ?? '#94a3b8';
}

export function isSupportedVcfFile(file: File): boolean {
  if (/\.gz$/i.test(file.name) || /\.bcf$/i.test(file.name)) return false;
  const ext = getFileExtension(file.name);
  return (VCF_SUPPORTED_EXTENSIONS as readonly string[]).includes(ext);
}

export function validateVcfFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > VCF_MAX_FILE_BYTES) {
    return `File is too large (max ${formatScienceFileSize(VCF_MAX_FILE_BYTES)})`;
  }
  return null;
}

export function filterValidVcfFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed .vcf.gz is not supported — decompress first' });
      continue;
    }
    if (/\.bcf$/i.test(file.name)) {
      rejected.push({ name: file.name, reason: 'BCF binary is not supported — export uncompressed VCF' });
      continue;
    }
    if (!isSupportedVcfFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .vcf)' });
      continue;
    }
    const sizeError = validateVcfFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleVcfFile(): File {
  return new File([VCF_SAMPLE], 'sample-variants.vcf', {
    type: 'text/x-vcf',
    lastModified: 0
  });
}

export function createVcfFileRecord(file: File, bytes: Uint8Array): VcfLoadedFile {
  const extension = getFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: ParsedVcf | null = null;
  let softFail = false;
  try {
    parsed = parseVcfText(text);
    warnings.push(...parsed.warnings);
    if (!parsed.variants.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse VCF');
  }
  return { id, name: file.name, size: file.size, extension, text, parsed, warnings, softFail };
}

export function canExportVcf(file: VcfLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildVcfMetadataRows(parsed: ParsedVcf): VcfMetadataRow[] {
  return [
    { key: 'Version', value: parsed.version },
    { key: 'Variants', value: String(parsed.totalVariants) },
    { key: 'Previewed', value: String(parsed.variants.length) },
    { key: 'Samples', value: parsed.sampleNames.length ? parsed.sampleNames.join(', ') : '—' },
    { key: 'Chromosomes', value: parsed.chromCounts.map((c) => c.chrom).join(', ') || '—' }
  ];
}

export function buildVariantMetadata(variant: VcfVariant): VcfMetadataRow[] {
  const rows: VcfMetadataRow[] = [
    { key: 'Locus', value: `${variant.chrom}:${variant.pos}` },
    { key: 'ID', value: variant.id },
    { key: 'Ref / Alt', value: `${variant.ref} → ${variant.alt.join(',')}` },
    { key: 'Type', value: variant.type.toUpperCase() },
    { key: 'QUAL', value: variant.qual == null ? '.' : String(variant.qual) },
    { key: 'FILTER', value: variant.filter }
  ];
  for (const info of variant.info) rows.push({ key: info.key, value: info.value });
  return rows;
}

export function filterVcfVariants(
  variants: VcfVariant[],
  opts: { query: string; chrom: string | null; type: VcfVariantType | null; minQual: number; passOnly: boolean }
): VcfVariant[] {
  const q = opts.query.trim().toLowerCase();
  return variants.filter((v) => {
    if (opts.chrom && v.chrom !== opts.chrom) return false;
    if (opts.type && v.type !== opts.type) return false;
    if (opts.passOnly && !v.pass) return false;
    if (opts.minQual > 0 && (v.qual == null || v.qual < opts.minQual)) return false;
    if (!q) return true;
    return (
      v.chrom.toLowerCase().includes(q) ||
      String(v.pos).includes(q) ||
      v.id.toLowerCase().includes(q) ||
      v.ref.toLowerCase().includes(q) ||
      v.alt.some((a) => a.toLowerCase().includes(q)) ||
      v.filter.toLowerCase().includes(q)
    );
  });
}

export function exportVcfSummaryJson(file: VcfLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed VCF');
  return JSON.stringify(
    {
      file: file.name,
      version: parsed.version,
      totalVariants: parsed.totalVariants,
      previewed: parsed.variants.length,
      samples: parsed.sampleNames,
      chromCounts: parsed.chromCounts
    },
    null,
    2
  );
}

export function exportVcfVariantsCsv(variants: VcfVariant[], sampleNames: string[]): string {
  const cols = ['chrom', 'pos', 'id', 'ref', 'alt', 'qual', 'filter', 'type', ...sampleNames.map((s) => `GT_${s}`)];
  const lines = [cols.join(',')];
  for (const v of variants) {
    const gts = sampleNames.map((name) => v.samples.find((s) => s.sample === name)?.genotype ?? '.');
    lines.push([v.chrom, v.pos, v.id, v.ref, v.alt.join('|'), v.qual ?? '.', v.filter, v.type, ...gts].join(','));
  }
  return lines.join('\n');
}

export function exportFilteredVcf(parsed: ParsedVcf, variants: VcfVariant[]): string {
  const metaLines = parsed.meta.map((m) => `##${m.key}=${m.value}`);
  const header = `#${parsed.columns.join('\t')}`;
  const rows = variants.map((v) => {
    const sampleVals = parsed.sampleNames.map((name) => {
      const call = v.samples.find((s) => s.sample === name);
      if (!call) return '.';
      if (!v.format || v.format === '.') return call.genotype;
      return v.format.split(':').map((key) => call.fields[key] ?? '.').join(':');
    });
    return [
      v.chrom,
      String(v.pos),
      v.id,
      v.ref,
      v.alt.join(','),
      v.qual == null ? '.' : String(v.qual),
      v.filter,
      v.infoRaw,
      ...(v.format ? [v.format, ...sampleVals] : [])
    ].join('\t');
  });
  return [...metaLines, header, ...rows, ''].join('\n');
}

export function renderVcfChromChart(
  canvas: HTMLCanvasElement,
  counts: VcfChromCount[],
  highlight: string | null
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!counts.length) return;
  const pad = 36;
  const max = Math.max(1, ...counts.map((c) => c.count));
  const innerW = canvas.width - pad * 2;
  const innerH = canvas.height - pad * 2;
  const barW = innerW / counts.length;
  counts.forEach((row, i) => {
    const h = (row.count / max) * innerH;
    const x = pad + i * barW + barW * 0.15;
    const y = pad + innerH - h;
    ctx.fillStyle = highlight === row.chrom ? '#f8fafc' : '#c026d3';
    ctx.fillRect(x, y, barW * 0.7, Math.max(2, h));
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText(row.chrom, x, canvas.height - 12);
    ctx.fillText(String(row.count), x, y - 6);
  });
}

export function resolveVcfSuggestion(opts: { hasFiles: boolean; hasError: boolean }): VcfSuggestion | null {
  if (opts.hasError) {
    return {
      id: 'try-sample',
      title: 'Try the sample VCF',
      reason: 'Load synthetic chr1/chr2 variants to verify filters, genotypes, and the chromosome chart.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!opts.hasFiles) {
    return {
      id: 'upload-vcf',
      title: 'Upload a VCF file',
      reason: 'Variants stay in your browser — filter, inspect INFO/genotypes, and export locally.',
      actionLabel: 'Choose file',
      action: 'upload'
    };
  }
  return null;
}
