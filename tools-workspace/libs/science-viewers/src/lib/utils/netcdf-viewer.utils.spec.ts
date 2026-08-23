import { parseNetCdfBytes } from './netcdf-parse.utils';
import { base64ToUint8Array } from './science-file.utils';
import { NETCDF_SAMPLE_BASE64 } from '../constants/netcdf-sample.data';
import { createNetCdfFileRecord, createSampleNetCdfFile } from './netcdf-viewer.utils';

describe('netcdf-parse.utils', () => {
  it('parses the embedded sample climate grid', () => {
    const bytes = base64ToUint8Array(NETCDF_SAMPLE_BASE64);
    const parsed = parseNetCdfBytes(bytes);
    expect(parsed.variables.map((v) => v.name).sort()).toEqual(['image']);
    expect(parsed.dimensions.length).toBeGreaterThanOrEqual(3);
    expect(parsed.preview?.variableName).toBe('image');
  });

  it('rejects HDF5 signature as NetCDF classic', () => {
    const bytes = base64ToUint8Array(NETCDF_SAMPLE_BASE64);
    bytes[0] = 0x89;
    bytes[1] = 0x48;
    bytes[2] = 0x44;
    bytes[3] = 0x46;
    expect(() => parseNetCdfBytes(bytes)).toThrow(/NetCDF-4 \/ HDF5/);
  });
});

describe('netcdf-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleNetCdfFile();
    expect(file.name).toBe('sample-grid.nc');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample bytes', () => {
    const file = createSampleNetCdfFile();
    const bytes = base64ToUint8Array(NETCDF_SAMPLE_BASE64);
    const record = createNetCdfFileRecord(file, bytes);
    expect(record.softFail).toBe(false);
    expect(record.parsed?.variables.length).toBeGreaterThan(0);
  });
});
