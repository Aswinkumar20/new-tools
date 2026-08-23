import { FASTQ_MAX_READ_LEN, FASTQ_MAX_READS } from '../constants/fastq-viewer.constants';
import type { FastqEncoding, FastqRead, ParsedFastq } from '../types/fastq-viewer.types';
import { detectFastqEncoding, gcPercent, nCount, phredScores } from './sequence.utils';

function scoreStats(scores: number[]): { meanQ: number; minQ: number; maxQ: number } {
  if (!scores.length) return { meanQ: 0, minQ: 0, maxQ: 0 };
  let sum = 0;
  let min = scores[0];
  let max = scores[0];
  for (const q of scores) {
    sum += q;
    if (q < min) min = q;
    if (q > max) max = q;
  }
  return { meanQ: sum / scores.length, minQ: min, maxQ: max };
}

export function parseFastqText(text: string, encodingOverride?: FastqEncoding): ParsedFastq {
  const warnings: string[] = [];
  const trimmed = text.replace(/^\uFEFF/, '').trim();
  if (!trimmed) throw new Error('File is empty');
  if (trimmed.startsWith('>') && !trimmed.startsWith('@')) {
    throw new Error('This looks like FASTA — open it in FASTA Viewer.');
  }

  const lines = trimmed.split(/\r?\n/);
  const rawRecords: Array<{ id: string; description: string; sequence: string; quality: string }> = [];
  let i = 0;
  while (i < lines.length) {
    while (i < lines.length && !lines[i].trim()) i += 1;
    if (i >= lines.length) break;
    const headerLine = lines[i];
    if (!headerLine.startsWith('@')) {
      warnings.push(`Expected @ header at line ${i + 1} — skipped.`);
      i += 1;
      continue;
    }
    const header = headerLine.slice(1).trim();
    const id = header.split(/\s+/)[0] || `read_${rawRecords.length + 1}`;
    const description = header.slice(id.length).trim();
    i += 1;
    const sequence = (lines[i] ?? '').trim();
    i += 1;
    const plus = lines[i] ?? '';
    if (!plus.startsWith('+')) {
      warnings.push(`${id}: missing “+” separator.`);
    }
    i += 1;
    let quality = (lines[i] ?? '').trim();
    i += 1;
    if (!sequence) warnings.push(`${id}: empty sequence.`);
    if (sequence.length > FASTQ_MAX_READ_LEN) {
      warnings.push(`${id}: read truncated to ${FASTQ_MAX_READ_LEN} bases.`);
    }
    if (quality.length !== sequence.length) {
      warnings.push(`${id}: quality length ${quality.length} ≠ sequence length ${sequence.length}.`);
      if (quality.length > sequence.length) quality = quality.slice(0, sequence.length);
    }
    rawRecords.push({
      id,
      description,
      sequence: sequence.slice(0, FASTQ_MAX_READ_LEN),
      quality: quality.slice(0, FASTQ_MAX_READ_LEN)
    });
  }

  if (!rawRecords.length) throw new Error('No FASTQ reads could be parsed.');

  const encoding = encodingOverride ?? detectFastqEncoding(rawRecords.map((r) => r.quality));
  const truncated = rawRecords.length > FASTQ_MAX_READS;
  const slice = truncated ? rawRecords.slice(0, FASTQ_MAX_READS) : rawRecords;
  if (truncated) warnings.push(`Only the first ${FASTQ_MAX_READS} reads are previewed.`);

  const reads: FastqRead[] = slice.map((raw, index) => {
    const scores = phredScores(raw.quality, encoding);
    const stats = scoreStats(scores);
    return {
      index,
      id: raw.id,
      description: raw.description,
      sequence: raw.sequence,
      quality: raw.quality,
      length: raw.sequence.length,
      ...stats,
      gcPercent: gcPercent(raw.sequence, 'dna') ?? 0,
      nCount: nCount(raw.sequence),
      scores
    };
  });

  let lengthSum = 0;
  let qSum = 0;
  const hist = new Array(42).fill(0);
  const posSums: number[] = [];
  const posCounts: number[] = [];
  for (const read of reads) {
    lengthSum += read.length;
    qSum += read.meanQ;
    for (let p = 0; p < read.scores.length; p++) {
      posSums[p] = (posSums[p] ?? 0) + read.scores[p];
      posCounts[p] = (posCounts[p] ?? 0) + 1;
      const bin = Math.max(0, Math.min(41, Math.round(read.scores[p])));
      hist[bin] += 1;
    }
  }

  return {
    encoding,
    reads,
    totalReads: rawRecords.length,
    meanLength: reads.length ? lengthSum / reads.length : 0,
    meanQ: reads.length ? qSum / reads.length : 0,
    perPositionMeanQ: posSums.map((sum, idx) => sum / (posCounts[idx] || 1)),
    qualityHistogram: hist,
    warnings,
    truncated
  };
}

export function reparseFastqWithEncoding(text: string, encoding: FastqEncoding): ParsedFastq {
  return parseFastqText(text, encoding);
}
