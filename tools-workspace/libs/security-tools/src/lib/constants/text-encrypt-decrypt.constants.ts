import type { StRelatedToolLink } from '../shared/st-tool-suggestion.model';
import type {
  TextCryptoState,
  TextEncryptDecryptFormValues
} from '../types/text-encrypt-decrypt.types';

export const TEXT_ENCRYPT_DEFAULT_FORM: TextEncryptDecryptFormValues = {
  mode: 'encrypt',
  plaintext: '',
  ciphertext: '',
  password: ''
};

export const TEXT_ENCRYPT_EMPTY_STATE: TextCryptoState = {
  output: '',
  lastAction: null
};

export const TEXT_ENCRYPT_RELATED_TOOLS: ReadonlyArray<StRelatedToolLink> = [
  {
    label: 'Random Password Generator',
    path: '/security-tools/random-password-generator',
    description: 'Create a strong passphrase before encrypting text'
  },
  {
    label: 'Password Strength Checker',
    path: '/security-tools/password-strength-checker',
    description: 'Score the passphrase you plan to use'
  },
  {
    label: 'Private Notes',
    path: '/security-tools/private-notes',
    description: 'Encrypt a note in a session-oriented notes workflow'
  },
  {
    label: 'Secure Clipboard',
    path: '/security-tools/secure-clipboard',
    description: 'Copy sensitive plaintext with an auto-expiring in-memory store'
  },
  {
    label: 'Hash Generator',
    path: '/security-tools/hash-generator',
    description: 'Need a one-way digest instead of reversible encryption?'
  }
];
