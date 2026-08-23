import { ungzip } from 'pako';
import type { NiftiHeaderInfo, NiftiParsedVolume } from '../types/nifti-viewer.types';

const DT_UINT8 = 2;
const DT_INT16 = 4;
const DT_UINT16 = 512;
const DT_FLOAT32 = 16;
const DT_INT32 = 8;
const DT_FLOAT64 = 64;
const DT_COMPLEX64 = 32;
const DT_RGB24 = 128;

function datatypeLabel(code: number): string {
  switch (code) {
    case DT_UINT8:
      return 'uint8';
    case DT_INT16:
      return 'int16';
    case DT_UINT16:
      return 'uint16';
    case DT_INT32:
      return 'int32';
    case DT_FLOAT32:
      return 'float32';
    case DT_FLOAT64:
      return 'float64';
    case DT_COMPLEX64:
      return 'complex64';
    case DT_RGB24:
      return 'rgb24';
    default:
      return `code-${code}`;
  }
}

function readCString(bytes: Uint8Array, start: number, length: number): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    const c = bytes[start + i];
    if (!c) break;
    out += String.fromCharCode(c);
  }
  return out.trim();
}

function looksGzip(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
}

export function inflateNiftiBytes(bytes: Uint8Array): { bytes: Uint8Array; compressed: boolean } {
  if (!looksGzip(bytes)) {
    return { bytes, compressed: false };
  }
  try {
    const inflated = ungzip(bytes);
    return { bytes: inflated, compressed: true };
  } catch {
    throw new Error('Failed to gunzip .nii.gz payload');
  }
}

function readHeader(bytes: Uint8Array): {
  header: NiftiHeaderInfo;
  littleEndian: boolean;
} {
  if (bytes.length < 348) {
    throw new Error('NIfTI buffer too small for header (need 348 bytes)');
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let littleEndian = true;
  let sizeofHdr = view.getInt32(0, true);
  if (sizeofHdr !== 348 && sizeofHdr !== 540) {
    const be = view.getInt32(0, false);
    if (be === 348 || be === 540) {
      littleEndian = false;
      sizeofHdr = be;
    } else {
      throw new Error(`Unexpected sizeof_hdr (${sizeofHdr})`);
    }
  }

  const le = littleEndian;
  const dim: number[] = [];
  const pixdim: number[] = [];
  for (let i = 0; i < 8; i++) {
    dim.push(view.getInt16(40 + i * 2, le));
    pixdim.push(view.getFloat32(76 + i * 4, le));
  }
  const datatype = view.getInt16(70, le);
  const bitpix = view.getInt16(72, le);
  const voxOffset = view.getFloat32(108, le);
  const sclSlope = view.getFloat32(112, le);
  const sclInter = view.getFloat32(116, le);
  const calMax = view.getFloat32(124, le);
  const calMin = view.getFloat32(128, le);
  const description = readCString(bytes, 148, 80);
  const qformCode = view.getInt16(252, le);
  const sformCode = view.getInt16(254, le);
  const magic = readCString(bytes, 344, 4);

  if (magic.indexOf('ni1') !== 0 && magic.indexOf('n+1') !== 0) {
    // soft — some writers pad differently
  }

  const affineNotes: string[] = [];
  if (qformCode > 0) {
    affineNotes.push(`qform_code=${qformCode} (quaternion orientation present)`);
  }
  if (sformCode > 0) {
    affineNotes.push(`sform_code=${sformCode} (affine matrix present)`);
  }
  if (qformCode === 0 && sformCode === 0) {
    affineNotes.push('No qform/sform — voxel indices only');
  }

  return {
    littleEndian,
    header: {
      sizeofHdr,
      dim,
      pixdim,
      datatype,
      datatypeLabel: datatypeLabel(datatype),
      bitpix,
      voxOffset,
      sclSlope,
      sclInter,
      calMin,
      calMax,
      qformCode,
      sformCode,
      magic,
      description,
      affineNotes
    }
  };
}

function readVolumeData(
  bytes: Uint8Array,
  offset: number,
  nx: number,
  ny: number,
  nz: number,
  datatype: number,
  littleEndian: boolean,
  slope: number,
  intercept: number
): { data: Float32Array; warnings: string[] } {
  const warnings: string[] = [];
  const count = nx * ny * nz;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const scl = slope === 0 ? 1 : slope;
  const data = new Float32Array(count);

  const apply = (raw: number, i: number) => {
    data[i] = raw * scl + intercept;
  };

  if (datatype === DT_COMPLEX64 || datatype === DT_RGB24) {
    warnings.push(`Datatype ${datatypeLabel(datatype)} is unsupported for intensity display.`);
    return { data, warnings };
  }

  try {
    if (datatype === DT_UINT8) {
      for (let i = 0; i < count; i++) {
        apply(view.getUint8(offset + i), i);
      }
    } else if (datatype === DT_INT16) {
      for (let i = 0; i < count; i++) {
        apply(view.getInt16(offset + i * 2, littleEndian), i);
      }
    } else if (datatype === DT_UINT16) {
      for (let i = 0; i < count; i++) {
        apply(view.getUint16(offset + i * 2, littleEndian), i);
      }
    } else if (datatype === DT_INT32) {
      for (let i = 0; i < count; i++) {
        apply(view.getInt32(offset + i * 4, littleEndian), i);
      }
    } else if (datatype === DT_FLOAT32) {
      for (let i = 0; i < count; i++) {
        apply(view.getFloat32(offset + i * 4, littleEndian), i);
      }
    } else if (datatype === DT_FLOAT64) {
      for (let i = 0; i < count; i++) {
        apply(view.getFloat64(offset + i * 8, littleEndian), i);
      }
    } else {
      warnings.push(`Unsupported datatype ${datatype} — volume not loaded.`);
      return { data: new Float32Array(0), warnings };
    }
  } catch {
    throw new Error('NIfTI voxel buffer is truncated or corrupt');
  }

  return { data, warnings };
}

export function parseNiftiBytes(input: Uint8Array): NiftiParsedVolume {
  const { bytes, compressed } = inflateNiftiBytes(input);
  const { header, littleEndian } = readHeader(bytes);
  const warnings: string[] = [];

  const ndim = header.dim[0] || 3;
  if (ndim > 4 || (header.dim[4] ?? 1) > 1 || (header.dim[5] ?? 1) > 1) {
    warnings.push('5D+ / multi-volume data truncated to the first 3D volume.');
  }

  const nx = Math.max(1, header.dim[1] || 1);
  const ny = Math.max(1, header.dim[2] || 1);
  const nz = Math.max(1, header.dim[3] || 1);
  const voxelSize: [number, number, number] = [
    Math.abs(header.pixdim[1] || 1),
    Math.abs(header.pixdim[2] || 1),
    Math.abs(header.pixdim[3] || 1)
  ];

  let offset = Math.floor(header.voxOffset || 352);
  if (offset < 348) {
    offset = header.magic.indexOf('ni1') === 0 ? 0 : 352;
  }
  if (offset + nx * ny * nz > bytes.length && header.bitpix) {
    // allow if bitpix accounts for size — check bytes needed
    const bytesNeeded = (nx * ny * nz * header.bitpix) / 8;
    if (offset + bytesNeeded > bytes.length) {
      throw new Error('NIfTI data extends beyond file length');
    }
  }

  const { data, warnings: dataWarnings } = readVolumeData(
    bytes,
    offset,
    nx,
    ny,
    nz,
    header.datatype,
    littleEndian,
    header.sclSlope,
    header.sclInter
  );
  warnings.push(...dataWarnings);

  let dataMin = Infinity;
  let dataMax = -Infinity;
  for (let i = 0; i < data.length; i++) {
    const v = data[i];
    if (v < dataMin) dataMin = v;
    if (v > dataMax) dataMax = v;
  }
  if (!Number.isFinite(dataMin)) {
    dataMin = 0;
    dataMax = 0;
  }

  return {
    header,
    dims: [nx, ny, nz],
    voxelSize,
    data,
    dataMin,
    dataMax,
    warnings,
    compressedSource: compressed
  };
}

/** Extract a 2D slice; plane uses RAS-ish index convention on dim order (x,y,z). */
export function extractNiftiSlice(
  volume: NiftiParsedVolume,
  plane: 'axial' | 'coronal' | 'sagittal',
  index: number
): { pixels: Float32Array; width: number; height: number; index: number } {
  const [nx, ny, nz] = volume.dims;
  const data = volume.data;

  if (plane === 'axial') {
    const z = Math.max(0, Math.min(nz - 1, index));
    const pixels = new Float32Array(nx * ny);
    const base = z * nx * ny;
    for (let i = 0; i < nx * ny; i++) {
      pixels[i] = data[base + i];
    }
    return { pixels, width: nx, height: ny, index: z };
  }

  if (plane === 'coronal') {
    const y = Math.max(0, Math.min(ny - 1, index));
    const pixels = new Float32Array(nx * nz);
    for (let z = 0; z < nz; z++) {
      for (let x = 0; x < nx; x++) {
        pixels[z * nx + x] = data[z * nx * ny + y * nx + x];
      }
    }
    return { pixels, width: nx, height: nz, index: y };
  }

  // sagittal
  const x = Math.max(0, Math.min(nx - 1, index));
  const pixels = new Float32Array(ny * nz);
  for (let z = 0; z < nz; z++) {
    for (let y = 0; y < ny; y++) {
      pixels[z * ny + y] = data[z * nx * ny + y * nx + x];
    }
  }
  return { pixels, width: ny, height: nz, index: x };
}

export function maxSliceIndex(volume: NiftiParsedVolume, plane: 'axial' | 'coronal' | 'sagittal'): number {
  const [nx, ny, nz] = volume.dims;
  if (plane === 'axial') return Math.max(0, nz - 1);
  if (plane === 'coronal') return Math.max(0, ny - 1);
  return Math.max(0, nx - 1);
}
