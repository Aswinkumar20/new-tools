import type { FvRelatedToolLink } from '../shared/fv-tool-suggestion.model';

export const PE_BINARY_TITLE = 'PE Binary Viewer';
export const PE_BINARY_DESCRIPTION =
  'Parse Windows PE headers, sections, and import tables for EXE and DLL files.';
export const PE_BINARY_ACCEPT_ATTR = '.exe,.dll,.sys,.scr,application/vnd.microsoft.portable-executable';
export const PE_BINARY_FORMATS_LABEL = 'EXE, DLL';

export const PE_BINARY_RELATED_TOOLS: ReadonlyArray<FvRelatedToolLink> = [
  { label: 'ELF Binary Viewer', path: '/file-viewers/elf-binary-viewer', description: 'Inspect Linux ELF binaries' },
  { label: 'File Metadata Viewer', path: '/code-file-tools/file-metadata-viewer', description: 'Confirm file type and size' }
];

export const PE_BINARY_HELP_ITEMS = [
  'Upload a Windows PE executable or library.',
  'Review COFF header, sections, and imports.',
  'Check subsystem and image base values.'
] as const;
