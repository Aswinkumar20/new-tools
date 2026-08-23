import type { MoleculeRelatedToolLink, MoleculeSuggestion, ParsedMolecule } from './molecule.types';

export type MolecularExportFormat = 'original' | 'summary-json' | 'atoms-csv' | 'png';
export type MolecularStyle = 'ball-stick' | 'spacefill' | 'wireframe';

export interface MolecularLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  text: string;
  parsed: ParsedMolecule | null;
  warnings: string[];
  softFail: boolean;
}

export type { MoleculeRelatedToolLink as MolecularRelatedToolLink, MoleculeSuggestion as MolecularSuggestion, ParsedMolecule };
