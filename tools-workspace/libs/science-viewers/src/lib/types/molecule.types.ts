export type MoleculeStyle = 'ball-stick' | 'spacefill' | 'wireframe' | 'backbone' | 'ribbon';

export interface MoleculeAtom {
  index: number;
  serial: number;
  name: string;
  element: string;
  x: number;
  y: number;
  z: number;
  residueName: string;
  residueSeq: number;
  chainId: string;
  hetero: boolean;
  occupancy?: number;
  tempFactor?: number;
}

export interface MoleculeBond {
  from: number;
  to: number;
  order: number;
}

export interface MoleculeResidue {
  id: string;
  chainId: string;
  resSeq: number;
  resName: string;
  atomIndices: number[];
  caIndex: number | null;
  secondary: 'helix' | 'sheet' | 'coil';
}

export interface MoleculeChain {
  id: string;
  residueCount: number;
  atomCount: number;
  sequence: string;
}

export interface MoleculeSecondarySpan {
  kind: 'helix' | 'sheet';
  chainId: string;
  startRes: number;
  endRes: number;
  label: string;
}

export interface ParsedMolecule {
  format: 'pdb' | 'mol' | 'sdf';
  title: string;
  header: string;
  atoms: MoleculeAtom[];
  bonds: MoleculeBond[];
  residues: MoleculeResidue[];
  chains: MoleculeChain[];
  secondary: MoleculeSecondarySpan[];
  elementCounts: Record<string, number>;
  center: { x: number; y: number; z: number };
  radius: number;
  warnings: string[];
}

export interface MoleculeMetadataRow {
  key: string;
  value: string;
}

export interface MoleculeSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}

export interface MoleculeRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface MoleculeRenderOptions {
  style: MoleculeStyle;
  rotX: number;
  rotY: number;
  zoom: number;
  showHydrogens: boolean;
  showHetero?: boolean;
  highlightAtom: number | null;
  highlightResidue: string | null;
  chainFilter: string | null;
  background?: string;
}
