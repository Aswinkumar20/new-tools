import type { MoleculeRelatedToolLink, MoleculeSuggestion, ParsedMolecule } from './molecule.types';

export type ProteinExportFormat = 'original' | 'summary-json' | 'residues-csv' | 'png';
export type ProteinStyle = 'ribbon' | 'backbone' | 'ball-stick' | 'spacefill';

export interface ProteinLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  text: string;
  parsed: ParsedMolecule | null;
  warnings: string[];
  softFail: boolean;
}

export type { MoleculeRelatedToolLink as ProteinRelatedToolLink, MoleculeSuggestion as ProteinSuggestion, ParsedMolecule };
