import type { FvToolSuggestion } from '../shared/fv-tool-suggestion.model';
import { loadJSZipLibrary } from './archive-viewer.utils';
import { loadAppInfoParser } from './fv-script-loader.utils';

export interface ApkInfo {
  packageName: string;
  versionName: string;
  versionCode: string;
  appName: string;
  minSdkVersion: string;
  targetSdkVersion: string;
  permissions: string[];
  activities: string[];
  fileEntries: string[];
  iconDataUrl: string | null;
}

export function isApkFile(file: Pick<File, 'name' | 'type'>): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith('.apk') || file.type === 'application/vnd.android.package-archive';
}

export async function parseApkFile(file: File, parserScriptUrl: string): Promise<ApkInfo> {
  const entries = await listZipEntries(file);
  const Parser = await loadAppInfoParser(parserScriptUrl);
  const parser = new Parser(file);
  const raw = await parser.parse();

  return {
    packageName: stringField(raw, ['package']) ?? '—',
    versionName: stringField(raw, ['versionName']) ?? '—',
    versionCode: stringField(raw, ['versionCode']) ?? '—',
    appName: extractApplicationLabel(raw) ?? '—',
    minSdkVersion: extractSdkVersion(raw, 'minSdkVersion') ?? '—',
    targetSdkVersion: extractSdkVersion(raw, 'targetSdkVersion') ?? '—',
    permissions: stringArrayField(raw, ['usesPermissions']),
    activities: extractActivities(raw),
    fileEntries: entries,
    iconDataUrl: typeof raw['icon'] === 'string' ? (raw['icon'] as string) : null
  };
}

function extractApplicationLabel(raw: Record<string, unknown>): string | null {
  const application = raw['application'];
  if (application && typeof application === 'object') {
    const label = (application as Record<string, unknown>)['label'];
    if (typeof label === 'string') {
      return label;
    }
  }
  return stringField(raw, ['label', 'name']);
}

function extractSdkVersion(raw: Record<string, unknown>, key: string): string | null {
  const usesSdk = raw['usesSdk'];
  if (usesSdk && typeof usesSdk === 'object') {
    const value = (usesSdk as Record<string, unknown>)[key];
    if (typeof value === 'string' || typeof value === 'number') {
      return String(value);
    }
  }
  return stringField(raw, [key]);
}

async function listZipEntries(file: File): Promise<string[]> {
  const JSZip = await loadJSZipLibrary();
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  return Object.keys(zip.files)
    .filter((path) => !zip.files[path]?.dir)
    .sort((a, b) => a.localeCompare(b));
}

function stringField(raw: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    if (key.includes('.')) {
      const [parent, child] = key.split('.');
      const parentVal = raw[parent ?? ''];
      if (parentVal && typeof parentVal === 'object') {
        const nested = (parentVal as Record<string, unknown>)[child ?? ''];
        if (typeof nested === 'string' || typeof nested === 'number') {
          return String(nested);
        }
      }
      continue;
    }
    const value = raw[key];
    if (typeof value === 'string' || typeof value === 'number') {
      return String(value);
    }
  }
  return null;
}

function stringArrayField(raw: Record<string, unknown>, keys: string[]): string[] {
  for (const key of keys) {
    const value = raw[key];
    if (Array.isArray(value)) {
      return value.map((item) => String(item)).filter(Boolean);
    }
  }
  return [];
}

function extractActivities(raw: Record<string, unknown>): string[] {
  const application = raw['application'];
  if (!application || typeof application !== 'object') {
    return [];
  }
  const activities = (application as Record<string, unknown>)['activities'];
  if (!Array.isArray(activities)) {
    return [];
  }
  return activities
    .map((item) => {
      if (typeof item === 'string') {
        return item;
      }
      if (item && typeof item === 'object') {
        const name = (item as Record<string, unknown>)['name'];
        return typeof name === 'string' ? name : null;
      }
      return null;
    })
    .filter((item): item is string => !!item);
}

export function resolveApkSuggestion(options: {
  hasApk: boolean;
  hasError: boolean;
}): FvToolSuggestion | null {
  if (options.hasError) {
    return {
      id: 'apk-ipa',
      title: 'iOS package instead?',
      reason: 'IPA Viewer extracts Info.plist metadata from iOS packages.',
      actionLabel: 'Open IPA Viewer',
      path: '/file-viewers/ipa-viewer'
    };
  }
  if (!options.hasApk) {
    return {
      id: 'apk-archive',
      title: 'Generic zip archive?',
      reason: 'Archive Viewer lists files inside zip-based packages.',
      actionLabel: 'Open Archive Viewer',
      path: '/file-viewers/archive-viewer'
    };
  }
  return null;
}
