import { FASTA_MAX_RECORDS, FASTA_MAX_SEQ_CHARS } from '../constants/fasta-viewer.constants';
import type { FastaRecord, ParsedFasta } from '../types/fasta-viewer.types';
import {
  detectAlphabet,
  gcPercent,
  nCount,
  normalizeSequence,
  sequenceComposition,
  summarizeAlphabet
} from './sequence.utils';

export function parseFastaText(text: string): ParsedFasta {
  const warnings: string[] = [];
  const trimmed = text.trim();
  if (!trimmed) throw new Error('File is empty');
  if (trimmed.startsWith('@') && !trimmed.includes('>')) {
    throw new Error('This looks like FASTQ — open it in FASTQ Viewer.');
  }
  if (!trimmed.includes('>')) {
    throw new Error('No FASTA headers found — expected records starting with >.');
  }
  if (!trimmed.startsWith('>')) {
    warnings.push('File does not start with > — leading non-header lines were ignored.');
  }

  const chunks = trimmed.split(/^>/m).filter((chunk) => chunk.trim().length > 0);
  const records: FastaRecord[] = [];
  const seenIds = new Set<string>();
  let totalLength = 0;
  let truncated = false;

  for (const chunk of chunks) {
    if (records.length >= FASTA_MAX_RECORDS) {
      truncated = true;
      break;
    }
    const lines = chunk.split(/\r?\n/);
    const header = (lines[0] ?? '').trim();
    if (!header) {
      warnings.push('Skipped a record with an empty header.');
      continue;
    }
    const id = header.split(/\s+/)[0] || `seq_${records.length + 1}`;
    const description = header.slice(id.length).trim();
    let sequence = normalizeSequence(lines.slice(1).join(''));
    let seqTruncated = false;
    if (sequence.length > FASTA_MAX_SEQ_CHARS) {
      sequence = sequence.slice(0, FASTA_MAX_SEQ_CHARS);
      seqTruncated = true;
      warnings.push(`${id}: sequence truncated to ${FASTA_MAX_SEQ_CHARS.toLocaleString()} characters for preview.`);
    }
    if (!sequence) warnings.push(`${id}: empty sequence.`);
    if (seenIds.has(id)) warnings.push(`Duplicate FASTA id “${id}”.`);
    seenIds.add(id);
    const alphabet = detectAlphabet(sequence);
    const composition = sequenceComposition(sequence);
    records.push({
      index: records.length,
      id,
      description,
      header,
      sequence,
      length: sequence.length,
      alphabet,
      gcPercent: gcPercent(sequence, alphabet),
      composition,
      nCount: nCount(sequence),
      truncated: seqTruncated
    });
    totalLength += sequence.length;
  }

  if (!records.length) throw new Error('No FASTA records could be parsed.');
  if (truncated) {
    warnings.push(`Only the first ${FASTA_MAX_RECORDS} records are previewed.`);
  }

  return {
    records,
    totalRecords: truncated ? Math.max(chunks.length, records.length) : records.length,
    totalLength,
    alphabetSummary: summarizeAlphabet(records.map((r) => r.alphabet)),
    warnings,
    truncated
  };
}
