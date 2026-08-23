import {
  SIMULATION_CSV_SAMPLE,
  SIMULATION_JSON_SAMPLE,
  SIMULATION_SIM_SAMPLE,
  SIMULATION_VTK_SAMPLE
} from '../constants/simulation-sample.data';
import { parseSimulationText } from './simulation-parse.utils';
import {
  canExportSim,
  createSampleSimFile,
  createSimFileRecord,
  exportSimProbesCsv,
  filterValidSimFiles
} from './simulation-result-viewer.utils';

describe('simulation-parse.utils', () => {
  it('parses the heat-diffusion JSON sample', () => {
    const parsed = parseSimulationText(SIMULATION_JSON_SAMPLE);
    expect(parsed.name).toContain('Heat diffusion');
    expect(parsed.nx).toBe(40);
    expect(parsed.ny).toBe(28);
    expect(parsed.nt).toBe(16);
    expect(parsed.probes.length).toBe(3);
    expect(parsed.metrics.map((m) => m.name)).toEqual(['maxT', 'meanT']);
    expect(parsed.dataMax).toBeGreaterThan(parsed.dataMin);
  });

  it('parses simulation CSV', () => {
    const parsed = parseSimulationText(SIMULATION_CSV_SAMPLE, 'csv');
    expect(parsed.sourceKind).toBe('csv');
    expect(parsed.nx).toBe(2);
    expect(parsed.ny).toBe(2);
    expect(parsed.nt).toBe(3);
  });

  it('parses VTK structured points and .sim text', () => {
    const vtk = parseSimulationText(SIMULATION_VTK_SAMPLE, 'vtk');
    expect(vtk.sourceKind).toBe('vtk');
    expect(vtk.nx).toBe(4);
    expect(vtk.ny).toBe(3);
    expect(vtk.nt).toBe(2);
    const sim = parseSimulationText(SIMULATION_SIM_SAMPLE, 'sim');
    expect(sim.sourceKind).toBe('sim');
    expect(sim.probes[0].id).toBe('center');
    expect(sim.nt).toBe(3);
  });

  it('rejects empty or unknown text', () => {
    expect(() => parseSimulationText('')).toThrow(/empty/i);
    expect(() => parseSimulationText('hello world')).toThrow(/Unrecognized|simulation/i);
  });
});

describe('simulation-result-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleSimFile();
    expect(file.name).toBe('sample-heat-diffusion.json');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample text', () => {
    const file = createSampleSimFile();
    const record = createSimFileRecord(file, new TextEncoder().encode(SIMULATION_JSON_SAMPLE));
    expect(record.softFail).toBe(false);
    expect(record.parsed?.fields.length).toBe(16);
    expect(canExportSim(record)).toBe(true);
  });

  it('exports probes csv', () => {
    const parsed = parseSimulationText(SIMULATION_JSON_SAMPLE);
    const csv = exportSimProbesCsv(parsed);
    expect(csv).toContain('time,center,mid-right,edge,maxT,meanT');
    expect(csv.split('\n').length).toBe(17);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSampleSimFile();
    const { accepted, rejected } = filterValidSimFiles([
      sample,
      new File(['x'], 'run.sgy', { lastModified: 1 }),
      new File(['x'], 'run.json.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });
});
