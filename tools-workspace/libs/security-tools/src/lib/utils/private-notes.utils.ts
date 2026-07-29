import type { StToolSuggestion } from '../shared/st-tool-suggestion.model';
import { PRIVATE_NOTES_SHORT_PASSWORD_LENGTH } from '../constants/private-notes.constants';
import type { PrivateNotesSuggestionContext } from '../types/private-notes.types';

export function formatPrivateNotesSavedTime(timestamp: number | null): string {
  if (!timestamp) {
    return 'Never';
  }
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function resolvePrivateNotesStatusLabel(
  hasEncrypted: boolean,
  isLocked: boolean
): 'Locked' | 'Unlocked' | 'Empty' {
  if (!hasEncrypted) {
    return 'Empty';
  }
  return isLocked ? 'Locked' : 'Unlocked';
}

export function validatePrivateNotesEncrypt(
  note: string,
  password: string
): string[] {
  if (!note.trim()) {
    return ['Enter some note content to encrypt.'];
  }
  if (!password) {
    return ['Enter a password to encrypt your notes.'];
  }
  return [];
}

export function validatePrivateNotesDecrypt(
  hasEncrypted: boolean,
  password: string
): string[] {
  if (!hasEncrypted) {
    return ['There is no encrypted note to decrypt.'];
  }
  if (!password) {
    return ['Enter the password used to encrypt this note.'];
  }
  return [];
}

export function mapPrivateNotesCryptoError(action: 'encrypt' | 'decrypt', error: unknown): string {
  if (action === 'encrypt') {
    const msg = error instanceof Error ? error.message : 'Unknown error during encryption.';
    return `Failed to encrypt note: ${msg}`;
  }
  const msg = error instanceof Error ? error.message : 'Unknown error during decryption.';
  return `Failed to decrypt note: ${msg}`;
}

export function resolvePrivateNotesSuggestion(
  context: PrivateNotesSuggestionContext
): StToolSuggestion | null {
  const { hasNote, hasPassword, passwordLength, hasEncrypted, isLocked, errorMessage } = context;

  if (errorMessage?.includes('decrypt')) {
    return {
      id: 'pn-decrypt-failed',
      title: 'Decryption did not succeed',
      reason:
        'Wrong password or corrupted ciphertext are the usual causes. Re-enter the original password, or paste a backup blob if you have one.',
      actionLabel: 'Open Text Encrypt / Decrypt',
      path: '/security-tools/text-encrypt-decrypt'
    };
  }

  if (!hasNote && !hasEncrypted) {
    return {
      id: 'pn-get-started',
      title: 'Protect a note locally?',
      reason:
        'Write your note, set a strong password in Options, then Encrypt. Ciphertext stays in memory for this session only.',
      actionLabel: 'Open Password Generator',
      path: '/security-tools/random-password-generator'
    };
  }

  if (hasNote && !hasPassword) {
    return {
      id: 'pn-need-password',
      title: 'Password required to encrypt',
      reason:
        'AES-GCM encryption needs a passphrase. Generate one you can remember (or store in a password manager), then paste it in Options.',
      actionLabel: 'Open Password Generator',
      path: '/security-tools/random-password-generator'
    };
  }

  if (hasNote && hasPassword && passwordLength < PRIVATE_NOTES_SHORT_PASSWORD_LENGTH) {
    return {
      id: 'pn-short-password',
      title: 'Passphrase looks short',
      reason:
        'Longer unique passphrases resist guessing. Check strength, then encrypt when you are ready.',
      actionLabel: 'Open Strength Checker',
      path: '/security-tools/password-strength-checker'
    };
  }

  if (hasEncrypted && isLocked) {
    return {
      id: 'pn-locked',
      title: 'Encrypted note is locked',
      reason:
        'Enter the same password used at encrypt time, then Decrypt to restore plaintext in the editor.',
      actionLabel: 'Open Password Generator',
      path: '/security-tools/random-password-generator'
    };
  }

  if (hasEncrypted && !isLocked) {
    return {
      id: 'pn-secure-clipboard',
      title: 'Moving decrypted text elsewhere?',
      reason:
        'Secure Clipboard can copy sensitive text with an auto-expiring in-memory encrypted store.',
      actionLabel: 'Open Secure Clipboard',
      path: '/security-tools/secure-clipboard'
    };
  }

  if (hasEncrypted) {
    return {
      id: 'pn-text-encrypt',
      title: 'Need a general encrypt/decrypt flow?',
      reason:
        'Text Encrypt / Decrypt uses the same local AES-GCM approach without the notes session UI.',
      actionLabel: 'Open Text Encrypt / Decrypt',
      path: '/security-tools/text-encrypt-decrypt'
    };
  }

  return null;
}
