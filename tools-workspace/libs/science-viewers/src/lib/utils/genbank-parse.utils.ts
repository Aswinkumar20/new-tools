import {
  GENBANK_MAX_FEATURES,
  GENBANK_MAX_RECORDS,
  GENBANK_MAX_SEQ_CHARS
} from '../constants/genbank-viewer.constants';
import type {
  GenbankFeature,
  GenbankQualifier,
  GenbankRecord,
  GenbankSpan,
  ParsedGenbank
} from '../types/genbank-viewer.types';

function splitTopLevel(input: string, sep: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of input) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (ch === sep && depth === 0) {
      if (current) parts.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  if (current) parts.push(current);
  return parts;
}

export function parseGenbankLocation(location: string): { spans: GenbankSpan[]; complement: boolean } {
  const compact = location.replace(/\s+/g, '');
  return parseLocNode(compact, false);
}

function parseLocNode(loc: string, inheritedComplement: boolean): { spans: GenbankSpan[]; complement: boolean } {
  if (!loc) return { spans: [], complement: inheritedComplement };
  if (loc.startsWith('complement(') && loc.endsWith(')')) {
    return parseLocNode(loc.slice(11, -1), true);
  }
  if ((loc.startsWith('join(') || loc.startsWith('order(')) && loc.endsWith(')')) {
    const inner = loc.slice(loc.indexOf('(') + 1, -1);
    const spans = splitTopLevel(inner, ',').flatMap((part) => parseLocNode(part, inheritedComplement).spans);
    return { spans, complement: inheritedComplement || spans.some((s) => s.complement) };
  }
  const range = loc.replace(/[<>]/g, '').match(/^(\d+)\.\.(\d+)$/);
  if (range) {
    const start = Number(range[1]);
    const end = Number(range[2]);
    return {
      spans: [{ start: Math.min(start, end), end: Math.max(start, end), complement: inheritedComplement }],
      complement: inheritedComplement
    };
  }
  const single = loc.replace(/[<>]/g, '').match(/^(\d+)$/);
  if (single) {
    const pos = Number(single[1]);
    return { spans: [{ start: pos, end: pos, complement: inheritedComplement }], complement: inheritedComplement };
  }
  return { spans: [], complement: inheritedComplement };
}

function qualifierLookup(qualifiers: GenbankQualifier[], key: string): string {
  return qualifiers.find((q) => q.key.toLowerCase() === key)?.value ?? '';
}

function parseQualLine(line: string): GenbankQualifier | null {
  const match = line.trim().match(/^\/([^=\s]+)(?:=(.*))?$/);
  if (!match) return null;
  let value = (match[2] ?? '').trim();
  if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
    value = value.slice(1, -1);
  } else if (value.startsWith('"')) {
    value = value.slice(1);
  }
  return { key: match[1], value };
}

function parseRecordText(block: string, index: number, warnings: string[]): GenbankRecord | null {
  const lines = block.replace(/\r/g, '').split('\n');
  if (!lines.some((l) => l.startsWith('LOCUS') || l.startsWith('FEATURES') || l.startsWith('ORIGIN'))) {
    return null;
  }

  let locus = `record_${index + 1}`;
  let length = 0;
  let molType = '';
  let topology = '';
  let division = '';
  let definition = '';
  let accession = '';
  let version = '';
  let keywords = '';
  let source = '';
  let organism = '';
  const references: string[] = [];
  const features: GenbankFeature[] = [];
  let sequence = '';

  let section: 'header' | 'features' | 'origin' = 'header';
  let currentField = '';
  let currentFeature: { type: string; location: string; qualifiers: GenbankQualifier[] } | null = null;
  let pendingQual: GenbankQualifier | null = null;

  const flushFeature = (): void => {
    if (pendingQual) {
      currentFeature?.qualifiers.push(pendingQual);
      pendingQual = null;
    }
    if (!currentFeature) return;
    if (features.length >= GENBANK_MAX_FEATURES) return;
    const parsedLoc = parseGenbankLocation(currentFeature.location);
    if (!parsedLoc.spans.length) {
      warnings.push(`${locus}: could not parse location “${currentFeature.location}” on ${currentFeature.type}.`);
    }
    const start = parsedLoc.spans.length ? Math.min(...parsedLoc.spans.map((s) => s.start)) : 0;
    const end = parsedLoc.spans.length ? Math.max(...parsedLoc.spans.map((s) => s.end)) : 0;
    const qualifiers = currentFeature.qualifiers;
    features.push({
      index: features.length,
      type: currentFeature.type,
      location: currentFeature.location,
      spans: parsedLoc.spans,
      start,
      end,
      complement: parsedLoc.complement,
      qualifiers,
      gene: qualifierLookup(qualifiers, 'gene'),
      product: qualifierLookup(qualifiers, 'product'),
      note: qualifierLookup(qualifiers, 'note'),
      locusTag: qualifierLookup(qualifiers, 'locus_tag')
    });
    currentFeature = null;
  };

  const applyHeaderValue = (field: string, value: string): void => {
    if (field === 'DEFINITION') definition = definition ? `${definition} ${value}` : value;
    else if (field === 'ACCESSION') accession = accession || value.split(/\s+/)[0];
    else if (field === 'VERSION') version = value;
    else if (field === 'KEYWORDS') keywords = keywords ? `${keywords} ${value}` : value;
    else if (field === 'SOURCE') source = source ? `${source} ${value}` : value;
    else if (field === 'REFERENCE') references.push(value);
    else if (field === 'AUTHORS' || field === 'TITLE' || field === 'JOURNAL' || field === 'PUBMED') {
      if (!references.length) references.push(value);
      else references[references.length - 1] = `${references[references.length - 1]} ${value}`.trim();
    }
  };

  for (const raw of lines) {
    const line = raw.replace(/\t/g, '    ');
    if (!line.trim()) continue;
    if (line.startsWith('FEATURES')) {
      flushFeature();
      section = 'features';
      continue;
    }
    if (line.startsWith('ORIGIN') || line.startsWith('CONTIG')) {
      flushFeature();
      section = line.startsWith('ORIGIN') ? 'origin' : 'header';
      continue;
    }
    if (line.startsWith('BASE COUNT')) continue;

    if (section === 'origin') {
      sequence += line.replace(/[^a-zA-Z]/g, '');
      continue;
    }

    if (section === 'features') {
      const featureMatch = line.match(/^ {1,5}([A-Za-z0-9_'-]+)\s+(\S.*)$/);
      if (featureMatch && !featureMatch[1].startsWith('/')) {
        flushFeature();
        currentFeature = { type: featureMatch[1], location: featureMatch[2].trim(), qualifiers: [] };
        continue;
      }
      const qual = parseQualLine(line);
      if (qual) {
        if (pendingQual) currentFeature?.qualifiers.push(pendingQual);
        if (line.includes('="') && !/"[^"]*"\s*$/.test(line.trim()) && (line.match(/"/g) ?? []).length % 2 === 1) {
          pendingQual = qual;
        } else {
          pendingQual = null;
          currentFeature?.qualifiers.push(qual);
        }
        continue;
      }
      if (pendingQual) {
        const extra = line.trim().replace(/^"/, '').replace(/"$/, '');
        pendingQual.value = `${pendingQual.value} ${extra}`.trim();
        if (line.trim().endsWith('"')) {
          currentFeature?.qualifiers.push(pendingQual);
          pendingQual = null;
        }
        continue;
      }
      if (currentFeature && line.trim()) {
        currentFeature.location = `${currentFeature.location}${line.trim()}`;
      }
      continue;
    }

    const organismMatch = line.match(/^\s+ORGANISM\s+(.*)$/);
    if (organismMatch) {
      organism = organismMatch[1].trim();
      currentField = 'ORGANISM';
      continue;
    }
    if (line[0] !== ' ' && /^[A-Z]/.test(line)) {
      const key = line.slice(0, 12).trim();
      const value = line.length > 12 ? line.slice(12).trim() : '';
      currentField = key;
      if (key === 'LOCUS') {
        const parts = value.split(/\s+/);
        locus = parts[0] || locus;
        const lenIdx = parts.findIndex((p) => /^\d+$/.test(p));
        if (lenIdx >= 0) length = Number(parts[lenIdx]);
        const bpIdx = parts.findIndex((p) => /^(bp|aa)$/i.test(p));
        molType = bpIdx >= 0 ? parts[bpIdx + 1] || '' : '';
        topology = bpIdx >= 0 ? parts[bpIdx + 2] || '' : '';
        division = bpIdx >= 0 ? parts[bpIdx + 3] || '' : '';
      } else {
        applyHeaderValue(key, value);
      }
      continue;
    }
    if (currentField === 'ORGANISM') {
      organism = organism ? `${organism} ${line.trim()}` : line.trim();
      continue;
    }
    if (currentField) applyHeaderValue(currentField, line.trim());
  }
  flushFeature();

  if (sequence.length > GENBANK_MAX_SEQ_CHARS) {
    sequence = sequence.slice(0, GENBANK_MAX_SEQ_CHARS);
    warnings.push(`${locus}: sequence truncated to ${GENBANK_MAX_SEQ_CHARS.toLocaleString()} bases.`);
  }
  if (!sequence) warnings.push(`${locus}: no ORIGIN sequence found.`);
  if (length && sequence && length !== sequence.length) {
    warnings.push(`${locus}: LOCUS length ${length} ≠ ORIGIN length ${sequence.length}.`);
  }
  if (!features.length) warnings.push(`${locus}: no features parsed.`);

  const types = [...new Set(features.map((f) => f.type))];
  return {
    index,
    locus,
    length: sequence.length || length,
    molType,
    topology,
    division,
    definition,
    accession,
    version,
    keywords: keywords.replace(/\.$/, ''),
    source,
    organism,
    references,
    features,
    sequence,
    featureTypes: types
  };
}

export function parseGenbankText(text: string): ParsedGenbank {
  const warnings: string[] = [];
  const trimmed = text.replace(/^\uFEFF/, '').trim();
  if (!trimmed) throw new Error('File is empty');
  if (trimmed.startsWith('>') && !/^\s*LOCUS\b/m.test(trimmed)) {
    throw new Error('This looks like FASTA — open it in FASTA Viewer.');
  }
  if (trimmed.startsWith('##fileformat=VCF') || trimmed.startsWith('#CHROM')) {
    throw new Error('This looks like VCF — open it in VCF Variant Viewer.');
  }
  if (!/^\s*LOCUS\b/m.test(trimmed) && !/^\s*FEATURES\b/m.test(trimmed)) {
    throw new Error('No GenBank LOCUS/FEATURES header found.');
  }

  const blocks = trimmed
    .split(/\n\/\/\s*(?:\n|$)/)
    .map((b) => b.trim())
    .filter(Boolean);
  const records: GenbankRecord[] = [];
  let truncated = false;
  for (const block of blocks) {
    if (records.length >= GENBANK_MAX_RECORDS) {
      truncated = true;
      break;
    }
    const record = parseRecordText(block, records.length, warnings);
    if (record) records.push(record);
  }
  if (!records.length) throw new Error('No GenBank records could be parsed.');
  if (truncated) warnings.push(`Only the first ${GENBANK_MAX_RECORDS} records are previewed.`);
  return {
    records,
    totalRecords: truncated ? Math.max(blocks.length, records.length) : records.length,
    warnings,
    truncated
  };
}

export function extractFeatureSequence(record: GenbankRecord, feature: GenbankFeature): string {
  if (!record.sequence || !feature.spans.length) return '';
  let seq = '';
  for (const span of feature.spans) {
    const start = Math.max(1, span.start);
    const end = Math.min(record.sequence.length, span.end);
    if (end < start) continue;
    let chunk = record.sequence.slice(start - 1, end);
    if (span.complement) {
      chunk = chunk
        .split('')
        .reverse()
        .map((ch) => ({ A: 'T', T: 'A', G: 'C', C: 'G', a: 't', t: 'a', g: 'c', c: 'g' }[ch] ?? ch))
        .join('');
    }
    seq += chunk;
  }
  return seq;
}
