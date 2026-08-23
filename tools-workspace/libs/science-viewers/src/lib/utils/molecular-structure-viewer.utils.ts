import {
  MOLECULAR_MAX_FILE_BYTES,
  MOLECULAR_SAMPLE_MOL,
  MOLECULAR_SUPPORTED_EXTENSIONS
} from '../constants/molecular-structure-viewer.constants';
import type { MolecularLoadedFile } from '../types/molecular-structure-viewer.types';
import type { MoleculeMetadataRow, MoleculeSuggestion, ParsedMolecule } from '../types/molecule.types';
import { bytesToText, parseMoleculeText } from './molecule-parse.utils';
import { formatScienceFileSize, getFileExtension } from './science-file.utils';

export {
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatScienceFileSize as formatMolecularFileSize,
  readFileBytes as readMolecularFileBytes
} from './science-file.utils';

export { parseMoleculeText, bytesToText } from './molecule-parse.utils';
export { hitTestAtom, renderMolecule, CPK_COLORS } from './molecule-render.utils';

export function isSupportedMolecularFile(file: File): boolean {
  const ext = getFileExtension(file.name);
  return (MOLECULAR_SUPPORTED_EXTENSIONS as readonly string[]).includes(ext);
}

export function validateMolecularFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > MOLECULAR_MAX_FILE_BYTES) {
    return `File is too large (max ${formatScienceFileSize(MOLECULAR_MAX_FILE_BYTES)})`;
  }
  return null;
}

export function filterValidMolecularFiles(files: FileList | File[]): {
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
    if (!isSupportedMolecularFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .pdb / .mol / .sdf)' });
      continue;
    }
    const sizeError = validateMolecularFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleMolecularFile(): File {
  return new File([MOLECULAR_SAMPLE_MOL], 'sample-ethanol.mol', {
    type: 'chemical/x-mdl-molfile',
    lastModified: 0
  });
}

export function createMolecularFileRecord(file: File, bytes: Uint8Array): MolecularLoadedFile {
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
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse molecule');
  }
  return { id, name: file.name, size: file.size, extension, text, parsed, warnings, softFail };
}

export function canExportMolecular(file: MolecularLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildMolecularMetadataRows(parsed: ParsedMolecule): MoleculeMetadataRow[] {
  const rows: MoleculeMetadataRow[] = [
    { key: 'Title', value: parsed.title },
    { key: 'Format', value: parsed.format.toUpperCase() },
    { key: 'Atoms', value: String(parsed.atoms.length) },
    { key: 'Bonds', value: String(parsed.bonds.length) }
  ];
  if (parsed.residues.length > 1) {
    rows.push({ key: 'Residues', value: String(parsed.residues.length) });
  }
  if (parsed.chains.length) {
    rows.push({ key: 'Chains', value: parsed.chains.map((c) => c.id).join(', ') });
  }
  rows.push({
    key: 'Elements',
    value: Object.entries(parsed.elementCounts)
      .map(([el, n]) => `${el} ${n}`)
      .join(', ')
  });
  return rows;
}

export function exportMolecularSummaryJson(file: MolecularLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed molecule');
  return JSON.stringify(
    {
      file: file.name,
      title: parsed.title,
      format: parsed.format,
      atoms: parsed.atoms.length,
      bonds: parsed.bonds.length,
      elementCounts: parsed.elementCounts
    },
    null,
    2
  );
}

export function exportMolecularAtomsCsv(parsed: ParsedMolecule): string {
  const lines = ['index,serial,name,element,x,y,z'];
  for (const atom of parsed.atoms) {
    lines.push(`${atom.index},${atom.serial},${atom.name},${atom.element},${atom.x},${atom.y},${atom.z}`);
  }
  return lines.join('\n');
}

export function resolveMolecularSuggestion(opts: { hasFiles: boolean; hasError: boolean }): MoleculeSuggestion | null {
  if (opts.hasError) {
    return {
      id: 'try-sample',
      title: 'Try the sample ethanol molecule',
      reason: 'Load the embedded MOL to verify ball-and-stick preview, rotation, and atom hover.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!opts.hasFiles) {
    return {
      id: 'upload-mol',
      title: 'Upload a molecule file',
      reason: 'PDB, MOL, and SDF stay in your browser — rotate, style, and export locally.',
      actionLabel: 'Choose file',
      action: 'upload'
    };
  }
  return null;
}
