import type { StRelatedToolLink } from '../shared/st-tool-suggestion.model';
import type { PrivateNotesFormValues, PrivateNotesState } from '../types/private-notes.types';

export const PRIVATE_NOTES_DEFAULT_FORM: PrivateNotesFormValues = {
  note: '',
  password: '',
  showNote: false
};

export const PRIVATE_NOTES_EMPTY_STATE: PrivateNotesState = {
  encrypted: null,
  lastSavedAt: null
};

/** Soft guidance threshold — does not change encrypt/decrypt validation rules. */
export const PRIVATE_NOTES_SHORT_PASSWORD_LENGTH = 8;

export const PRIVATE_NOTES_RELATED_TOOLS: ReadonlyArray<StRelatedToolLink> = [
  {
    label: 'Random Password Generator',
    path: '/security-tools/random-password-generator',
    description: 'Create a strong passphrase before encrypting a note'
  },
  {
    label: 'Password Strength Checker',
    path: '/security-tools/password-strength-checker',
    description: 'Score the passphrase you plan to use for encryption'
  },
  {
    label: 'Text Encrypt / Decrypt',
    path: '/security-tools/text-encrypt-decrypt',
    description: 'Encrypt arbitrary text without the notes session workflow'
  },
  {
    label: 'Secure Clipboard',
    path: '/security-tools/secure-clipboard',
    description: 'Copy decrypted text with an auto-expiring in-memory store'
  }
];
