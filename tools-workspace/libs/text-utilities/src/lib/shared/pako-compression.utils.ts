import * as pako from 'pako';
import type { DeflateFunctionOptions } from 'pako';

export type PakoFormat = 'deflate' | 'deflateRaw' | 'gzip';
export type PakoBinaryEncoding = 'base64' | 'hex';

export type PakoCompressResult = {
  output: string;
  inputBytes: number;
  outputBytes: number;
  ratio: number;
};

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}

function base64ToUint8(base64: string): Uint8Array {
  const trimmed = base64.trim().replace(/\s/g, '');
  const binary = atob(trimmed);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

function uint8ToHex(bytes: Uint8Array, separator = ''): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join(separator);
}

function hexToUint8(hex: string): Uint8Array {
  const cleaned = hex.replace(/[^0-9a-fA-F]/g, '');
  if (cleaned.length % 2 !== 0) {
    throw new Error('Invalid hex string length.');
  }
  const bytes = new Uint8Array(cleaned.length / 2);
  for (let i = 0; i < cleaned.length; i += 2) {
    bytes[i / 2] = parseInt(cleaned.slice(i, i + 2), 16);
  }
  return bytes;
}

function toPakoLevel(level: number): NonNullable<DeflateFunctionOptions['level']> {
  const clamped = Math.min(9, Math.max(0, Math.round(level)));
  return clamped as NonNullable<DeflateFunctionOptions['level']>;
}

function compressBytes(text: string, format: PakoFormat, level: number): Uint8Array {
  const input = new TextEncoder().encode(text);
  const options: DeflateFunctionOptions = { level: toPakoLevel(level) };
  switch (format) {
    case 'deflate':
      return pako.deflate(input, options);
    case 'deflateRaw':
      return pako.deflateRaw(input, options);
    case 'gzip':
      return pako.gzip(input, options);
    default:
      return pako.deflate(input, options);
  }
}

function decompressBytes(bytes: Uint8Array, format: PakoFormat): Uint8Array {
  switch (format) {
    case 'deflate':
      return pako.inflate(bytes);
    case 'deflateRaw':
      return pako.inflateRaw(bytes);
    case 'gzip':
      return pako.ungzip(bytes);
    default:
      return pako.inflate(bytes);
  }
}

export function pakoCompress(
  text: string,
  format: PakoFormat,
  encoding: PakoBinaryEncoding,
  level: number,
): PakoCompressResult {
  const compressed = compressBytes(text, format, level);
  const inputBytes = new TextEncoder().encode(text).length;
  const outputBytes = compressed.length;
  const output =
    encoding === 'base64'
      ? uint8ToBase64(compressed)
      : uint8ToHex(compressed, ' ');
  const ratio = inputBytes > 0 ? Math.round((1 - outputBytes / inputBytes) * 1000) / 10 : 0;
  return { output, inputBytes, outputBytes, ratio };
}

export function pakoDecompress(input: string, format: PakoFormat, encoding: PakoBinaryEncoding): string {
  const bytes = encoding === 'base64' ? base64ToUint8(input) : hexToUint8(input);
  try {
    const decompressed = decompressBytes(bytes, format);
    return new TextDecoder().decode(decompressed);
  } catch {
    throw new Error(`Failed to decompress. Check format (${format}) and ${encoding} input.`);
  }
}
