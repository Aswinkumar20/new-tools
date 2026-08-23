import {
  PROCESS_MINING_CSV_SAMPLE,
  PROCESS_MINING_JSON_SAMPLE,
  PROCESS_MINING_MAP_JSON_SAMPLE,
  PROCESS_MINING_XES_SAMPLE
} from '../constants/process-mining-sample.data';
import { filterProcessMiningVariants, parseProcessMiningText } from './process-mining-parse.utils';
import {
  canExportProcessMining,
  createProcessMiningFileRecord,
  createSampleProcessMiningFile,
  exportProcessMiningVariantsCsv,
  filterValidProcessMiningFiles
} from './process-mining-viewer.utils';

describe('process-mining-parse.utils', () => {
  it('mines variants and DFG from the order fulfillment XES sample', () => {
    const parsed = parseProcessMiningText(PROCESS_MINING_XES_SAMPLE, 'sample-order-mining.xes');
    expect(parsed.sourceKind).toBe('xes');
    expect(parsed.name).toContain('Order');
    expect(parsed.cases).toBe(8);
    expect(parsed.events).toBe(42);
    expect(parsed.variants.length).toBe(3);
    expect(parsed.variants[0].cases).toBe(5);
    expect(parsed.variants[0].pct).toBe(62.5);
    expect(parsed.dfg.some((e) => e.sourceName === 'Check credit' && e.targetName === 'Reject' && e.frequency === 2)).toBe(true);
  });

  it('parses mining JSON, CSV, and pre-mined maps', () => {
    const json = parseProcessMiningText(PROCESS_MINING_JSON_SAMPLE, 'log.json');
    expect(json.sourceKind).toBe('json');
    expect(json.variants.length).toBe(3);
    const csv = parseProcessMiningText(PROCESS_MINING_CSV_SAMPLE, 'log.csv');
    expect(csv.sourceKind).toBe('csv');
    expect(csv.cases).toBe(8);
    const map = parseProcessMiningText(PROCESS_MINING_MAP_JSON_SAMPLE, 'map.json');
    expect(map.variants.length).toBe(3);
    expect(map.dfg.length).toBe(9);
    expect(map.warnings.some((w) => /pre-mined/i.test(w))).toBe(true);
  });

  it('filters reject variants', () => {
    const parsed = parseProcessMiningText(PROCESS_MINING_XES_SAMPLE, 'sample.xes');
    expect(filterProcessMiningVariants(parsed.variants, 'reject').every((v) => /reject/i.test(v.name + v.pathLabel))).toBe(true);
  });

  it('rejects empty or unknown text', () => {
    expect(() => parseProcessMiningText('')).toThrow(/empty/i);
    expect(() => parseProcessMiningText('hello world')).toThrow(/No event log/i);
  });
});

describe('process-mining-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleProcessMiningFile();
    expect(file.name).toBe('sample-order-mining.xes');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample mining log', () => {
    const file = createSampleProcessMiningFile();
    const record = createProcessMiningFileRecord(file, new TextEncoder().encode(PROCESS_MINING_XES_SAMPLE));
    expect(record.softFail).toBe(false);
    expect(record.parsed?.variants.length).toBe(3);
    expect(canExportProcessMining(record)).toBe(true);
  });

  it('exports variants csv', () => {
    const parsed = parseProcessMiningText(PROCESS_MINING_XES_SAMPLE, 'sample.xes');
    const csv = exportProcessMiningVariantsCsv(parsed);
    expect(csv).toContain('index,name,cases,pct,path');
    expect(csv.split('\n').length).toBe(4);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSampleProcessMiningFile();
    const { accepted, rejected } = filterValidProcessMiningFiles([
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'log.xes.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });
});
