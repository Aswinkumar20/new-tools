import type { StRelatedToolLink } from '../shared/st-tool-suggestion.model';
import type {
  SecureClipboardFormValues,
  SecureClipboardState
} from '../types/secure-clipboard.types';

export const SECURE_CLIPBOARD_DEFAULT_FORM: SecureClipboardFormValues = {
  text: '',
  password: '',
  ttlSeconds: 60
};

export const SECURE_CLIPBOARD_EMPTY_STATE: SecureClipboardState = {
  stored: null,
  expiresAt: null
};

export const SECURE_CLIPBOARD_TIMER_MS = 1000;

export const SECURE_CLIPBOARD_EXPIRED_WARNING =
  'Secure clipboard content has expired and was cleared.';

export const SECURE_CLIPBOARD_STORED_WARNING =
  'Text copied to system clipboard and encrypted in memory. It will clear when the timer ends.';

export const SECURE_CLIPBOARD_RELATED_TOOLS: ReadonlyArray<StRelatedToolLink> = [
  {
    label: 'Random Password Generator',
    path: '/security-tools/random-password-generator',
    description: 'Create a strong passphrase before encrypting clipboard content'
  },
  {
    label: 'Private Notes',
    path: '/security-tools/private-notes',
    description: 'Keep a longer encrypted note in memory for the session'
  },
  {
    label: 'Text Encrypt / Decrypt',
    path: '/security-tools/text-encrypt-decrypt',
    description: 'Encrypt text without a TTL timer when you need a reusable blob'
  },
  {
    label: 'Password Strength Checker',
    path: '/security-tools/password-strength-checker',
    description: 'Score the passphrase used to protect clipboard content'
  }
];
