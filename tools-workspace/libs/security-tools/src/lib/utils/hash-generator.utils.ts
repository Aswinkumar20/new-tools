import type { StToolSuggestion } from '../shared/st-tool-suggestion.model';
import {
  HASH_EMPTY_INPUT_MESSAGE,
  HASH_UNSUPPORTED_ALGORITHMS,
  HASH_UNSUPPORTED_ALGORITHM_MESSAGE
} from '../constants/hash-generator.constants';
import type {
  HashAlgorithm,
  HashOutputFormat,
  HashResult,
  HashSuggestionContext
} from '../types/hash-generator.types';

export function isUnsupportedHashAlgorithm(algorithm: HashAlgorithm): boolean {
  return (HASH_UNSUPPORTED_ALGORITHMS as ReadonlyArray<string>).includes(algorithm);
}

export function resolveWebCryptoDigestName(
  algorithm: HashAlgorithm
): 'SHA-256' | 'SHA-384' | 'SHA-512' | null {
  switch (algorithm) {
    case 'sha256':
      return 'SHA-256';
    case 'sha384':
      return 'SHA-384';
    case 'sha512':
      return 'SHA-512';
    default:
      return null;
  }
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function bytesToBase64(bytes: Uint8Array): string {
  return btoa(String.fromCodePoint(...bytes));
}

export function formatHashHex(hex: string, uppercase: boolean): string {
  return uppercase ? hex.toUpperCase() : hex.toLowerCase();
}

export function formatHashOutputText(
  result: HashResult,
  format: HashOutputFormat,
  uppercase: boolean
): string {
  const hex = formatHashHex(result.hex, uppercase);
  if (format === 'hex') {
    return hex;
  }
  if (format === 'base64') {
    return result.base64;
  }
  return `Hex:\n${hex}\n\nBase64:\n${result.base64}`;
}

export async function computeHashResult(
  input: string,
  algorithm: HashAlgorithm
): Promise<{ result: HashResult | null; errors: string[] }> {
  const value = input ?? '';

  if (!value) {
    return { result: null, errors: [HASH_EMPTY_INPUT_MESSAGE] };
  }

  if (isUnsupportedHashAlgorithm(algorithm)) {
    return { result: null, errors: [HASH_UNSUPPORTED_ALGORITHM_MESSAGE] };
  }

  const digestName = resolveWebCryptoDigestName(algorithm);
  if (!digestName) {
    return { result: null, errors: [HASH_UNSUPPORTED_ALGORITHM_MESSAGE] };
  }

  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(value);
    const hashBuffer = await crypto.subtle.digest(digestName, data);
    const bytes = new Uint8Array(hashBuffer);

    return {
      result: {
        algorithm,
        hex: bytesToHex(bytes),
        base64: bytesToBase64(bytes),
        lengthBits: bytes.length * 8
      },
      errors: []
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error while hashing.';
    return { result: null, errors: [`Failed to generate hash: ${msg}`] };
  }
}

export function resolveHashSuggestion(
  context: HashSuggestionContext
): StToolSuggestion | null {
  const { hasInput, hasResult, hasError, algorithm, errorMessage } = context;

  if (hasError && isUnsupportedHashAlgorithm(algorithm)) {
    return {
      id: 'hg-unsupported-algo',
      title: 'Use a modern Web Crypto digest',
      reason:
        'MD5 and SHA-1 are not exposed by SubtleCrypto here. Switch to SHA-256 (or stronger), or use Text Encrypt/Decrypt when you need reversible protection.',
      actionLabel: 'Open Text Encrypt / Decrypt',
      path: '/security-tools/text-encrypt-decrypt'
    };
  }

  if (hasError && errorMessage?.includes('Enter some text')) {
    return {
      id: 'hg-empty-input',
      title: 'Need sample text to hash?',
      reason:
        'Paste any string to generate a digest. UUID Generator can also create unique values you can hash for demos.',
      actionLabel: 'Open UUID Generator',
      path: '/security-tools/uuid-generator'
    };
  }

  if (!hasInput && !hasResult) {
    return {
      id: 'hg-get-started',
      title: 'Hashing passwords or IDs?',
      reason:
        'Generate a strong secret with Random Password Generator, then hash it here for one-way checksums.',
      actionLabel: 'Open Password Generator',
      path: '/security-tools/random-password-generator'
    };
  }

  if (hasResult) {
    return {
      id: 'hg-file-meta',
      title: 'Working with files instead of text?',
      reason:
        'File Metadata Viewer helps inspect containers and sizes before you compute checksums in your local toolchain.',
      actionLabel: 'Open File Metadata Viewer',
      path: '/code-file-tools/file-metadata-viewer'
    };
  }

  return null;
}
