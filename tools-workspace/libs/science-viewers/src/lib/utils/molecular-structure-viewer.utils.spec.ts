import { MOLECULAR_SAMPLE_MOL } from '../constants/molecular-sample.data';
import { parseMoleculeText } from './molecule-parse.utils';
import {
  canExportMolecular,
  createMolecularFileRecord,
  createSampleMolecularFile,
  filterValidMolecularFiles
} from './molecular-structure-viewer.utils';

describe('molecule-parse.utils mol', () => {
  it('parses the sample ethanol MOL', () => {
    const parsed = parseMoleculeText(MOLECULAR_SAMPLE_MOL, 'sample-ethanol.mol');
    expect(parsed.format).toBe('mol');
    expect(parsed.atoms.length).toBe(9);
    expect(parsed.bonds.length).toBe(8);
    expect(parsed.elementCounts['C']).toBe(2);
    expect(parsed.elementCounts['O']).toBe(1);
    expect(parsed.elementCounts['H']).toBe(6);
  });
});

describe('molecular-structure-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleMolecularFile();
    expect(file.name).toBe('sample-ethanol.mol');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample text', () => {
    const file = createSampleMolecularFile();
    const bytes = new TextEncoder().encode(MOLECULAR_SAMPLE_MOL);
    const record = createMolecularFileRecord(file, bytes);
    expect(record.softFail).toBe(false);
    expect(record.parsed?.atoms.length).toBe(9);
    expect(canExportMolecular(record)).toBe(true);
  });

  it('rejects unsupported and duplicate files', () => {
    const sample = createSampleMolecularFile();
    const { accepted, rejected } = filterValidMolecularFiles([
      sample,
      sample,
      new File(['x'], 'notes.txt', { type: 'text/plain', lastModified: 1 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Duplicate'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
  });
});

describe('molecule-parse.utils sdf warnings', () => {
  it('warns when SDF has multiple molecules', () => {
    const sdf = `${MOLECULAR_SAMPLE_MOL}$$$$\n${MOLECULAR_SAMPLE_MOL}$$$$\n`;
    const parsed = parseMoleculeText(sdf, 'pair.sdf');
    expect(parsed.format).toBe('sdf');
    expect(parsed.warnings.some((w) => w.includes('multiple molecules') || w.includes('SDF contains'))).toBe(true);
  });
});
