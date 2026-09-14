import type { FvRelatedToolLink } from '../shared/fv-tool-suggestion.model';

export const NFT_METADATA_TITLE = 'NFT Metadata Viewer';
export const NFT_METADATA_DESCRIPTION =
  'Inspect NFT JSON metadata, traits, and linked media previews locally.';
export const NFT_METADATA_ACCEPT_ATTR = '.json,application/json';
export const NFT_METADATA_FORMATS_LABEL = 'NFT JSON';

export const NFT_METADATA_RELATED_TOOLS: ReadonlyArray<FvRelatedToolLink> = [
  {
    label: 'Image Viewer',
    path: '/file-viewers/image-viewer',
    description: 'Open linked image assets directly'
  },
  {
    label: 'Text File Viewer',
    path: '/file-viewers/text-file-viewer',
    description: 'Browse raw JSON metadata files'
  }
];

export const NFT_METADATA_HELP_ITEMS = [
  'Upload NFT metadata JSON.',
  'Review name, description, and traits.',
  'Preview linked image URLs when available.'
] as const;
