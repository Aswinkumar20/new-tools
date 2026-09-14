import type { FvRelatedToolLink } from '../shared/fv-tool-suggestion.model';

export const APK_VIEWER_TITLE = 'APK Viewer';
export const APK_VIEWER_DESCRIPTION =
  'Extract Android package metadata, permissions, activities, and file listing from APK files.';
export const APK_VIEWER_ACCEPT_ATTR = '.apk,application/vnd.android.package-archive';
export const APK_VIEWER_FORMATS_LABEL = 'APK';

export const APK_VIEWER_RELATED_TOOLS: ReadonlyArray<FvRelatedToolLink> = [
  { label: 'IPA Viewer', path: '/file-viewers/ipa-viewer', description: 'Inspect iOS IPA packages' },
  { label: 'Archive Viewer', path: '/file-viewers/archive-viewer', description: 'Browse zip archive contents' }
];

export const APK_VIEWER_HELP_ITEMS = [
  'Upload an Android APK package.',
  'Review manifest fields and permissions.',
  'Browse embedded files and app icon when available.'
] as const;

export const APK_PARSER_SCRIPT = 'app-info-parser/app-info-parser.min.js';
