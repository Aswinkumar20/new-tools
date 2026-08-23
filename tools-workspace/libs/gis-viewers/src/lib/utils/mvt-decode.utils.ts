/**
 * Pure TypeScript Mapbox Vector Tile (MVT / PBF) decoder.
 * Spec: https://github.com/mapbox/vector-tile-spec/tree/master/2.1
 */

export type MvtGeomType = 'Unknown' | 'Point' | 'LineString' | 'Polygon';

export type MvtValue =
  | { kind: 'string'; value: string }
  | { kind: 'float'; value: number }
  | { kind: 'double'; value: number }
  | { kind: 'int'; value: number }
  | { kind: 'uint'; value: number }
  | { kind: 'sint'; value: number }
  | { kind: 'bool'; value: boolean };

export interface MvtFeature {
  id: number | null;
  type: MvtGeomType;
  properties: Record<string, string | number | boolean>;
  /** Tile-local rings: each ring is [x,y] pairs in extent units. */
  geometry: number[][][];
}

export interface MvtLayer {
  name: string;
  version: number;
  extent: number;
  keys: string[];
  values: MvtValue[];
  features: MvtFeature[];
}

export interface MvtTile {
  layers: MvtLayer[];
}

export interface MvtGeoJsonFeature {
  type: 'Feature';
  id?: string | number;
  properties: Record<string, string | number | boolean | null>;
  geometry:
    | { type: 'Point'; coordinates: number[] }
    | { type: 'MultiPoint'; coordinates: number[][] }
    | { type: 'LineString'; coordinates: number[][] }
    | { type: 'MultiLineString'; coordinates: number[][][] }
    | { type: 'Polygon'; coordinates: number[][][] }
    | { type: 'MultiPolygon'; coordinates: number[][][][] }
    | { type: 'GeometryCollection'; geometries: never[] };
}

export interface MvtGeoJsonFeatureCollection {
  type: 'FeatureCollection';
  features: MvtGeoJsonFeature[];
}

const GEOM_TYPE: MvtGeomType[] = ['Unknown', 'Point', 'LineString', 'Polygon'];

class PbfReader {
  private offset = 0;

  constructor(private readonly bytes: Uint8Array) {}

  get pos(): number {
    return this.offset;
  }

  get end(): number {
    return this.bytes.length;
  }

  atEnd(): boolean {
    return this.offset >= this.bytes.length;
  }

  readVarint(): number {
    let result = 0;
    let shift = 0;
    while (this.offset < this.bytes.length) {
      const b = this.bytes[this.offset++];
      result |= (b & 0x7f) << shift;
      if ((b & 0x80) === 0) {
        return result >>> 0;
      }
      shift += 7;
      if (shift > 35) {
        throw new Error('Varint too long');
      }
    }
    throw new Error('Unexpected end of buffer while reading varint');
  }

  /** Read unsigned varint that may exceed 32 bits (returns Number; OK for MVT tags/geometry). */
  readVarint64(): number {
    let result = 0;
    let shift = 0;
    while (this.offset < this.bytes.length) {
      const b = this.bytes[this.offset++];
      if (shift < 53) {
        result += (b & 0x7f) * Math.pow(2, shift);
      }
      if ((b & 0x80) === 0) {
        return result;
      }
      shift += 7;
      if (shift > 70) {
        throw new Error('Varint64 too long');
      }
    }
    throw new Error('Unexpected end of buffer while reading varint64');
  }

  readSVarint(): number {
    const n = this.readVarint64();
    return zigZagDecode(n);
  }

  readBytes(): Uint8Array {
    const len = this.readVarint();
    if (this.offset + len > this.bytes.length) {
      throw new Error('Bytes length exceeds buffer');
    }
    const slice = this.bytes.subarray(this.offset, this.offset + len);
    this.offset += len;
    return slice;
  }

  readString(): string {
    const bytes = this.readBytes();
    if (typeof TextDecoder !== 'undefined') {
      return new TextDecoder('utf-8').decode(bytes);
    }
    let s = '';
    for (let i = 0; i < bytes.length; i++) {
      s += String.fromCharCode(bytes[i]);
    }
    try {
      return decodeURIComponent(escape(s));
    } catch {
      return s;
    }
  }

  readFloat(): number {
    if (this.offset + 4 > this.bytes.length) {
      throw new Error('Float exceeds buffer');
    }
    const view = new DataView(this.bytes.buffer, this.bytes.byteOffset + this.offset, 4);
    const v = view.getFloat32(0, true);
    this.offset += 4;
    return v;
  }

  readDouble(): number {
    if (this.offset + 8 > this.bytes.length) {
      throw new Error('Double exceeds buffer');
    }
    const view = new DataView(this.bytes.buffer, this.bytes.byteOffset + this.offset, 8);
    const v = view.getFloat64(0, true);
    this.offset += 8;
    return v;
  }

  skip(wireType: number): void {
    switch (wireType) {
      case 0:
        this.readVarint64();
        break;
      case 1:
        this.offset += 8;
        break;
      case 2:
        this.readBytes();
        break;
      case 5:
        this.offset += 4;
        break;
      default:
        throw new Error(`Unsupported wire type ${wireType}`);
    }
  }
}

export function zigZagDecode(n: number): number {
  return (n >>> 1) ^ -(n & 1);
}

export function decodeMvtTile(bytes: Uint8Array): MvtTile {
  const reader = new PbfReader(bytes);
  const layers: MvtLayer[] = [];
  while (!reader.atEnd()) {
    const tag = reader.readVarint();
    const field = tag >>> 3;
    const wire = tag & 7;
    if (field === 3 && wire === 2) {
      layers.push(decodeLayer(reader.readBytes()));
    } else {
      reader.skip(wire);
    }
  }
  return { layers };
}

function decodeLayer(bytes: Uint8Array): MvtLayer {
  const reader = new PbfReader(bytes);
  let name = '';
  let version = 1;
  let extent = 4096;
  const keys: string[] = [];
  const values: MvtValue[] = [];
  const featureBytes: Uint8Array[] = [];

  while (!reader.atEnd()) {
    const tag = reader.readVarint();
    const field = tag >>> 3;
    const wire = tag & 7;
    if (field === 1 && wire === 2) {
      name = reader.readString();
    } else if (field === 2 && wire === 2) {
      featureBytes.push(reader.readBytes());
    } else if (field === 3 && wire === 2) {
      keys.push(reader.readString());
    } else if (field === 4 && wire === 2) {
      values.push(decodeValue(reader.readBytes()));
    } else if (field === 5 && wire === 0) {
      extent = reader.readVarint();
    } else if (field === 15 && wire === 0) {
      version = reader.readVarint();
    } else {
      reader.skip(wire);
    }
  }

  const features = featureBytes.map((fb) => decodeFeature(fb, keys, values));
  return { name, version, extent, keys, values, features };
}

function decodeValue(bytes: Uint8Array): MvtValue {
  const reader = new PbfReader(bytes);
  while (!reader.atEnd()) {
    const tag = reader.readVarint();
    const field = tag >>> 3;
    const wire = tag & 7;
    if (field === 1 && wire === 2) {
      return { kind: 'string', value: reader.readString() };
    }
    if (field === 2 && wire === 5) {
      return { kind: 'float', value: reader.readFloat() };
    }
    if (field === 3 && wire === 1) {
      return { kind: 'double', value: reader.readDouble() };
    }
    if (field === 4 && wire === 0) {
      return { kind: 'int', value: reader.readVarint64() };
    }
    if (field === 5 && wire === 0) {
      return { kind: 'uint', value: reader.readVarint64() };
    }
    if (field === 6 && wire === 0) {
      return { kind: 'sint', value: reader.readSVarint() };
    }
    if (field === 7 && wire === 0) {
      return { kind: 'bool', value: reader.readVarint() !== 0 };
    }
    reader.skip(wire);
  }
  return { kind: 'string', value: '' };
}

function mvtValueToJs(v: MvtValue): string | number | boolean {
  return v.value;
}

function decodeFeature(
  bytes: Uint8Array,
  keys: string[],
  values: MvtValue[]
): MvtFeature {
  const reader = new PbfReader(bytes);
  let id: number | null = null;
  let type: MvtGeomType = 'Unknown';
  const tags: number[] = [];
  let geometryCmds: number[] = [];

  while (!reader.atEnd()) {
    const tag = reader.readVarint();
    const field = tag >>> 3;
    const wire = tag & 7;
    if (field === 1 && wire === 0) {
      id = reader.readVarint64();
    } else if (field === 2 && wire === 2) {
      const packed = reader.readBytes();
      const pr = new PbfReader(packed);
      while (!pr.atEnd()) {
        tags.push(pr.readVarint());
      }
    } else if (field === 3 && wire === 0) {
      const t = reader.readVarint();
      type = GEOM_TYPE[t] ?? 'Unknown';
    } else if (field === 4 && wire === 2) {
      const packed = reader.readBytes();
      const pr = new PbfReader(packed);
      const cmds: number[] = [];
      while (!pr.atEnd()) {
        cmds.push(pr.readVarint());
      }
      geometryCmds = cmds;
    } else {
      reader.skip(wire);
    }
  }

  const properties: Record<string, string | number | boolean> = {};
  for (let i = 0; i + 1 < tags.length; i += 2) {
    const ki = tags[i];
    const vi = tags[i + 1];
    if (ki >= 0 && ki < keys.length && vi >= 0 && vi < values.length) {
      properties[keys[ki]] = mvtValueToJs(values[vi]);
    }
  }

  return {
    id,
    type,
    properties,
    geometry: decodeGeometryCommands(geometryCmds)
  };
}

/**
 * Decode MVT command stream into rings of [x,y] tile coordinates.
 * MoveTo=1, LineTo=2, ClosePath=7.
 */
export function decodeGeometryCommands(cmds: number[]): number[][][] {
  const rings: number[][][] = [];
  let ring: number[][] = [];
  let x = 0;
  let y = 0;
  let i = 0;

  while (i < cmds.length) {
    const cmdInt = cmds[i++];
    const id = cmdInt & 0x7;
    const count = cmdInt >>> 3;

    if (id === 1) {
      // MoveTo — start a new ring for each move after the first point of a path
      for (let c = 0; c < count; c++) {
        if (ring.length > 0) {
          rings.push(ring);
          ring = [];
        }
        x += zigZagDecode(cmds[i++]);
        y += zigZagDecode(cmds[i++]);
        ring.push([x, y]);
      }
    } else if (id === 2) {
      for (let c = 0; c < count; c++) {
        x += zigZagDecode(cmds[i++]);
        y += zigZagDecode(cmds[i++]);
        ring.push([x, y]);
      }
    } else if (id === 7) {
      if (ring.length > 0) {
        const first = ring[0];
        const last = ring[ring.length - 1];
        if (first[0] !== last[0] || first[1] !== last[1]) {
          ring.push([first[0], first[1]]);
        }
        rings.push(ring);
        ring = [];
      }
    } else {
      // Unknown command — abort remaining
      break;
    }
  }
  if (ring.length > 0) {
    rings.push(ring);
  }
  return rings;
}

/** Web Mercator tile bounds in WGS84 degrees. */
export function tileBoundsLonLat(
  z: number,
  x: number,
  y: number
): { west: number; south: number; east: number; north: number } {
  const n = Math.pow(2, z);
  const west = (x / n) * 360 - 180;
  const east = ((x + 1) / n) * 360 - 180;
  const north = mercatorYToLat(y / n);
  const south = mercatorYToLat((y + 1) / n);
  return { west, south, east, north };
}

function mercatorYToLat(y: number): number {
  const n = Math.PI - 2 * Math.PI * y;
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

/** Project tile-local (px,py) in [0,extent] to lon/lat for tile z/x/y. */
export function tilePixelToLonLat(
  px: number,
  py: number,
  z: number,
  x: number,
  y: number,
  extent: number
): [number, number] {
  const n = Math.pow(2, z);
  const size = extent > 0 ? extent : 4096;
  const mercX = (x + px / size) / n;
  const mercY = (y + py / size) / n;
  const lon = mercX * 360 - 180;
  const lat = mercatorYToLat(mercY);
  return [lon, lat];
}

function projectRing(
  ring: number[][],
  z: number,
  x: number,
  y: number,
  extent: number
): number[][] {
  return ring.map(([px, py]) => tilePixelToLonLat(px, py, z, x, y, extent));
}

export function featureToGeoJson(
  feature: MvtFeature,
  layerName: string,
  z: number,
  x: number,
  y: number,
  extent: number
): MvtGeoJsonFeature | null {
  const rings = feature.geometry;
  if (!rings.length) {
    return null;
  }
  const props: Record<string, string | number | boolean | null> = {
    ...feature.properties,
    layer: layerName
  };
  const id = feature.id != null ? feature.id : undefined;

  if (feature.type === 'Point') {
    const coords = rings.map((r) => tilePixelToLonLat(r[0][0], r[0][1], z, x, y, extent));
    if (coords.length === 1) {
      return {
        type: 'Feature',
        id,
        properties: props,
        geometry: { type: 'Point', coordinates: coords[0] }
      };
    }
    return {
      type: 'Feature',
      id,
      properties: props,
      geometry: { type: 'MultiPoint', coordinates: coords }
    };
  }

  if (feature.type === 'LineString') {
    const lines = rings.map((r) => projectRing(r, z, x, y, extent));
    if (lines.length === 1) {
      return {
        type: 'Feature',
        id,
        properties: props,
        geometry: { type: 'LineString', coordinates: lines[0] }
      };
    }
    return {
      type: 'Feature',
      id,
      properties: props,
      geometry: { type: 'MultiLineString', coordinates: lines }
    };
  }

  if (feature.type === 'Polygon') {
    // MVT: outer rings + holes. Treat each MoveTo-started ring as polygon parts;
    // for simplicity: first ring exterior, subsequent as holes of one polygon,
    // or MultiPolygon if multiple exteriors (positive area / CW vs CCW not enforced).
    const projected = rings.map((r) => projectRing(r, z, x, y, extent));
    if (projected.length === 1) {
      return {
        type: 'Feature',
        id,
        properties: props,
        geometry: { type: 'Polygon', coordinates: projected }
      };
    }
    // Heuristic: rings with clockwise winding (MVT exterior) start new polygons
    const polygons: number[][][][] = [];
    let current: number[][][] | null = null;
    for (const ring of projected) {
      const area = ringSignedArea(ring);
      if (current == null || area > 0) {
        current = [ring];
        polygons.push(current);
      } else {
        current.push(ring);
      }
    }
    if (polygons.length === 1) {
      return {
        type: 'Feature',
        id,
        properties: props,
        geometry: { type: 'Polygon', coordinates: polygons[0] }
      };
    }
    return {
      type: 'Feature',
      id,
      properties: props,
      geometry: { type: 'MultiPolygon', coordinates: polygons }
    };
  }

  return null;
}

function ringSignedArea(ring: number[][]): number {
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    sum += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  }
  return sum / 2;
}

export function tileToGeoJson(
  tile: MvtTile,
  z: number,
  x: number,
  y: number
): MvtGeoJsonFeatureCollection {
  const features: MvtGeoJsonFeature[] = [];
  for (const layer of tile.layers) {
    const extent = layer.extent || 4096;
    for (const feature of layer.features) {
      const gj = featureToGeoJson(feature, layer.name, z, x, y, extent);
      if (gj) {
        features.push(gj);
      }
    }
  }
  return { type: 'FeatureCollection', features };
}

export function layerFeatureCounts(tile: MvtTile): Array<{ name: string; count: number; extent: number }> {
  return tile.layers.map((layer) => ({
    name: layer.name,
    count: layer.features.length,
    extent: layer.extent
  }));
}
