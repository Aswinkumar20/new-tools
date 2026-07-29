import type { StToolSuggestion } from '../shared/st-tool-suggestion.model';
import {
  SECURE_CLIPBOARD_EXPIRED_WARNING
} from '../constants/secure-clipboard.constants';
import type { SecureClipboardSuggestionContext } from '../types/secure-clipboard.types';

export function resolveSecureClipboardStatusLabel(
  hasStored: boolean,
  isExpired: boolean
): 'Empty' | 'Expired' | 'Active' {
  if (!hasStored) {
    return 'Empty';
  }
  return isExpired ? 'Expired' : 'Active';
}

export function formatSecureClipboardExpiresAt(expiresAt: number | null): string {
  if (!expiresAt) {
    return 'N/A';
  }
  return new Date(expiresAt).toLocaleTimeString();
}

export function computeSecureClipboardRemainingSeconds(
  expiresAt: number | null,
  nowMs: number
): number {
  if (!expiresAt) {
    return 0;
  }
  return Math.floor(Math.max(0, expiresAt - nowMs) / 1000);
}

export function isSecureClipboardExpired(
  expiresAt: number | null,
  nowMs: number
): boolean {
  if (!expiresAt) {
    return false;
  }
  return nowMs >= expiresAt;
}

export function validateSecureClipboardStore(
  text: string,
  password: string,
  ttlSeconds: number
): string[] {
  if (!text.trim()) {
    return ['Enter some text to copy to the secure clipboard.'];
  }
  if (!password) {
    return ['Enter a password to encrypt the clipboard content.'];
  }
  if (ttlSeconds <= 0) {
    return ['Time to live must be greater than 0 seconds.'];
  }
  return [];
}

export function mapSecureClipboardError(error: unknown): string {
  const msg =
    error instanceof Error ? error.message : 'Unknown error while copying or encrypting.';
  return `Failed to use secure clipboard: ${msg}`;
}

export function resolveSecureClipboardSuggestion(
  context: SecureClipboardSuggestionContext
): StToolSuggestion | null {
  const {
    hasText,
    hasPassword,
    hasStored,
    isActive,
    ttlSeconds,
    errorMessage,
    warningMessage
  } = context;

  if (warningMessage === SECURE_CLIPBOARD_EXPIRED_WARNING) {
    return {
      id: 'sc-expired',
      title: 'Secure store expired',
      reason:
        'The in-memory ciphertext was cleared on schedule. Secure-copy again if you still need a short-lived paste buffer.',
      actionLabel: 'Open Private Notes',
      path: '/security-tools/private-notes'
    };
  }

  if (errorMessage?.includes('clipboard') || errorMessage?.includes('Failed to use')) {
    return {
      id: 'sc-clipboard-failed',
      title: 'Clipboard or encryption failed',
      reason:
        'Check browser clipboard permission, then retry. For longer-lived ciphertext without a TTL, use Text Encrypt / Decrypt.',
      actionLabel: 'Open Text Encrypt / Decrypt',
      path: '/security-tools/text-encrypt-decrypt'
    };
  }

  if (!hasText) {
    return {
      id: 'sc-get-started',
      title: 'Need a short-lived paste buffer?',
      reason:
        'Paste sensitive text, set a password and TTL in Options, then Secure copy. The OS clipboard gets plaintext; memory holds ciphertext until expiry.',
      actionLabel: 'Open Password Generator',
      path: '/security-tools/random-password-generator'
    };
  }

  if (hasText && !hasPassword) {
    return {
      id: 'sc-need-password',
      title: 'Password required to encrypt',
      reason:
        'Generate a strong passphrase, paste it in Options, then Secure copy so the in-memory store is protected.',
      actionLabel: 'Open Password Generator',
      path: '/security-tools/random-password-generator'
    };
  }

  if (hasText && hasPassword && ttlSeconds > 0 && ttlSeconds < 15) {
    return {
      id: 'sc-short-ttl',
      title: 'Very short TTL selected',
      reason:
        'Under 15 seconds can expire before you paste. Raise TTL if you need more time, or use Private Notes for session-long storage.',
      actionLabel: 'Open Private Notes',
      path: '/security-tools/private-notes'
    };
  }

  if (isActive) {
    return {
      id: 'sc-active',
      title: 'Store is active',
      reason:
        'Paste soon, then Clear store when done. For notes that should last the whole tab session, try Private Notes.',
      actionLabel: 'Open Private Notes',
      path: '/security-tools/private-notes'
    };
  }

  if (hasStored) {
    return {
      id: 'sc-expired-view',
      title: 'Stored content is no longer active',
      reason: 'Clear store or Secure copy again with a fresh TTL.',
      actionLabel: 'Open Text Encrypt / Decrypt',
      path: '/security-tools/text-encrypt-decrypt'
    };
  }

  return {
    id: 'sc-ready',
    title: 'Ready to secure-copy',
    reason:
      'Secure copy writes plaintext to the system clipboard and keeps an encrypted backup in memory until TTL ends.',
    actionLabel: 'Open Strength Checker',
    path: '/security-tools/password-strength-checker'
  };
}
