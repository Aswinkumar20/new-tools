import { PROTEIN_SAMPLE_PDB } from '../constants/protein-sample.data';
import { parseMoleculeText } from './molecule-parse.utils';
import {
  canExportProtein,
  createProteinFileRecord,
  createSampleProteinFile,
  filterResidues,
  filterValidProteinFiles
} from './protein-structure-viewer.utils';

describe('molecule-parse.utils pdb', () => {
  it('parses the sample helix PDB', () => {
    const parsed = parseMoleculeText(PROTEIN_SAMPLE_PDB, 'sample-helix.pdb');
    expect(parsed.format).toBe('pdb');
    expect(parsed.atoms.length).toBe(60);
    expect(parsed.residues.length).toBe(12);
    expect(parsed.chains[0]?.sequence).toBe('AAAAAAAAAAAA');
    expect(parsed.residues.some((r) => r.secondary === 'helix')).toBe(true);
    expect(parsed.residues.every((r) => r.caIndex != null)).toBe(true);
  });
});

describe('protein-structure-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleProteinFile();
    expect(file.name).toBe('sample-helix.pdb');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample text', () => {
    const file = createSampleProteinFile();
    const bytes = new TextEncoder().encode(PROTEIN_SAMPLE_PDB);
    const record = createProteinFileRecord(file, bytes);
    expect(record.softFail).toBe(false);
    expect(record.parsed?.residues.length).toBe(12);
    expect(canExportProtein(record)).toBe(true);
  });

  it('filters residues by query and chain', () => {
    const parsed = parseMoleculeText(PROTEIN_SAMPLE_PDB, 'sample-helix.pdb');
    expect(filterResidues(parsed.residues, '12', null).length).toBe(1);
    expect(filterResidues(parsed.residues, 'ala', null).length).toBe(12);
    expect(filterResidues(parsed.residues, '', 'B').length).toBe(0);
    expect(filterResidues(parsed.residues, '', 'A').length).toBe(12);
  });

  it('rejects unsupported protein files', () => {
    const sample = createSampleProteinFile();
    const { accepted, rejected } = filterValidProteinFiles([
      sample,
      new File(['x'], 'ligand.mol', { type: 'chemical/x-mdl-molfile', lastModified: 1 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
  });
});
