import type { FvToolSuggestion } from '../shared/fv-tool-suggestion.model';

export interface PeSectionInfo {
  name: string;
  virtualSize: number;
  virtualAddress: string;
  rawSize: number;
  rawPointer: number;
  characteristics: string[];
}

export interface PeImportInfo {
  dll: string;
  functions: string[];
}

export interface PeParseResult {
  machine: string;
  timestamp: string;
  sections: PeSectionInfo[];
  imports: PeImportInfo[];
  characteristics: string[];
  subsystem: string;
  imageBase: string;
  entryPoint: string;
  isDll: boolean;
}

const MACHINE_TYPES: Record<number, string> = {
  0x014c: 'I386',
  0x8664: 'AMD64',
  0xaa64: 'ARM64',
  0x01c4: 'ARMNT'
};

const SECTION_CHARS: Array<{ flag: number; label: string }> = [
  { flag: 0x00000020, label: 'CODE' },
  { flag: 0x00000040, label: 'DATA' },
  { flag: 0x20000000, label: 'EXECUTE' },
  { flag: 0x40000000, label: 'READ' },
  { flag: 0x80000000, label: 'WRITE' }
];

const FILE_CHARS: Array<{ flag: number; label: string }> = [
  { flag: 0x0002, label: 'EXECUTABLE' },
  { flag: 0x2000, label: 'DLL' },
  { flag: 0x0020, label: 'LARGE_ADDRESS_AWARE' }
];

const SUBSYSTEMS: Record<number, string> = {
  1: 'Native',
  2: 'Windows GUI',
  3: 'Windows CUI',
  9: 'Windows CE GUI',
  10: 'EFI Application',
  16: 'Boot application'
};

export function isPeBinaryFile(file: Pick<File, 'name' | 'type'>): boolean {
  const name = file.name.toLowerCase();
  return (
    name.endsWith('.exe') ||
    name.endsWith('.dll') ||
    name.endsWith('.sys') ||
    name.endsWith('.scr') ||
    file.type === 'application/x-msdownload' ||
    file.type === 'application/vnd.microsoft.portable-executable'
  );
}

export function parsePeBinary(buffer: ArrayBuffer): PeParseResult {
  const view = new DataView(buffer);
  if (view.byteLength < 64) {
    throw new Error('File too small to be a valid PE binary');
  }

  if (view.getUint16(0, true) !== 0x5a4d) {
    throw new Error('Not a valid PE file (missing MZ header)');
  }

  const peOffset = view.getUint32(0x3c, true);
  if (view.getUint32(peOffset, true) !== 0x00004550) {
    throw new Error('Invalid PE signature');
  }

  const coff = peOffset + 4;
  const machine = MACHINE_TYPES[view.getUint16(coff, true)] ?? `0x${view.getUint16(coff, true).toString(16)}`;
  const numberOfSections = view.getUint16(coff + 2, true);
  const timeDateStamp = view.getUint32(coff + 4, true);
  const sizeOfOptionalHeader = view.getUint16(coff + 16, true);
  const fileCharacteristics = view.getUint16(coff + 18, true);

  const optional = coff + 20;
  const magic = view.getUint16(optional, true);
  const isPe32Plus = magic === 0x20b;
  if (magic !== 0x10b && !isPe32Plus) {
    throw new Error('Unsupported optional header magic');
  }

  const entryPointRva = view.getUint32(optional + 16, true);
  const subsystem = SUBSYSTEMS[view.getUint16(optional + (isPe32Plus ? 68 : 68), true)] ?? 'Unknown';
  const imageBase = isPe32Plus
    ? view.getBigUint64(optional + 24, true)
    : BigInt(view.getUint32(optional + 28, true));

  const dataDirectoryOffset = optional + (isPe32Plus ? 112 : 96);
  const importRva = view.getUint32(dataDirectoryOffset + 8, true);
  const importSize = view.getUint32(dataDirectoryOffset + 12, true);

  const sectionTable = optional + sizeOfOptionalHeader;
  const sections: PeSectionInfo[] = [];

  for (let i = 0; i < numberOfSections; i++) {
    const base = sectionTable + i * 40;
    const nameBytes = new Uint8Array(buffer, base, 8);
    const name = new TextDecoder().decode(nameBytes).replace(/\0+$/, '') || `section-${i}`;
    const virtualSize = view.getUint32(base + 8, true);
    const virtualAddress = view.getUint32(base + 12, true);
    const rawSize = view.getUint32(base + 16, true);
    const rawPointer = view.getUint32(base + 20, true);
    const characteristics = view.getUint32(base + 36, true);
    sections.push({
      name,
      virtualSize,
      virtualAddress: `0x${virtualAddress.toString(16)}`,
      rawSize,
      rawPointer,
      characteristics: flagsToLabels(characteristics, SECTION_CHARS)
    });
  }

  const imports = importRva
    ? readPeImports(view, buffer, sections, importRva, importSize)
    : [];

  return {
    machine,
    timestamp: new Date(timeDateStamp * 1000).toISOString(),
    sections,
    imports,
    characteristics: flagsToLabels(fileCharacteristics, FILE_CHARS),
    subsystem,
    imageBase: `0x${imageBase.toString(16)}`,
    entryPoint: `0x${entryPointRva.toString(16)}`,
    isDll: (fileCharacteristics & 0x2000) !== 0
  };
}

function flagsToLabels(value: number, defs: Array<{ flag: number; label: string }>): string[] {
  return defs.filter((d) => (value & d.flag) !== 0).map((d) => d.label);
}

function readPeImports(
  view: DataView,
  buffer: ArrayBuffer,
  sections: PeSectionInfo[],
  importRva: number,
  _importSize: number
): PeImportInfo[] {
  const importOffset = rvaToOffset(importRva, sections);
  if (importOffset < 0) {
    return [];
  }

  const imports: PeImportInfo[] = [];
  for (let descriptor = importOffset; descriptor < view.byteLength; descriptor += 20) {
    const nameRva = view.getUint32(descriptor + 12, true);
    const firstThunk = view.getUint32(descriptor + 16, true);
    if (nameRva === 0 && firstThunk === 0) {
      break;
    }

    const nameOffset = rvaToOffset(nameRva, sections);
    const dll = nameOffset >= 0 ? readAscii(view, nameOffset) : 'unknown.dll';
    const thunkRva = view.getUint32(descriptor + 16, true) || view.getUint32(descriptor, true);
    const functions = readImportFunctions(view, buffer, sections, thunkRva);
    imports.push({ dll, functions });
  }

  return imports;
}

function readImportFunctions(
  view: DataView,
  buffer: ArrayBuffer,
  sections: PeSectionInfo[],
  thunkRva: number
): string[] {
  const thunkOffset = rvaToOffset(thunkRva, sections);
  if (thunkOffset < 0) {
    return [];
  }

  const functions: string[] = [];
  const is64 = view.byteLength > 0x100000; // heuristic: use 8-byte thunks for typical 64-bit
  const step = 8;

  for (let offset = thunkOffset; offset + step <= view.byteLength; offset += step) {
    const value =
      step === 8 ? Number(view.getBigUint64(offset, true)) : view.getUint32(offset, true);
    if (value === 0) {
      break;
    }
    if (value & 0x8000000000000000 || value & 0x80000000) {
      functions.push(`ordinal_${value & 0xffff}`);
      continue;
    }
    const nameOffset = rvaToOffset(value, sections);
    if (nameOffset >= 0 && nameOffset + 2 < view.byteLength) {
      functions.push(readAscii(view, nameOffset + 2));
    }
  }

  return functions.slice(0, 50);
}

function rvaToOffset(rva: number, sections: PeSectionInfo[]): number {
  for (const section of sections) {
    const virtualAddress = Number.parseInt(section.virtualAddress.replace('0x', ''), 16);
    if (rva >= virtualAddress && rva < virtualAddress + section.virtualSize) {
      return section.rawPointer + (rva - virtualAddress);
    }
  }
  return -1;
}

function readAscii(view: DataView, offset: number): string {
  const bytes: number[] = [];
  for (let i = offset; i < view.byteLength; i++) {
    const byte = view.getUint8(i);
    if (byte === 0) {
      break;
    }
    bytes.push(byte);
  }
  return new TextDecoder().decode(new Uint8Array(bytes));
}

export function resolvePeSuggestion(options: {
  hasBinary: boolean;
  hasError: boolean;
}): FvToolSuggestion | null {
  if (options.hasError) {
    return {
      id: 'pe-elf',
      title: 'Linux ELF binary instead?',
      reason: 'ELF Binary Viewer parses headers and sections for ELF files.',
      actionLabel: 'Open ELF Binary Viewer',
      path: '/file-viewers/elf-binary-viewer'
    };
  }
  if (!options.hasBinary) {
    return null;
  }
  return {
    id: 'pe-meta',
    title: 'Need file metadata?',
    reason: 'File Metadata Viewer confirms MIME type and size for unusual binaries.',
    actionLabel: 'Open File Metadata Viewer',
    path: '/code-file-tools/file-metadata-viewer'
  };
}
