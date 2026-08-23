import { base64ToUint8Array } from './science-file.utils';
import { buildSampleRootBytes } from './root-build.utils';
import { parseRootBytes } from './root-parse.utils';
import { ROOT_SAMPLE_BASE64 } from '../constants/root-sample.data';
import { createRootFileRecord, createSampleRootFile } from './root-file-viewer.utils';

describe('root-parse.utils', () => {
  it('parses a built sample ROOT file', () => {
    const bytes = buildSampleRootBytes();
    const parsed = parseRootBytes(bytes);
    expect(parsed.objects.length).toBe(2);
    expect(parsed.preview?.name).toBe('energy');
    expect(parsed.preview?.histogram?.nbins).toBe(16);
  });

  it('parses the embedded sample base64', () => {
    const bytes = base64ToUint8Array(ROOT_SAMPLE_BASE64);
    const parsed = parseRootBytes(bytes);
    expect(parsed.objects.some((o) => o.kind === 'tree')).toBe(true);
  });
});

describe('root-file-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleRootFile();
    expect(file.name).toBe('sample-physics.root');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample bytes', () => {
    const file = createSampleRootFile();
    const bytes = base64ToUint8Array(ROOT_SAMPLE_BASE64);
    const record = createRootFileRecord(file, bytes);
    expect(record.softFail).toBe(false);
    expect(record.parsed?.objects.length).toBeGreaterThan(0);
  });
});
