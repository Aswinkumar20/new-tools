import { buildSampleGrib2Bytes } from './grib2-build.utils';
import { parseGribBytes } from './grib2-parse.utils';
import { base64ToUint8Array } from './science-file.utils';
import { GRIB_SAMPLE_BASE64 } from '../constants/grib-sample.data';
import { createGribFileRecord, createSampleGribFile } from './grib-viewer.utils';

describe('grib2-parse.utils', () => {
  it('parses a built sample GRIB2 message', () => {
    const bytes = buildSampleGrib2Bytes();
    const parsed = parseGribBytes(bytes);
    expect(parsed.messages.length).toBe(1);
    expect(parsed.preview?.shape).toEqual([8, 8]);
    expect(parsed.preview?.data.length).toBe(64);
    expect(parsed.preview?.parameterName).toBe('Temperature');
  });

  it('parses the embedded sample base64', () => {
    const bytes = base64ToUint8Array(GRIB_SAMPLE_BASE64);
    const parsed = parseGribBytes(bytes);
    expect(parsed.messages.length).toBeGreaterThan(0);
  });
});

describe('grib-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleGribFile();
    expect(file.name).toBe('sample-weather.grib2');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample bytes', () => {
    const file = createSampleGribFile();
    const bytes = base64ToUint8Array(GRIB_SAMPLE_BASE64);
    const record = createGribFileRecord(file, bytes);
    expect(record.softFail).toBe(false);
    expect(record.parsed?.messages.length).toBeGreaterThan(0);
  });
});
