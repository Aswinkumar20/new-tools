import { KML_SAMPLE } from '../constants/kml-viewer.constants';
import {
  KMZ_MAX_FILE_BYTES,
  KMZ_SUPPORTED_EXTENSIONS
} from '../constants/kmz-viewer.constants';
import type {
  KmzDiagramStats,
  KmzFeatureCollection,
  KmzFeatureSummary,
  KmzLoadedFile
} from '../types/kmz-viewer.types';
import {
  buildKmlStats,
  countFeaturesByKind,
  exportFeaturesCsv,
  exportGeoJson,
  filterKmlFeatures,
  formatBounds,
  formatPropertyValue,
  geometryKind,
  normalizeToFeatures,
  parseKmlText,
  summarizeFeatures
} from './kml-viewer.utils';
import {
  configureLeafletDefaultIcons,
  downloadTextFile,
  ensureLeafletStylesheet,
  loadLeaflet
} from './leaflet-map.utils';

export {
  buildKmlStats as buildKmzStats,
  configureLeafletDefaultIcons,
  countFeaturesByKind,
  downloadTextFile,
  exportFeaturesCsv,
  exportGeoJson,
  filterKmlFeatures as filterKmzFeatures,
  formatBounds,
  formatPropertyValue,
  geometryKind,
  loadLeaflet,
  normalizeToFeatures,
  summarizeFeatures
};

type JSZipFile = {
  dir: boolean;
  async: (type: 'string') => Promise<string>;
};

type JSZipInstance = {
  files: Record<string, JSZipFile>;
  file: (name: string, data: string) => unknown;
  generateAsync: (options: { type: 'blob' }) => Promise<Blob>;
};

type JSZipCtor = {
  new (): JSZipInstance;
  loadAsync: (data: ArrayBuffer | Uint8Array | Blob) => Promise<JSZipInstance>;
};

const IMAGE_EXTENSION_RE = /\.(jpe?g|png|gif|bmp|webp|tif{1,2})$/i;

export function ensureKmzStylesheet(href: string): void {
  ensureLeafletStylesheet(href, 'kmzCss');
}

export function getKmzFileExtension(fileName: string): string {
  const match = /(?:\.([^.]+))$/.exec(fileName.toLowerCase());
  return match?.[0] ?? '';
}

export function isSupportedKmzFile(file: File): boolean {
  const ext = getKmzFileExtension(file.name);
  if (KMZ_SUPPORTED_EXTENSIONS.includes(ext)) {
    return true;
  }
  const type = (file.type || '').toLowerCase();
  return (
    type.includes('kmz') ||
    type === 'application/vnd.google-earth.kmz' ||
    type === 'application/zip' ||
    type === 'application/x-zip-compressed'
  );
}

export function validateKmzFileSize(file: File): string | null {
  if (!file || file.size <= 0) {
    return 'File is empty';
  }
  if (file.size > KMZ_MAX_FILE_BYTES) {
    return `File is too large (max ${formatKmzFileSize(KMZ_MAX_FILE_BYTES)})`;
  }
  return null;
}

export function filterValidKmzFiles(files: FileList | File[]): {
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

    if (!isSupportedKmzFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .kmz)' });
      continue;
    }
    const sizeError = validateKmzFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function formatKmzFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return '0 B';
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function readKmzFileBytes(file: File): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === 'function') {
    return file.arrayBuffer();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read file as ArrayBuffer'));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

async function loadJSZip(): Promise<JSZipCtor> {
  const mod = await import('jszip');
  const named = mod as { default?: unknown };
  const candidate = typeof named.default === 'function' ? named.default : mod;
  if (
    !candidate ||
    typeof (candidate as { loadAsync?: unknown }).loadAsync !== 'function'
  ) {
    throw new Error('Failed to load JSZip');
  }
  return candidate as JSZipCtor;
}

/** Prefer doc.kml, then a root-level .kml, then the shallowest path alphabetically. */
export function pickPrimaryKmlPath(kmlPaths: string[]): string {
  if (kmlPaths.length === 0) {
    throw new Error('No KML found in KMZ archive');
  }
  const normalized = kmlPaths.map((path) => ({
    path,
    lower: path.replace(/\\/g, '/').toLowerCase()
  }));

  const doc = normalized.find(
    (item) => item.lower === 'doc.kml' || item.lower.endsWith('/doc.kml')
  );
  if (doc) {
    return doc.path;
  }

  const root = normalized.filter((item) => !item.lower.includes('/'));
  if (root.length > 0) {
    root.sort((a, b) => a.lower.localeCompare(b.lower));
    return root[0].path;
  }

  normalized.sort((a, b) => {
    const depthA = a.lower.split('/').length;
    const depthB = b.lower.split('/').length;
    if (depthA !== depthB) {
      return depthA - depthB;
    }
    return a.lower.localeCompare(b.lower);
  });
  return normalized[0].path;
}

function collectKmzPackageWarnings(
  packageEntries: string[],
  kmlPaths: string[],
  primaryKmlPath: string
): string[] {
  const warnings: string[] = [];
  if (kmlPaths.length > 1) {
    warnings.push(
      `Multiple KML files found (${kmlPaths.length}); using ${primaryKmlPath}. Other KML files were not merged.`
    );
  }
  const images = packageEntries.filter((name) => IMAGE_EXTENSION_RE.test(name));
  if (images.length > 0) {
    warnings.push(
      `Embedded image(s) ignored (${images.length}) — overlays and icons are not displayed on the map.`
    );
  }
  return warnings;
}

export async function parseKmzBuffer(buffer: ArrayBuffer): Promise<{
  kmlText: string;
  primaryKmlPath: string;
  packageEntries: string[];
  data: KmzFeatureCollection;
  documentTitle: string;
  warnings: string[];
}> {
  if (!buffer || buffer.byteLength === 0) {
    throw new Error('KMZ file is empty');
  }

  const JSZip = await loadJSZip();
  let zip: JSZipInstance;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw new Error('Invalid KMZ — could not unzip the archive');
  }

  const packageEntries = Object.keys(zip.files)
    .filter((name) => !zip.files[name]?.dir)
    .sort((a, b) => a.localeCompare(b));

  if (packageEntries.length === 0) {
    throw new Error('KMZ archive is empty');
  }

  const kmlPaths = packageEntries.filter((name) => /\.kml$/i.test(name));
  if (kmlPaths.length === 0) {
    throw new Error('No KML found in KMZ archive');
  }

  const primaryKmlPath = pickPrimaryKmlPath(kmlPaths);
  const entry = zip.files[primaryKmlPath];
  if (!entry) {
    throw new Error(`Could not read ${primaryKmlPath} from KMZ`);
  }

  const kmlText = await entry.async('string');
  const packageWarnings = collectKmzPackageWarnings(
    packageEntries,
    kmlPaths,
    primaryKmlPath
  );
  const parsed = await parseKmlText(kmlText);

  return {
    kmlText,
    primaryKmlPath,
    packageEntries,
    data: parsed.data,
    documentTitle: parsed.documentTitle,
    warnings: [...packageWarnings, ...parsed.warnings]
  };
}

export function createKmzFileRecord(
  file: File,
  bytes: ArrayBuffer,
  parsed: {
    kmlText: string;
    primaryKmlPath: string;
    packageEntries: string[];
    data: KmzFeatureCollection;
    documentTitle: string;
    warnings: string[];
  }
): KmzLoadedFile {
  return {
    id: `${file.name}-${file.size}-${file.lastModified}`,
    name: file.name,
    size: file.size,
    bytes,
    kmlText: parsed.kmlText,
    primaryKmlPath: parsed.primaryKmlPath,
    packageEntries: parsed.packageEntries,
    data: parsed.data,
    documentTitle: parsed.documentTitle,
    warnings: parsed.warnings
  };
}

/** Sample KMZ: zip KML_SAMPLE as doc.kml (lastModified: 0 for stable id). */
export async function createSampleKmzFile(): Promise<File> {
  const JSZip = await loadJSZip();
  const zip = new JSZip();
  zip.file('doc.kml', KML_SAMPLE);
  const blob = await zip.generateAsync({ type: 'blob' });
  return new File([blob], 'sample-bay-area.kmz', {
    type: 'application/vnd.google-earth.kmz',
    lastModified: 0
  });
}

export function downloadBinaryFile(
  data: ArrayBuffer | Blob | Uint8Array,
  fileName: string,
  mime: string
): void {
  if (typeof document === 'undefined') {
    throw new Error('Download is only available in the browser');
  }
  const safeName = fileName.trim() || 'download.bin';
  const blob =
    data instanceof Blob
      ? data
      : new Blob([data as BlobPart], { type: mime || 'application/octet-stream' });
  if (blob.size === 0) {
    throw new Error('Nothing to download');
  }
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = safeName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function exportKmzSummaryJson(
  file: KmzLoadedFile,
  stats: KmzDiagramStats,
  features: KmzFeatureSummary[]
): string {
  return JSON.stringify(
    {
      file: {
        name: file.name,
        size: file.size,
        warnings: file.warnings,
        primaryKmlPath: file.primaryKmlPath,
        packageEntries: file.packageEntries
      },
      documentTitle: file.documentTitle,
      stats,
      features: features.map((feature) => ({
        id: feature.id,
        name: feature.name,
        description: feature.description,
        geometryType: feature.geometryType,
        kind: feature.kind,
        properties: feature.properties
      }))
    },
    null,
    2
  );
}

export function resolveKmzSuggestion(state: {
  hasFiles: boolean;
  hasError: boolean;
  featureCount: number;
}): { id: string; title: string; reason: string; actionLabel: string; path: string } | null {
  if (state.hasError) {
    return {
      id: 'kmz-fix',
      title: 'Need a valid KMZ file?',
      reason: 'Upload a Google Earth .kmz (zipped KML) that contains at least one .kml with Placemark geometry.',
      actionLabel: 'Related: KML Viewer',
      path: '/gis-viewers/kml-viewer'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'kmz-intro',
      title: 'Start with a KMZ package',
      reason: 'Drop a .kmz file or load the sample Bay Area tour to explore packaged placemarks on the map.',
      actionLabel: 'Related: GeoJSON maps',
      path: '/gis-viewers/geojson-viewer'
    };
  }
  if (state.featureCount > 500) {
    return {
      id: 'kmz-large',
      title: 'Large dataset tip',
      reason: 'Filter by geometry type or search placemark names to focus on features of interest.',
      actionLabel: 'Related: Shapefiles',
      path: '/gis-viewers/shapefile-viewer'
    };
  }
  return null;
}
