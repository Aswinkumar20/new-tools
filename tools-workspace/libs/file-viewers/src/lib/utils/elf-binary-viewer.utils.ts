import type { FvToolSuggestion } from '../shared/fv-tool-suggestion.model';

export interface ElfSectionInfo {
  index: number;
  name: string;
  type: string;
  offset: number;
  size: number;
  address: number;
}

export interface ElfParseResult {
  classLabel: string;
  dataEncoding: string;
  entryPoint: string;
  sectionCount: number;
  segmentCount: number;
  sections: ElfSectionInfo[];
}

const ELF_SECTION_TYPES: Record<number, string> = {
  0: 'NULL',
  1: 'PROGBITS',
  2: 'SYMTAB',
  3: 'STRTAB',
  4: 'RELA',
  5: 'HASH',
  6: 'DYNAMIC',
  7: 'NOTE',
  8: 'NOBITS',
  9: 'REL',
  11: 'DYNSYM'
};

export function isElfBinaryFile(file: Pick<File, 'name' | 'type'>): boolean {
  const name = file.name.toLowerCase();
  return (
    !name.endsWith('.txt') &&
    (name.endsWith('.elf') ||
      name.endsWith('.so') ||
      name.endsWith('.o') ||
      name.endsWith('.bin') ||
      file.type === 'application/x-executable' ||
      file.type === 'application/octet-stream')
  );
}

export async function parseElfBinary(file: File): Promise<ElfParseResult> {
  const buffer = new Uint8Array(await file.arrayBuffer());
  if (buffer.length < 64) {
    throw new Error('File too small to be a valid ELF binary');
  }

  if (buffer[0] !== 0x7f || buffer[1] !== 0x45 || buffer[2] !== 0x4c || buffer[3] !== 0x46) {
    throw new Error('Not a valid ELF file (missing \\x7FELF magic)');
  }

  const elfClass = buffer[4];
  if (elfClass !== 2) {
    throw new Error('Only 64-bit ELF files are supported');
  }
  if (buffer[5] !== 1) {
    throw new Error('Only little-endian ELF files are supported');
  }

  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const entryPoint = view.getBigUint64(24, true);
  const sectionHeaderOffset = Number(view.getBigUint64(40, true));
  const segmentCount = view.getUint16(56, true);
  const sectionEntrySize = view.getUint16(58, true);
  const sectionCount = view.getUint16(60, true);
  const stringTableIndex = view.getUint16(62, true);

  const sections = readElfSections(
    view,
    sectionHeaderOffset,
    sectionEntrySize,
    sectionCount,
    stringTableIndex
  );

  return {
    classLabel: 'ELF64',
    dataEncoding: 'Little endian',
    entryPoint: `0x${entryPoint.toString(16)}`,
    sectionCount,
    segmentCount,
    sections
  };
}

function readElfSections(
  view: DataView,
  sectionHeaderOffset: number,
  sectionEntrySize: number,
  sectionCount: number,
  stringTableIndex: number
): ElfSectionInfo[] {
  const headers: Array<{
    nameOffset: number;
    type: number;
    offset: number;
    size: number;
    address: number;
  }> = [];

  for (let i = 0; i < sectionCount; i++) {
    const base = sectionHeaderOffset + i * sectionEntrySize;
    headers.push({
      nameOffset: view.getUint32(base, true),
      type: view.getUint32(base + 4, true),
      address: Number(view.getBigUint64(base + 16, true)),
      offset: Number(view.getBigUint64(base + 24, true)),
      size: Number(view.getBigUint64(base + 32, true))
    });
  }

  const stringHeader = headers[stringTableIndex];
  if (!stringHeader) {
    return headers.map((header, index) => ({
      index,
      name: `section-${index}`,
      type: ELF_SECTION_TYPES[header.type] ?? `0x${header.type.toString(16)}`,
      offset: header.offset,
      size: header.size,
      address: header.address
    }));
  }

  const stringStart = stringHeader.offset;
  const stringSize = stringHeader.size;

  return headers.map((header, index) => ({
    index,
    name: readElfString(view, stringStart, stringSize, header.nameOffset) || `(null-${index})`,
    type: ELF_SECTION_TYPES[header.type] ?? `0x${header.type.toString(16)}`,
    offset: header.offset,
    size: header.size,
    address: header.address
  }));
}

function readElfString(
  view: DataView,
  tableOffset: number,
  tableSize: number,
  nameOffset: number
): string {
  if (nameOffset >= tableSize) {
    return '';
  }
  const bytes: number[] = [];
  for (let i = tableOffset + nameOffset; i < tableOffset + tableSize; i++) {
    const byte = view.getUint8(i);
    if (byte === 0) {
      break;
    }
    bytes.push(byte);
  }
  return new TextDecoder().decode(new Uint8Array(bytes));
}

export function formatElfSize(bytes: number): string {
  if (bytes === 0) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${Math.round((bytes / Math.pow(1024, i)) * 100) / 100} ${units[i]}`;
}

export function resolveElfSuggestion(options: {
  hasBinary: boolean;
  hasError: boolean;
}): FvToolSuggestion | null {
  if (options.hasError) {
    return {
      id: 'elf-pe',
      title: 'Windows executable instead?',
      reason: 'PE Binary Viewer inspects .exe and .dll files.',
      actionLabel: 'Open PE Binary Viewer',
      path: '/file-viewers/pe-binary-viewer'
    };
  }
  if (!options.hasBinary) {
    return null;
  }
  return {
    id: 'elf-archive',
    title: 'Archive or package file?',
    reason: 'Archive Viewer lists nested files inside zip/tar packages.',
    actionLabel: 'Open Archive Viewer',
    path: '/file-viewers/archive-viewer'
  };
}
