import type { FvRelatedToolLink } from '../shared/fv-tool-suggestion.model';

export const ELF_BINARY_TITLE = 'ELF Binary Viewer';
export const ELF_BINARY_DESCRIPTION =
  'Inspect 64-bit ELF headers, entry point, and section table locally in your browser.';
export const ELF_BINARY_ACCEPT_ATTR = '.elf,.so,.o,.bin,application/octet-stream';
export const ELF_BINARY_FORMATS_LABEL = 'ELF binaries';

export const ELF_BINARY_RELATED_TOOLS: ReadonlyArray<FvRelatedToolLink> = [
  { label: 'PE Binary Viewer', path: '/file-viewers/pe-binary-viewer', description: 'Inspect Windows PE executables' },
  { label: 'Archive Viewer', path: '/file-viewers/archive-viewer', description: 'Browse nested package files' }
];

export const ELF_BINARY_HELP_ITEMS = [
  'Upload a 64-bit little-endian ELF binary.',
  'Review header fields and section table.',
  'Use sections to locate program data offsets.'
] as const;
