import type { FvToolSuggestion } from '../shared/fv-tool-suggestion.model';
import { loadJSZipLibrary } from './archive-viewer.utils';
import { parsePlistBytes } from './plist-xml.utils';

export interface IpaInfo {
  appName: string;
  bundleId: string;
  version: string;
  build: string;
  minimumOsVersion: string;
  supportedDevices: string[];
  urlSchemes: string[];
  fileEntries: string[];
  rawPlist: Record<string, unknown>;
}

export function isIpaFile(file: Pick<File, 'name' | 'type'>): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith('.ipa') || file.type === 'application/octet-stream';
}

export async function parseIpaFile(file: File): Promise<IpaInfo> {
  const JSZip = await loadJSZipLibrary();
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const paths = Object.keys(zip.files).filter((path) => !zip.files[path]?.dir);
  const plistPath = paths.find((path) => /^Payload\/[^/]+\.app\/Info\.plist$/i.test(path));

  if (!plistPath) {
    throw new Error('Info.plist not found inside IPA Payload');
  }

  const plistEntry = zip.file(plistPath);
  if (!plistEntry) {
    throw new Error('Failed to read Info.plist');
  }

  const plistBytes = await plistEntry.async('uint8array');
  const rawPlist = parsePlistBytes(plistBytes);

  return {
    appName: pickPlistString(rawPlist, ['CFBundleDisplayName', 'CFBundleName']) ?? '—',
    bundleId: pickPlistString(rawPlist, ['CFBundleIdentifier']) ?? '—',
    version: pickPlistString(rawPlist, ['CFBundleShortVersionString']) ?? '—',
    build: pickPlistString(rawPlist, ['CFBundleVersion']) ?? '—',
    minimumOsVersion: pickPlistString(rawPlist, ['MinimumOSVersion']) ?? '—',
    supportedDevices: pickPlistStringArray(rawPlist, ['UIDeviceFamily']).map(deviceFamilyLabel),
    urlSchemes: extractUrlSchemes(rawPlist),
    fileEntries: paths.sort((a, b) => a.localeCompare(b)),
    rawPlist
  };
}

function pickPlistString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === 'string' || typeof value === 'number') {
      return String(value);
    }
  }
  return null;
}

function pickPlistStringArray(obj: Record<string, unknown>, keys: string[]): string[] {
  for (const key of keys) {
    const value = obj[key];
    if (Array.isArray(value)) {
      return value.map((item) => String(item));
    }
  }
  return [];
}

function extractUrlSchemes(obj: Record<string, unknown>): string[] {
  const urlTypes = obj['CFBundleURLTypes'];
  if (!Array.isArray(urlTypes)) {
    return [];
  }
  const schemes: string[] = [];
  for (const entry of urlTypes) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }
    const entrySchemes = (entry as Record<string, unknown>)['CFBundleURLSchemes'];
    if (Array.isArray(entrySchemes)) {
      schemes.push(...entrySchemes.map((item) => String(item)));
    }
  }
  return schemes;
}

function deviceFamilyLabel(code: string): string {
  switch (code) {
    case '1':
      return 'iPhone';
    case '2':
      return 'iPad';
    default:
      return code;
  }
}

export function resolveIpaSuggestion(options: {
  hasIpa: boolean;
  hasError: boolean;
}): FvToolSuggestion | null {
  if (options.hasError) {
    return {
      id: 'ipa-apk',
      title: 'Android package instead?',
      reason: 'APK Viewer parses AndroidManifest.xml and permissions.',
      actionLabel: 'Open APK Viewer',
      path: '/file-viewers/apk-viewer'
    };
  }
  if (!options.hasIpa) {
    return {
      id: 'ipa-archive',
      title: 'Zip archive instead?',
      reason: 'Archive Viewer explores nested files in zip packages.',
      actionLabel: 'Open Archive Viewer',
      path: '/file-viewers/archive-viewer'
    };
  }
  return null;
}
