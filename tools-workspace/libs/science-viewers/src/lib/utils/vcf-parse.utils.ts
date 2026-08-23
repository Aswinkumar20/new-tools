import { VCF_MAX_VARIANTS } from '../constants/vcf-variant-viewer.constants';
import type {
  ParsedVcf,
  VcfChromCount,
  VcfInfoEntry,
  VcfMetaHeader,
  VcfSampleCall,
  VcfVariant,
  VcfVariantType
} from '../types/vcf-variant-viewer.types';

export function classifyVcfType(ref: string, alts: string[]): VcfVariantType {
  if (!ref || !alts.length || alts.every((a) => a === '.' || a === '*')) return 'other';
  if (alts.every((a) => a.length === ref.length && a.length === 1)) return 'snp';
  if (alts.some((a) => a.length !== ref.length)) return 'indel';
  if (alts.every((a) => a.length === ref.length && a.length > 1)) return 'mnv';
  return 'other';
}

function parseInfo(raw: string): VcfInfoEntry[] {
  if (!raw || raw === '.') return [];
  return raw.split(';').filter(Boolean).map((part) => {
    const eq = part.indexOf('=');
    if (eq < 0) return { key: part, value: 'true' };
    return { key: part.slice(0, eq), value: part.slice(eq + 1) };
  });
}

function parseSamples(format: string, sampleNames: string[], values: string[]): VcfSampleCall[] {
  if (!format || format === '.') return [];
  const keys = format.split(':');
  return sampleNames.map((sample, i) => {
    const raw = values[i] ?? '.';
    const parts = raw.split(':');
    const fields: Record<string, string> = {};
    keys.forEach((key, idx) => {
      fields[key] = parts[idx] ?? '.';
    });
    return { sample, genotype: fields['GT'] ?? '.', fields };
  });
}

export function parseVcfText(text: string): ParsedVcf {
  const warnings: string[] = [];
  const trimmed = text.replace(/^\uFEFF/, '').replace(/\r/g, '');
  if (!trimmed.trim()) throw new Error('File is empty');
  if (trimmed.trimStart().startsWith('>')) {
    throw new Error('This looks like FASTA — open it in FASTA Viewer.');
  }
  if (/^\s*LOCUS\b/m.test(trimmed)) {
    throw new Error('This looks like GenBank — open it in GenBank Viewer.');
  }
  if (trimmed.charCodeAt(0) === 0x42 && trimmed.charCodeAt(1) === 0x43 && trimmed.charCodeAt(2) === 0x46) {
    throw new Error('BCF binary is not supported — export uncompressed VCF first.');
  }

  const lines = trimmed.split('\n');
  const meta: VcfMetaHeader[] = [];
  let version = '';
  let columns: string[] = [];
  let sampleNames: string[] = [];
  const variants: VcfVariant[] = [];
  let truncated = false;
  let malformed = 0;
  let totalSeen = 0;

  for (const line of lines) {
    if (!line.trim()) continue;
    if (line.startsWith('##')) {
      const eq = line.indexOf('=');
      const key = eq > 2 ? line.slice(2, eq) : line.slice(2);
      const value = eq > 2 ? line.slice(eq + 1) : '';
      meta.push({ key, value });
      if (key === 'fileformat') version = value.replace(/^VCF/i, '').replace(/^v/i, '') || value;
      continue;
    }
    if (line.startsWith('#CHROM') || line.startsWith('#chrom')) {
      columns = line.replace(/^#/, '').split(/\t/);
      sampleNames = columns.length > 9 ? columns.slice(9) : [];
      if (sampleNames.length > 8) {
        warnings.push(`VCF has ${sampleNames.length} samples — genotype table shows all, but wide files may be slower.`);
      }
      continue;
    }
    if (line.startsWith('#')) continue;
    if (!columns.length) {
      throw new Error('Missing VCF column header (#CHROM POS ID REF ALT QUAL FILTER INFO).');
    }
    totalSeen += 1;
    if (variants.length >= VCF_MAX_VARIANTS) {
      truncated = true;
      continue;
    }
    const cols = line.split('\t');
    if (cols.length < 8) {
      malformed += 1;
      continue;
    }
    const chrom = cols[0];
    const pos = Number(cols[1]);
    if (!Number.isFinite(pos)) {
      malformed += 1;
      continue;
    }
    const id = cols[2] && cols[2] !== '.' ? cols[2] : '.';
    const ref = cols[3] || '.';
    const alt = (cols[4] || '.').split(',').filter(Boolean);
    const qual = cols[5] === '.' || cols[5] === '' ? null : Number(cols[5]);
    const filter = cols[6] || '.';
    const infoRaw = cols[7] || '.';
    const format = cols[8] || '';
    const sampleValues = cols.slice(9);
    const type = classifyVcfType(ref, alt);
    variants.push({
      index: variants.length,
      chrom,
      pos,
      id,
      ref,
      alt,
      qual: qual != null && Number.isFinite(qual) ? qual : null,
      filter,
      info: parseInfo(infoRaw),
      infoRaw,
      format,
      samples: parseSamples(format, sampleNames, sampleValues),
      type,
      pass: filter === 'PASS' || filter === '.'
    });
  }

  if (!variants.length) throw new Error('No VCF variants could be parsed.');
  if (!version) warnings.push('No ##fileformat header — assumed VCF text.');
  if (malformed) warnings.push(`${malformed} malformed variant line(s) were skipped.`);
  if (truncated) warnings.push(`Only the first ${VCF_MAX_VARIANTS} variants are previewed.`);

  const chromMap = new Map<string, VcfChromCount>();
  for (const variant of variants) {
    const row = chromMap.get(variant.chrom) ?? { chrom: variant.chrom, count: 0, snp: 0, indel: 0 };
    row.count += 1;
    if (variant.type === 'snp') row.snp += 1;
    if (variant.type === 'indel') row.indel += 1;
    chromMap.set(variant.chrom, row);
  }

  return {
    version: version || 'unknown',
    meta,
    columns,
    sampleNames,
    variants,
    totalVariants: totalSeen,
    chromCounts: [...chromMap.values()],
    warnings,
    truncated
  };
}
