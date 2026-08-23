import type { MoleculeRelatedToolLink } from '../types/molecule.types';
import { MOLECULAR_SAMPLE_MOL } from './molecular-sample.data';

export const MOLECULAR_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.pdb', '.ent', '.mol', '.sdf'];

export const MOLECULAR_ACCEPT_ATTR = '.pdb,.ent,.mol,.sdf,chemical/x-pdb,chemical/x-mdl-molfile';

export const MOLECULAR_FORMATS_LABEL = '.pdb, .mol, .sdf';

export const MOLECULAR_FORMATS_HINT =
  'PDB, MOL, and SDF stay in your browser. Ball-and-stick, spacefill, and wireframe previews are for education/research only.';

export const MOLECULAR_MAX_FILE_BYTES = 15 * 1024 * 1024;

export { MOLECULAR_SAMPLE_MOL };

export const MOLECULAR_RELATED_TOOLS: ReadonlyArray<MoleculeRelatedToolLink> = [
  { label: 'Protein Structure Viewer', description: 'PDB ribbons and residues', path: '/science-viewers/protein-structure-viewer' },
  { label: 'FASTA Viewer', description: 'Sequence browsing', path: '/science-viewers/fasta-viewer' },
  { label: 'HDF5 Viewer', description: 'Scientific datasets', path: '/science-viewers/hdf5-viewer' }
];
