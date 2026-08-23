import {
  buildKmzStats,
  createKmzFileRecord,
  createSampleKmzFile,
  filterValidKmzFiles,
  formatKmzFileSize,
  formatPropertyValue,
  parseKmzBuffer,
  pickPrimaryKmlPath,
  readKmzFileBytes,
  resolveKmzSuggestion,
  summarizeFeatures
} from './kmz-viewer.utils';
import { KML_SAMPLE } from '../constants/kml-viewer.constants';

async function loadJSZipCtor(): Promise<new () => {
  file: (name: string, data: string) => unknown;
  generateAsync: (options: { type: 'arraybuffer' }) => Promise<ArrayBuffer>;
}> {
  const mod = await import('jszip');
  const named = mod as { default?: unknown };
  const candidate = typeof named.default === 'function' ? named.default : mod;
  return candidate as new () => {
    file: (name: string, data: string) => unknown;
    generateAsync: (options: { type: 'arraybuffer' }) => Promise<ArrayBuffer>;
  };
}

describe('kmz-viewer.utils', () => {
  it('formats sizes and filters supported files', () => {
    expect(formatKmzFileSize(500)).toBe('500 B');
    expect(formatKmzFileSize(2048)).toBe('2.0 KB');

    const ok = new File([new Uint8Array([0x50, 0x4b])], 'demo.kmz', {
      type: 'application/vnd.google-earth.kmz'
    });
    const bad = new File(['x'], 'demo.txt', { type: 'text/plain' });
    const empty = new File([], 'empty.kmz', { type: 'application/vnd.google-earth.kmz' });
    const result = filterValidKmzFiles([ok, bad, empty, ok]);
    expect(result.accepted).toHaveLength(1);
    expect(result.rejected.map((item) => item.name)).toEqual(
      expect.arrayContaining(['demo.txt', 'empty.kmz', 'demo.kmz'])
    );
  });

  it('picks doc.kml as the primary entry', () => {
    expect(pickPrimaryKmlPath(['layers/a.kml', 'doc.kml', 'b.kml'])).toBe('doc.kml');
    expect(pickPrimaryKmlPath(['folder/doc.kml', 'other.kml'])).toBe('folder/doc.kml');
    expect(pickPrimaryKmlPath(['z.kml', 'a.kml'])).toBe('a.kml');
  });

  it('unzips and parses a sample KMZ built from KML_SAMPLE', async () => {
    const sample = await createSampleKmzFile();
    expect(sample.name).toBe('sample-bay-area.kmz');
    expect(sample.lastModified).toBe(0);

    const bytes = await readKmzFileBytes(sample);
    const parsed = await parseKmzBuffer(bytes);
    expect(parsed.primaryKmlPath).toBe('doc.kml');
    expect(parsed.packageEntries).toContain('doc.kml');
    expect(parsed.documentTitle).toBe('Sample Bay Area Tour');
    expect(parsed.data.features.length).toBe(4);
    expect(parsed.kmlText).toContain('<kml');
    expect(parsed.warnings.some((item) => /empty folder/i.test(item))).toBe(true);

    const features = summarizeFeatures(parsed.data);
    const stats = buildKmzStats(parsed.data, features, parsed.documentTitle);
    expect(stats.points).toBe(2);
    expect(stats.lines).toBe(1);
    expect(stats.polygons).toBe(1);

    const record = createKmzFileRecord(sample, bytes, parsed);
    expect(record.id).toContain('sample-bay-area.kmz');
    expect(record.packageEntries).toEqual(parsed.packageEntries);
  });

  it('warns on multiple KML files and ignored images', async () => {
    const JSZip = await loadJSZipCtor();
    const zip = new JSZip();
    zip.file('doc.kml', KML_SAMPLE);
    zip.file('extra.kml', KML_SAMPLE);
    zip.file('files/icon.png', 'fake-png');
    const buffer = await zip.generateAsync({ type: 'arraybuffer' });
    const parsed = await parseKmzBuffer(buffer);
    expect(parsed.primaryKmlPath).toBe('doc.kml');
    expect(parsed.warnings.some((item) => /multiple kml/i.test(item))).toBe(true);
    expect(parsed.warnings.some((item) => /embedded image/i.test(item))).toBe(true);
  });

  it('rejects archives without KML', async () => {
    const JSZip = await loadJSZipCtor();
    const zip = new JSZip();
    zip.file('readme.txt', 'no kml here');
    const buffer = await zip.generateAsync({ type: 'arraybuffer' });
    await expect(parseKmzBuffer(buffer)).rejects.toThrow(/no kml/i);
  });

  it('formats nested property values without [object Object]', () => {
    expect(formatPropertyValue({ a: 1 })).toBe('{"a":1}');
  });

  it('resolves suggestions by state', () => {
    expect(resolveKmzSuggestion({ hasFiles: false, hasError: false, featureCount: 0 })?.id).toBe(
      'kmz-intro'
    );
    expect(resolveKmzSuggestion({ hasFiles: true, hasError: true, featureCount: 0 })?.id).toBe(
      'kmz-fix'
    );
    expect(resolveKmzSuggestion({ hasFiles: true, hasError: false, featureCount: 800 })?.id).toBe(
      'kmz-large'
    );
  });
});
