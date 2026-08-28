import { PETRI_NET_CSV_SAMPLE, PETRI_NET_JSON_SAMPLE, PETRI_NET_XML_SAMPLE } from '../constants/petri-net-sample.data';
import {
  enabledPetriNetIds,
  firePetriNetTransition,
  initialPetriNetMarking,
  parsePetriNetText
} from './petri-net-parse.utils';
import {
  canExportPetriNet,
  createPetriNetFileRecord,
  createSamplePetriNetFile,
  exportPetriNetMarkingCsv,
  filterValidPetriNetFiles,
  resolvePetriNetSuggestion
} from './petri-net-viewer.utils';

describe('petri-net-parse.utils', () => {
  it('parses the vending machine PNML sample', () => {
    const parsed = parsePetriNetText(PETRI_NET_XML_SAMPLE);
    expect(parsed.sourceKind).toBe('pnml');
    expect(parsed.name).toContain('Vending');
    expect(parsed.places.length).toBe(5);
    expect(parsed.transitions.length).toBe(3);
    expect(parsed.arcs.length).toBe(8);
    const marking = initialPetriNetMarking(parsed);
    expect(marking.p_idle).toBe(1);
    expect(marking.p_stock).toBe(3);
    expect(enabledPetriNetIds(parsed, marking)).toEqual(['t_insert']);
  });

  it('fires token flow insert → select → vend', () => {
    const parsed = parsePetriNetText(PETRI_NET_XML_SAMPLE);
    let marking = initialPetriNetMarking(parsed);
    const insert = firePetriNetTransition(parsed, marking, 't_insert');
    expect(insert.ok).toBe(true);
    marking = insert.marking;
    expect(marking.p_coins).toBe(1);
    expect(marking.p_idle).toBe(0);
    expect(enabledPetriNetIds(parsed, marking)).toEqual(['t_select']);
    const select = firePetriNetTransition(parsed, marking, 't_select');
    expect(select.ok).toBe(true);
    marking = select.marking;
    expect(marking.p_stock).toBe(2);
    expect(marking.p_selected).toBe(1);
    const vend = firePetriNetTransition(parsed, marking, 't_vend');
    expect(vend.ok).toBe(true);
    expect(vend.marking.p_dispensed).toBe(1);
    expect(vend.marking.p_idle).toBe(1);
  });

  it('parses Petri net JSON and CSV', () => {
    const json = parsePetriNetText(PETRI_NET_JSON_SAMPLE, 'vending.json');
    expect(json.sourceKind).toBe('json');
    expect(json.places.length).toBe(3);
    expect(enabledPetriNetIds(json, initialPetriNetMarking(json))).toContain('t_insert');
    const csv = parsePetriNetText(PETRI_NET_CSV_SAMPLE, 'vending.csv');
    expect(csv.sourceKind).toBe('csv');
    expect(csv.places.length).toBe(3);
    expect(csv.arcs.length).toBe(4);
  });

  it('rejects empty or unknown text', () => {
    expect(() => parsePetriNetText('')).toThrow(/empty/i);
    expect(() => parsePetriNetText('hello world')).toThrow(/No Petri net/i);
  });
});

describe('petri-net-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSamplePetriNetFile();
    expect(file.name).toBe('sample-vending-net.pnml');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample net', () => {
    const file = createSamplePetriNetFile();
    const record = createPetriNetFileRecord(file, new TextEncoder().encode(PETRI_NET_XML_SAMPLE));
    expect(record.softFail).toBe(false);
    expect(record.parsed?.places.length).toBe(5);
    expect(canExportPetriNet(record)).toBe(true);
  });

  it('exports marking csv', () => {
    const parsed = parsePetriNetText(PETRI_NET_XML_SAMPLE);
    const csv = exportPetriNetMarkingCsv(parsed, initialPetriNetMarking(parsed));
    expect(csv).toContain('index,id,name,initial,tokens');
    expect(csv.split('\n').length).toBe(6);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSamplePetriNetFile();
    const { accepted, rejected } = filterValidPetriNetFiles([
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'net.pnml.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });

  it('resolvePetriNetSuggestion returns upload-or-sample when empty', () => {
    expect(resolvePetriNetSuggestion({ hasFiles: false, hasError: false })?.id).toBe('upload-or-sample');
  });

  it('resolvePetriNetSuggestion returns sample-after-error when hasError', () => {
    expect(resolvePetriNetSuggestion({ hasFiles: true, hasError: true })?.id).toBe('sample-after-error');
  });

  it('canExportPetriNet returns false for null', () => {
    expect(canExportPetriNet(null)).toBe(false);
  });

  it('soft-fail record has parsed null and disables export', () => {
    const record = createPetriNetFileRecord(new File(['hello world'], 'bad.pnml', { lastModified: 9 }), new TextEncoder().encode('hello world'));
    expect(record.softFail).toBe(true);
    expect(record.parsed).toBeNull();
    expect(canExportPetriNet(record)).toBe(false);
  });
});
