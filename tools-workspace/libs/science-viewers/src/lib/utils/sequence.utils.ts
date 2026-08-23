import type { SequenceAlphabet, SequenceComposition, SequenceHistogramBar, SequenceWrapLine } from '../types/sequence.types';

const DNA = new Set('ACGTNacgtn'.split(''));
const RNA = new Set('ACGUNacgun'.split(''));
const AA = new Set('ACDEFGHIKLMNPQRSTVWYBXZ*-acdefghiklmnpqrstvwybxz'.split(''));
const COMPLEMENT: Record<string, string> = {
  A: 'T',
  T: 'A',
  G: 'C',
  C: 'G',
  U: 'A',
  N: 'N',
  a: 't',
  t: 'a',
  g: 'c',
  c: 'g',
  u: 'a',
  n: 'n'
};

const CODON: Record<string, string> = {
  TTT: 'F', TTC: 'F', TTA: 'L', TTG: 'L',
  TCT: 'S', TCC: 'S', TCA: 'S', TCG: 'S',
  TAT: 'Y', TAC: 'Y', TAA: '*', TAG: '*',
  TGT: 'C', TGC: 'C', TGA: '*', TGG: 'W',
  CTT: 'L', CTC: 'L', CTA: 'L', CTG: 'L',
  CCT: 'P', CCC: 'P', CCA: 'P', CCG: 'P',
  CAT: 'H', CAC: 'H', CAA: 'Q', CAG: 'Q',
  CGT: 'R', CGC: 'R', CGA: 'R', CGG: 'R',
  ATT: 'I', ATC: 'I', ATA: 'I', ATG: 'M',
  ACT: 'T', ACC: 'T', ACA: 'T', ACG: 'T',
  AAT: 'N', AAC: 'N', AAA: 'K', AAG: 'K',
  AGT: 'S', AGC: 'S', AGA: 'R', AGG: 'R',
  GTT: 'V', GTC: 'V', GTA: 'V', GTG: 'V',
  GCT: 'A', GCC: 'A', GCA: 'A', GCG: 'A',
  GAT: 'D', GAC: 'D', GAA: 'E', GAG: 'E',
  GGT: 'G', GGC: 'G', GGA: 'G', GGG: 'G'
};

export const NT_COLORS: Record<string, string> = {
  A: '#22c55e',
  C: '#38bdf8',
  G: '#f59e0b',
  T: '#f43f5e',
  U: '#e879f9',
  N: '#94a3b8',
  '-': '#64748b'
};

export const AA_COLORS: Record<string, string> = {
  G: '#f59e0b', A: '#f59e0b', V: '#f59e0b', L: '#f59e0b', I: '#f59e0b', P: '#f97316', M: '#84cc16',
  F: '#a855f7', Y: '#a855f7', W: '#a855f7',
  S: '#22c55e', T: '#22c55e', N: '#14b8a6', Q: '#14b8a6',
  K: '#3b82f6', R: '#3b82f6', H: '#6366f1',
  D: '#ef4444', E: '#ef4444',
  C: '#eab308',
  '*': '#94a3b8', X: '#94a3b8', B: '#94a3b8', Z: '#94a3b8'
};

export function normalizeSequence(raw: string): string {
  return raw.replace(/\s+/g, '').replace(/\d+/g, '');
}

export function detectAlphabet(sequence: string): SequenceAlphabet {
  if (!sequence) return 'unknown';
  let dna = 0;
  let rna = 0;
  let aa = 0;
  let other = 0;
  let u = 0;
  let t = 0;
  for (const ch of sequence) {
    if (ch === 'U' || ch === 'u') u += 1;
    if (ch === 'T' || ch === 't') t += 1;
    if (DNA.has(ch)) dna += 1;
    if (RNA.has(ch)) rna += 1;
    if (AA.has(ch)) aa += 1;
    else if (!DNA.has(ch) && !RNA.has(ch)) other += 1;
  }
  const len = sequence.length;
  if (other / len > 0.08) return 'unknown';
  if (u > 0 && t === 0 && rna / len >= 0.9) return 'rna';
  if (dna / len >= 0.9 && /[EFILPQ]/i.test(sequence) === false) return 'dna';
  if (aa / len >= 0.9 && /[EFILPQ]/i.test(sequence)) return 'protein';
  if (dna / len >= 0.95) return 'dna';
  if (aa / len >= 0.9) return 'protein';
  return 'mixed';
}

export function sequenceComposition(sequence: string): SequenceComposition {
  const counts: SequenceComposition = {};
  for (const ch of sequence.toUpperCase()) {
    counts[ch] = (counts[ch] ?? 0) + 1;
  }
  return counts;
}

export function gcPercent(sequence: string, alphabet: SequenceAlphabet): number | null {
  if (alphabet === 'protein' || alphabet === 'unknown') return null;
  const upper = sequence.toUpperCase();
  let gc = 0;
  let atgc = 0;
  for (const ch of upper) {
    if (ch === 'G' || ch === 'C') {
      gc += 1;
      atgc += 1;
    } else if (ch === 'A' || ch === 'T' || ch === 'U') {
      atgc += 1;
    }
  }
  if (!atgc) return null;
  return (gc / atgc) * 100;
}

export function nCount(sequence: string): number {
  let n = 0;
  for (const ch of sequence) {
    if (ch === 'N' || ch === 'n') n += 1;
  }
  return n;
}

export function wrapSequence(sequence: string, width: number): SequenceWrapLine[] {
  if (!sequence) return [];
  if (!width || width <= 0) return [{ start: 1, text: sequence }];
  const lines: SequenceWrapLine[] = [];
  for (let i = 0; i < sequence.length; i += width) {
    lines.push({ start: i + 1, text: sequence.slice(i, i + width) });
  }
  return lines;
}

export function reverseComplement(sequence: string): string {
  let out = '';
  for (let i = sequence.length - 1; i >= 0; i--) {
    const ch = sequence[i];
    out += COMPLEMENT[ch] ?? ch;
  }
  return out;
}

export function translateSequence(sequence: string, frame = 0): string {
  const upper = sequence.toUpperCase().replace(/U/g, 'T');
  const start = Math.max(0, Math.min(2, frame));
  let protein = '';
  for (let i = start; i + 2 < upper.length; i += 3) {
    const codon = upper.slice(i, i + 3);
    protein += CODON[codon] ?? 'X';
  }
  return protein;
}

export function residueColor(ch: string, alphabet: SequenceAlphabet): string {
  const up = ch.toUpperCase();
  if (alphabet === 'protein') return AA_COLORS[up] ?? '#94a3b8';
  return NT_COLORS[up] ?? '#cbd5e1';
}

export function qualityColor(q: number): string {
  if (q < 10) return '#ef4444';
  if (q < 20) return '#f59e0b';
  if (q < 30) return '#84cc16';
  return '#22c55e';
}

export function phredScores(quality: string, encoding: 'phred33' | 'phred64'): number[] {
  const offset = encoding === 'phred64' ? 64 : 33;
  const scores: number[] = [];
  for (let i = 0; i < quality.length; i++) {
    scores.push(Math.max(0, Math.min(93, quality.charCodeAt(i) - offset)));
  }
  return scores;
}

export function detectFastqEncoding(qualities: string[]): 'phred33' | 'phred64' {
  let min = 255;
  let max = 0;
  for (const qual of qualities) {
    for (let i = 0; i < qual.length; i++) {
      const code = qual.charCodeAt(i);
      if (code < min) min = code;
      if (code > max) max = code;
    }
  }
  if (!Number.isFinite(min) || min === 255) return 'phred33';
  if (min >= 64 && max > 80) return 'phred64';
  return 'phred33';
}

export function buildCompositionBars(composition: SequenceComposition, alphabet: SequenceAlphabet): SequenceHistogramBar[] {
  const entries = Object.entries(composition).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const max = entries[0]?.[1] ?? 1;
  return entries.map(([label, count]) => ({
    label,
    count,
    heightPct: Math.max(4, Math.round((count / max) * 100)),
    color: residueColor(label, alphabet)
  }));
}

export function summarizeAlphabet(alphabets: SequenceAlphabet[]): SequenceAlphabet {
  const unique = new Set(alphabets.filter((a) => a !== 'unknown'));
  if (!unique.size) return 'unknown';
  if (unique.size === 1) return [...unique][0];
  return 'mixed';
}

export function bytesToText(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, '');
}
