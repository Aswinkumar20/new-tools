import type { StRelatedToolLink } from '../shared/st-tool-suggestion.model';
import type {
  HashAlgorithm,
  HashAlgorithmOption,
  HashGeneratorFormValues,
  HashOutputFormat
} from '../types/hash-generator.types';

export const HASH_DEFAULT_FORM: HashGeneratorFormValues = {
  input: '',
  algorithm: 'sha256',
  uppercase: false,
  outputFormat: 'hex'
};

export const HASH_ALGORITHM_OPTIONS: ReadonlyArray<HashAlgorithmOption> = [
  { value: 'sha256', label: 'SHA-256', available: true },
  { value: 'sha384', label: 'SHA-384', available: true },
  { value: 'sha512', label: 'SHA-512', available: true },
  { value: 'md5', label: 'MD5 (disabled)', available: false },
  { value: 'sha1', label: 'SHA-1 (disabled)', available: false }
];

export const HASH_OUTPUT_FORMAT_OPTIONS: ReadonlyArray<{
  value: HashOutputFormat;
  label: string;
}> = [
  { value: 'hex', label: 'Hex' },
  { value: 'base64', label: 'Base64' },
  { value: 'both', label: 'Hex & Base64' }
];

export const HASH_UNSUPPORTED_ALGORITHMS: ReadonlyArray<HashAlgorithm> = ['md5', 'sha1'];

export const HASH_UNSUPPORTED_ALGORITHM_MESSAGE =
  'MD5 and SHA-1 are not available via Web Crypto in this demo. Please use SHA-256, SHA-384, or SHA-512.';

export const HASH_EMPTY_INPUT_MESSAGE = 'Enter some text to hash.';

export const HASH_RELATED_TOOLS: ReadonlyArray<StRelatedToolLink> = [
  {
    label: 'UUID Generator',
    path: '/security-tools/uuid-generator',
    description: 'Create random identifiers when you need unique IDs instead of digests'
  },
  {
    label: 'Random Password Generator',
    path: '/security-tools/random-password-generator',
    description: 'Generate secrets, then hash them for storage-style checksums'
  },
  {
    label: 'Text Encrypt / Decrypt',
    path: '/security-tools/text-encrypt-decrypt',
    description: 'Need reversible encryption instead of a one-way hash?'
  },
  {
    label: 'File Metadata Viewer',
    path: '/code-file-tools/file-metadata-viewer',
    description: 'Inspect files before generating checksums elsewhere in your workflow'
  },
  {
    label: 'Hex Encode / Decode',
    path: '/text-utilities/hex-encode-decode',
    description: 'Convert between hex and text when validating digest strings'
  }
];
