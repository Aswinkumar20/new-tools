import {
  BPSIM_BPMN_SAMPLE,
  BPSIM_CSV_SAMPLE,
  BPSIM_JSON_SAMPLE,
  BPSIM_PNML_SAMPLE
} from '../constants/business-process-simulator-sample.data';
import {
  enabledBpsimIds,
  fireBpsimStep,
  initialBpsimMarking,
  parseBpsimText
} from './business-process-simulator-parse.utils';
import {
  canExportBpsim,
  createBpsimFileRecord,
  createSampleBpsimFile,
  exportBpsimScenariosCsv,
  filterValidBpsimFiles
} from './business-process-simulator.utils';

describe('business-process-simulator-parse.utils', () => {
  it('parses the order fulfillment BPMN sample', () => {
    const parsed = parseBpsimText(BPSIM_BPMN_SAMPLE, 'sample-order-sim.bpmn');
    expect(parsed.sourceKind).toBe('bpmn');
    expect(parsed.engine).toBe('bpmn');
    expect(parsed.nodes.length).toBe(7);
    expect(parsed.edges.length).toBe(7);
    expect(parsed.scenarios.length).toBe(3);
    expect(parsed.nodes.some((n) => n.kind === 'gateway')).toBe(true);
  });

  it('steps the happy-path scenario to Done', () => {
    const parsed = parseBpsimText(BPSIM_BPMN_SAMPLE, 'order.bpmn');
    const happy = parsed.scenarios.find((s) => /happy/i.test(s.name));
    let marking = initialBpsimMarking(parsed, happy);
    const choices = happy?.choices ?? { check: 'in stock' };
    expect(enabledBpsimIds(parsed, marking)).toContain('start');
    const steps = ['start', 'receive', 'check', 'pack', 'ship'];
    for (const id of steps) {
      const result = fireBpsimStep(parsed, marking, id, choices);
      expect(result.ok).toBe(true);
      marking = result.marking;
    }
    expect(marking.end).toBe(1);
    expect(marking.wait ?? 0).toBe(0);
  });

  it('routes backorder through Wait restock', () => {
    const parsed = parseBpsimText(BPSIM_JSON_SAMPLE, 'order.json');
    const back = parsed.scenarios.find((s) => /backorder/i.test(s.name));
    let marking = initialBpsimMarking(parsed, back);
    const choices = back?.choices ?? { check: 'backorder' };
    for (const id of ['start', 'receive', 'check']) {
      const result = fireBpsimStep(parsed, marking, id, choices);
      expect(result.ok).toBe(true);
      marking = result.marking;
    }
    expect(marking.wait).toBe(1);
    expect(marking.pack ?? 0).toBe(0);
  });

  it('parses CSV scenarios and PNML token fire', () => {
    const csv = parseBpsimText(BPSIM_CSV_SAMPLE, 'order.csv');
    expect(csv.sourceKind).toBe('csv');
    expect(csv.scenarios.length).toBe(3);
    const pnml = parseBpsimText(BPSIM_PNML_SAMPLE, 'counter.pnml');
    expect(pnml.engine).toBe('petri');
    expect(pnml.nodes.filter((n) => n.kind === 'place').length).toBe(2);
    const marking = initialBpsimMarking(pnml, pnml.scenarios[0]);
    expect(enabledBpsimIds(pnml, marking)).toEqual(['t_tick']);
    const fired = fireBpsimStep(pnml, marking, 't_tick', {});
    expect(fired.ok).toBe(true);
    expect(fired.marking.p_done).toBe(1);
  });

  it('rejects empty or unknown text', () => {
    expect(() => parseBpsimText('')).toThrow(/empty/i);
    expect(() => parseBpsimText('hello world')).toThrow(/Not a BPMN/i);
  });
});

describe('business-process-simulator.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleBpsimFile();
    expect(file.name).toBe('sample-order-sim.bpmn');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample BPMN', () => {
    const file = createSampleBpsimFile();
    const record = createBpsimFileRecord(file, new TextEncoder().encode(BPSIM_BPMN_SAMPLE));
    expect(record.softFail).toBe(false);
    expect(record.parsed?.nodes.length).toBe(7);
    expect(canExportBpsim(record)).toBe(true);
  });

  it('exports scenario csv', () => {
    const parsed = parseBpsimText(BPSIM_JSON_SAMPLE, 'order.json');
    const csv = exportBpsimScenariosCsv(parsed);
    expect(csv).toContain('index,id,name,description,marking,choices');
    expect(csv).toContain('Happy path');
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSampleBpsimFile();
    const { accepted, rejected } = filterValidBpsimFiles([
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'sim.bpmn.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });
});
