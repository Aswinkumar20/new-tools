import type { MoleculeRelatedToolLink } from '../types/molecule.types';
import { PROTEIN_SAMPLE_PDB } from './protein-sample.data';

export const PROTEIN_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.pdb', '.ent'];

export const PROTEIN_ACCEPT_ATTR = '.pdb,.ent,chemical/x-pdb';

export const PROTEIN_FORMATS_LABEL = '.pdb';

export const PROTEIN_FORMATS_HINT =
  'Protein PDB files stay in your browser. Ribbon, backbone, and ball-and-stick previews plus residue search are for education/research only.';

export const PROTEIN_MAX_FILE_BYTES = 25 * 1024 * 1024;

export { PROTEIN_SAMPLE_PDB };

export const PROTEIN_RELATED_TOOLS: ReadonlyArray<MoleculeRelatedToolLink> = [
  { label: 'Molecular Structure Viewer', description: 'Small-molecule PDB/MOL/SDF', path: '/science-viewers/molecular-structure-viewer' },
  { label: 'FASTA Viewer', description: 'Sequence browsing', path: '/science-viewers/fasta-viewer' },
  { label: 'HDF5 Viewer', description: 'Scientific datasets', path: '/science-viewers/hdf5-viewer' }
];
