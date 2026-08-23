import {
  PROTEIN_MAX_FILE_BYTES,
  PROTEIN_SAMPLE_PDB,
  PROTEIN_SUPPORTED_EXTENSIONS
} from '../constants/protein-structure-viewer.constants';
import type { ProteinLoadedFile } from '../types/protein-structure-viewer.types';
import type { MoleculeMetadataRow, MoleculeResidue, MoleculeSuggestion, ParsedMolecule } from '../types/molecule.types';
import { bytesToText, parseMoleculeText } from './molecule-parse.utils';
import { formatScienceFileSize, getFileExtension } from './science-file.utils';

export {
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatScienceFileSize as formatProteinFileSize,
  readFileBytes as readProteinFileBytes
} from './science-file.utils';

export { parseMoleculeText, bytesToText } from './molecule-parse.utils';
export { hitTestAtom, renderMolecule, CPK_COLORS, SS_COLORS } from './molecule-render.utils';

export function isSupportedProteinFile(file: File): boolean {
  const ext = getFileExtension(file.name);
  return (PROTEIN_SUPPORTED_EXTENSIONS as readonly string[]).includes(ext);
}

export function validateProteinFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > PROTEIN_MAX_FILE_BYTES) {
    return `File is too large (max ${formatScienceFileSize(PROTEIN_MAX_FILE_BYTES)})`;
  }
  return null;
}

export function filterValidProteinFiles(files: FileList | File[]): {
  accepted: File[];
  rejected: Array<{ name: string; reason: string }>;
} {
  const accepted: File[] = [];
  const rejected: Array<{ name: string; reason: string }> = [];
  const seen = new Set<string>();
  for (const file of Array.from(files)) {
    const key = `${file.name}|${file.size}|${file.lastModified}`;
    if (seen.has(key)) {
      rejected.push({ name: file.name, reason: 'Duplicate file in this selection' });
      continue;
    }
    seen.add(key);
    if (!isSupportedProteinFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .pdb)' });
      continue;
    }
    const sizeError = validateProteinFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleProteinFile(): File {
  return new File([PROTEIN_SAMPLE_PDB], 'sample-helix.pdb', {
    type: 'chemical/x-pdb',
    lastModified: 0
  });
}

export function createProteinFileRecord(file: File, bytes: Uint8Array): ProteinLoadedFile {
  const extension = getFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: ParsedMolecule | null = null;
  let softFail = false;
  try {
    parsed = parseMoleculeText(text, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.atoms.length) softFail = true;
    if (!parsed.residues.length) warnings.push('No residues detected — file may be a small ligand PDB.');
    if (!parsed.residues.some((r) => r.caIndex != null)) {
      warnings.push('No Cα atoms found — ribbon/backbone preview may be empty.');
    }
    if (parsed.format !== 'pdb') {
      warnings.push('Protein viewer expects PDB; MOL/SDF ligands are better in Molecular Structure Viewer.');
    }
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse PDB');
  }
  return { id, name: file.name, size: file.size, extension, text, parsed, warnings, softFail };
}

export function canExportProtein(file: ProteinLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildProteinMetadataRows(parsed: ParsedMolecule): MoleculeMetadataRow[] {
  return [
    { key: 'Title', value: parsed.title },
    { key: 'Chains', value: parsed.chains.map((c) => c.id).join(', ') || '—' },
    { key: 'Residues', value: String(parsed.residues.length) },
    { key: 'Atoms', value: String(parsed.atoms.length) },
    { key: 'Helices', value: String(parsed.secondary.filter((s) => s.kind === 'helix').length) },
    { key: 'Sheets', value: String(parsed.secondary.filter((s) => s.kind === 'sheet').length) },
    { key: 'Hetero atoms', value: String(parsed.atoms.filter((a) => a.hetero).length) }
  ];
}

export function filterResidues(
  residues: MoleculeResidue[],
  query: string,
  chainId: string | null
): MoleculeResidue[] {
  const q = query.trim().toLowerCase();
  return residues.filter((r) => {
    if (chainId && r.chainId !== chainId) return false;
    if (!q) return true;
    return r.resName.toLowerCase().includes(q) || String(r.resSeq).includes(q) || r.id.toLowerCase().includes(q);
  });
}

export function exportProteinSummaryJson(file: ProteinLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed protein');
  return JSON.stringify(
    {
      file: file.name,
      title: parsed.title,
      chains: parsed.chains,
      residueCount: parsed.residues.length,
      atomCount: parsed.atoms.length,
      secondary: parsed.secondary
    },
    null,
    2
  );
}

export function exportProteinResiduesCsv(parsed: ParsedMolecule): string {
  const lines = ['chain,resSeq,resName,secondary,atoms'];
  for (const residue of parsed.residues) {
    lines.push(`${residue.chainId},${residue.resSeq},${residue.resName},${residue.secondary},${residue.atomIndices.length}`);
  }
  return lines.join('\n');
}

export function resolveProteinSuggestion(opts: { hasFiles: boolean; hasError: boolean }): MoleculeSuggestion | null {
  if (opts.hasError) {
    return {
      id: 'try-sample',
      title: 'Try the sample helix PDB',
      reason: 'Load the embedded poly-alanine helix to verify ribbon, residue browser, and chain filter.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!opts.hasFiles) {
    return {
      id: 'upload-pdb',
      title: 'Upload a protein PDB',
      reason: 'PDB files stay in your browser — inspect chains, residues, and secondary structure locally.',
      actionLabel: 'Choose file',
      action: 'upload'
    };
  }
  return null;
}
