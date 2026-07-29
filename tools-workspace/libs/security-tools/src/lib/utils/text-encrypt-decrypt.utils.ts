import type { StToolSuggestion } from '../shared/st-tool-suggestion.model';
import type {
  TextCryptoMode,
  TextEncryptDecryptFormValues,
  TextEncryptDecryptSuggestionContext
} from '../types/text-encrypt-decrypt.types';

export function validateTextCryptoOperation(
  values: Pick<TextEncryptDecryptFormValues, 'mode' | 'plaintext' | 'ciphertext' | 'password'>
): string[] {
  const { mode, plaintext, ciphertext, password } = values;

  if (!password) {
    return ['Enter a password for encryption/decryption.'];
  }

  if (mode === 'encrypt' && !plaintext.trim()) {
    return ['Enter plaintext to encrypt.'];
  }

  if (mode === 'decrypt' && !ciphertext.trim()) {
    return ['Enter ciphertext to decrypt.'];
  }

  return [];
}

export function mapTextCryptoError(error: unknown): string {
  const msg =
    error instanceof Error ? error.message : 'Unknown error during encryption/decryption.';
  return `Operation failed: ${msg}`;
}

export function resolveTextCryptoInputLength(
  mode: TextCryptoMode,
  plaintext: string,
  ciphertext: string
): number {
  return mode === 'encrypt' ? plaintext.length : ciphertext.length;
}

export function canRunTextCrypto(
  mode: TextCryptoMode,
  plaintext: string,
  ciphertext: string,
  password: string
): boolean {
  if (!password) {
    return false;
  }
  return mode === 'encrypt' ? !!plaintext.trim() : !!ciphertext.trim();
}

export function toggleTextCryptoMode(mode: TextCryptoMode): TextCryptoMode {
  return mode === 'encrypt' ? 'decrypt' : 'encrypt';
}

export function resolveTextEncryptDecryptSuggestion(
  context: TextEncryptDecryptSuggestionContext
): StToolSuggestion | null {
  const {
    mode,
    hasPassword,
    hasPlaintext,
    hasCiphertext,
    hasOutput,
    lastAction,
    errorMessage
  } = context;

  if (errorMessage?.includes('Operation failed')) {
    return {
      id: 'ted-failed',
      title: mode === 'decrypt' ? 'Decryption did not succeed' : 'Encryption did not succeed',
      reason:
        mode === 'decrypt'
          ? 'Wrong password or ciphertext not produced by this tool are the usual causes. Confirm the base64 blob and passphrase, then retry.'
          : 'Check browser Web Crypto support and try again with a shorter payload if the text is very large.',
      actionLabel: 'Open Private Notes',
      path: '/security-tools/private-notes'
    };
  }

  if (!hasPassword && !hasPlaintext && !hasCiphertext && !hasOutput) {
    return {
      id: 'ted-get-started',
      title: 'Encrypt text locally?',
      reason:
        'Set a strong password in Options, enter plaintext, then Encrypt. Output is base64 (salt + IV + ciphertext).',
      actionLabel: 'Open Password Generator',
      path: '/security-tools/random-password-generator'
    };
  }

  if ((mode === 'encrypt' && hasPlaintext && !hasPassword) || (mode === 'decrypt' && hasCiphertext && !hasPassword)) {
    return {
      id: 'ted-need-password',
      title: 'Password required',
      reason:
        'AES-GCM needs a passphrase. Generate one, paste it in Options, then run Encrypt or Decrypt.',
      actionLabel: 'Open Password Generator',
      path: '/security-tools/random-password-generator'
    };
  }

  if (mode === 'encrypt' && hasPlaintext && hasPassword && !hasOutput) {
    return {
      id: 'ted-ready-encrypt',
      title: 'Ready to encrypt',
      reason:
        'Click Encrypt to produce a shareable base64 blob. Verify passphrase strength first if this protects anything important.',
      actionLabel: 'Open Strength Checker',
      path: '/security-tools/password-strength-checker'
    };
  }

  if (mode === 'decrypt' && hasCiphertext && hasPassword && !hasOutput) {
    return {
      id: 'ted-ready-decrypt',
      title: 'Ready to decrypt',
      reason:
        'Paste ciphertext from this tool’s encrypt mode, enter the same password, then Decrypt.',
      actionLabel: 'Open Secure Clipboard',
      path: '/security-tools/secure-clipboard'
    };
  }

  if (hasOutput && lastAction === 'encrypt') {
    return {
      id: 'ted-after-encrypt',
      title: 'Ciphertext ready',
      reason:
        'Copy the output to share or store it. For a short-lived paste buffer of the plaintext, use Secure Clipboard.',
      actionLabel: 'Open Secure Clipboard',
      path: '/security-tools/secure-clipboard'
    };
  }

  if (hasOutput && lastAction === 'decrypt') {
    return {
      id: 'ted-after-decrypt',
      title: 'Plaintext restored',
      reason:
        'Copy carefully. Secure Clipboard can hold sensitive text with an auto-expiring encrypted memory store.',
      actionLabel: 'Open Secure Clipboard',
      path: '/security-tools/secure-clipboard'
    };
  }

  if (mode === 'decrypt' && !hasCiphertext) {
    return {
      id: 'ted-switch-encrypt',
      title: 'Need ciphertext first?',
      reason:
        'Switch to Encrypt, produce a blob with this tool, then come back to Decrypt with the same password.',
      actionLabel: 'Open Hash Generator',
      path: '/security-tools/hash-generator'
    };
  }

  return {
    id: 'ted-hash-alt',
    title: 'Need a one-way digest instead?',
    reason:
      'Hash Generator produces irreversible digests when you do not need to recover the original text.',
    actionLabel: 'Open Hash Generator',
    path: '/security-tools/hash-generator'
  };
}
