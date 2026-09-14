import type { FvRelatedToolLink } from '../shared/fv-tool-suggestion.model';

export const IPA_VIEWER_TITLE = 'IPA Viewer';
export const IPA_VIEWER_DESCRIPTION =
  'Read Info.plist metadata, bundle identifiers, and file listings from iOS IPA packages.';
export const IPA_VIEWER_ACCEPT_ATTR = '.ipa,application/octet-stream';
export const IPA_VIEWER_FORMATS_LABEL = 'IPA';

export const IPA_VIEWER_RELATED_TOOLS: ReadonlyArray<FvRelatedToolLink> = [
  { label: 'APK Viewer', path: '/file-viewers/apk-viewer', description: 'Inspect Android APK metadata' },
  { label: 'Archive Viewer', path: '/file-viewers/archive-viewer', description: 'Browse zip archive contents' }
];

export const IPA_VIEWER_HELP_ITEMS = [
  'Upload an iOS IPA package.',
  'Review Info.plist fields and bundle ID.',
  'Browse Payload app bundle files.'
] as const;
