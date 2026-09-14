/** Parse Apple XML plist documents (Info.plist) without external deps. */
export function parseXmlPlist(xml: string): Record<string, unknown> {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) {
    throw new Error('Invalid plist XML');
  }

  const dict = doc.querySelector('plist > dict');
  if (!dict) {
    throw new Error('Plist root dict not found');
  }

  return parsePlistDict(dict);
}

function parsePlistDict(dict: Element): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const children = Array.from(dict.children);

  for (let i = 0; i < children.length; i += 2) {
    const keyNode = children[i];
    const valueNode = children[i + 1];
    if (!keyNode || keyNode.tagName !== 'key' || !valueNode) {
      continue;
    }
    const key = keyNode.textContent?.trim() ?? '';
    if (key) {
      result[key] = parsePlistValue(valueNode);
    }
  }

  return result;
}

function parsePlistArray(array: Element): unknown[] {
  return Array.from(array.children).map((child) => parsePlistValue(child));
}

function parsePlistValue(node: Element): unknown {
  switch (node.tagName) {
    case 'string':
      return node.textContent ?? '';
    case 'integer':
      return Number(node.textContent ?? 0);
    case 'real':
      return Number(node.textContent ?? 0);
    case 'true':
      return true;
    case 'false':
      return false;
    case 'dict':
      return parsePlistDict(node);
    case 'array':
      return parsePlistArray(node);
    default:
      return node.textContent ?? '';
  }
}

export function isBinaryPlist(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 8 &&
    bytes[0] === 0x62 &&
    bytes[1] === 0x70 &&
    bytes[2] === 0x6c &&
    bytes[3] === 0x69 &&
    bytes[4] === 0x73 &&
    bytes[5] === 0x74 &&
    bytes[6] === 0x30 &&
    bytes[7] === 0x30
  );
}

/** Parse XML or binary Info.plist bytes without external dependencies. */
export function parsePlistBytes(bytes: Uint8Array): Record<string, unknown> {
  if (isBinaryPlist(bytes)) {
    return parseBinaryPlist(bytes);
  }

  const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  if (text.trimStart().startsWith('<?xml') || text.trimStart().startsWith('<plist')) {
    return parseXmlPlist(text);
  }

  throw new Error('Unsupported Info.plist format');
}

export function parseBinaryPlist(bytes: Uint8Array): Record<string, unknown> {
  if (!isBinaryPlist(bytes)) {
    throw new Error('Not a binary plist');
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const trailerOffset = bytes.length - 32;
  const offsetSize = bytes[trailerOffset + 6] ?? 0;
  const refSize = bytes[trailerOffset + 7] ?? 0;
  const numObjects = readUintBe(view, trailerOffset + 8, 8);
  const rootIndex = readUintBe(view, trailerOffset + 16, 8);
  const offsetTableOffset = readUintBe(view, trailerOffset + 24, 8);

  const offsets: number[] = [];
  for (let i = 0; i < numObjects; i++) {
    offsets.push(readUintBe(view, offsetTableOffset + i * offsetSize, offsetSize));
  }

  const readObject = (index: number): unknown => {
    const offset = offsets[index];
    if (offset === undefined) {
      throw new Error('Invalid plist object reference');
    }
    return parseObjectAt(offset);
  };

  const parseObjectAt = (offset: number): unknown => {
    const marker = bytes[offset];
    if (marker === undefined) {
      throw new Error('Invalid plist object offset');
    }

    const type = marker >> 4;
    const sizeInfo = marker & 0x0f;

    switch (type) {
      case 0x0:
        if (sizeInfo === 0x0) {
          return null;
        }
        if (sizeInfo === 0x8) {
          return false;
        }
        if (sizeInfo === 0x9) {
          return true;
        }
        throw new Error(`Unsupported plist singleton 0x${sizeInfo.toString(16)}`);
      case 0x1: {
        const intBytes = 1 << sizeInfo;
        return readSignedInt(view, offset + 1, intBytes);
      }
      case 0x2:
        if (sizeInfo === 2) {
          return view.getFloat32(offset + 1, false);
        }
        if (sizeInfo === 3) {
          return view.getFloat64(offset + 1, false);
        }
        throw new Error('Unsupported plist real size');
      case 0x4: {
        const [dataLen, headerSize] = readInlineSize(bytes, view, offset, sizeInfo);
        return bytes.slice(offset + headerSize, offset + headerSize + dataLen);
      }
      case 0x5: {
        const [strLen, headerSize] = readInlineSize(bytes, view, offset, sizeInfo);
        return new TextDecoder('latin1').decode(
          bytes.subarray(offset + headerSize, offset + headerSize + strLen)
        );
      }
      case 0x6: {
        const [charLen, headerSize] = readInlineSize(bytes, view, offset, sizeInfo);
        return new TextDecoder('utf-16be').decode(
          bytes.subarray(offset + headerSize, offset + headerSize + charLen * 2)
        );
      }
      case 0xa: {
        const [arrLen, headerSize] = readInlineSize(bytes, view, offset, sizeInfo);
        const items: unknown[] = [];
        let pos = offset + headerSize;
        for (let i = 0; i < arrLen; i++) {
          items.push(readObject(readUintBe(view, pos, refSize)));
          pos += refSize;
        }
        return items;
      }
      case 0xd: {
        const [dictLen, headerSize] = readInlineSize(bytes, view, offset, sizeInfo);
        let pos = offset + headerSize;
        const keyRefs: number[] = [];
        const valRefs: number[] = [];

        for (let i = 0; i < dictLen; i++) {
          keyRefs.push(readUintBe(view, pos, refSize));
          pos += refSize;
        }
        for (let i = 0; i < dictLen; i++) {
          valRefs.push(readUintBe(view, pos, refSize));
          pos += refSize;
        }

        const dict: Record<string, unknown> = {};
        for (let i = 0; i < dictLen; i++) {
          const key = readObject(keyRefs[i] ?? 0);
          dict[String(key)] = readObject(valRefs[i] ?? 0);
        }
        return dict;
      }
      default:
        throw new Error(`Unsupported plist object type 0x${type.toString(16)}`);
    }
  };

  const root = readObject(rootIndex);
  if (root && typeof root === 'object' && !Array.isArray(root)) {
    return root as Record<string, unknown>;
  }

  throw new Error('Binary plist root is not a dictionary');
}

function readInlineSize(
  bytes: Uint8Array,
  view: DataView,
  offset: number,
  sizeInfo: number
): [number, number] {
  if (sizeInfo !== 0x0f) {
    return [sizeInfo, 1];
  }

  const extMarker = bytes[offset + 1];
  if (extMarker === undefined) {
    throw new Error('Invalid plist extended size marker');
  }

  const extType = extMarker >> 4;
  const extSize = extMarker & 0x0f;
  if (extType === 0x1) {
    const byteCount = 1 << extSize;
    return [readUintBe(view, offset + 2, byteCount), 2 + byteCount];
  }

  throw new Error('Unsupported plist extended size');
}

function readUintBe(view: DataView, offset: number, size: number): number {
  let result = 0;
  for (let i = 0; i < size; i++) {
    result = result * 256 + view.getUint8(offset + i);
  }
  return result;
}

function readSignedInt(view: DataView, offset: number, size: number): number {
  if (size === 1) {
    return view.getInt8(offset);
  }
  if (size === 2) {
    return view.getInt16(offset, false);
  }
  if (size === 4) {
    return view.getInt32(offset, false);
  }
  if (size === 8) {
    const hi = view.getInt32(offset, false);
    const lo = view.getUint32(offset + 4, false);
    return hi * 4294967296 + lo;
  }
  return readUintBe(view, offset, size);
}
