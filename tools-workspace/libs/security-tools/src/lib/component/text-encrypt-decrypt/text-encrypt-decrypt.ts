import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

type Mode = 'encrypt' | 'decrypt';

interface TextCryptoState {
  output: string;
  lastAction: Mode | null;
}

type TextEncryptDecryptFormGroup = FormGroup<{
  mode: FormControl<Mode>;
  plaintext: FormControl<string>;
  ciphertext: FormControl<string>;
  password: FormControl<string>;
}>;

@Component({
  selector: 'lib-text-encrypt-decrypt',
  standalone: true,
  templateUrl: './text-encrypt-decrypt.html',
  styleUrls: ['./text-encrypt-decrypt.scss'],
  imports: [CommonModule, ReactiveFormsModule, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TextEncryptDecryptComponent {
  private readonly fb = inject(FormBuilder);

  readonly form: TextEncryptDecryptFormGroup = this.fb.group({
    mode: this.fb.control<Mode>('encrypt', { nonNullable: true }),
    plaintext: this.fb.control('', { nonNullable: true }),
    ciphertext: this.fb.control('', { nonNullable: true }),
    password: this.fb.control('', { nonNullable: true })
  });

  readonly errors = signal<string[]>([]);
  readonly warnings = signal<string[]>([]);
  readonly state = signal<TextCryptoState>({ output: '', lastAction: null });

  readonly hasOutput = computed(() => !!this.state().output);
  readonly isEncryptMode = computed(() => this.form.controls.mode.value === 'encrypt');

  async run(): Promise<void> {
    this.errors.set([]);
    this.warnings.set([]);

    const { mode, plaintext, ciphertext, password } = this.form.getRawValue();

    if (!password) {
      this.errors.set(['Enter a password for encryption/decryption.']);
      return;
    }

    try {
      if (mode === 'encrypt') {
        if (!plaintext.trim()) {
          this.errors.set(['Enter plaintext to encrypt.']);
          return;
        }
        const encrypted = await this.encrypt(plaintext, password);
        this.form.controls.ciphertext.setValue(encrypted);
        this.state.set({ output: encrypted, lastAction: 'encrypt' });
      } else {
        if (!ciphertext.trim()) {
          this.errors.set(['Enter ciphertext to decrypt.']);
          return;
        }
        const decrypted = await this.decrypt(ciphertext, password);
        this.form.controls.plaintext.setValue(decrypted);
        this.state.set({ output: decrypted, lastAction: 'decrypt' });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error during encryption/decryption.';
      this.errors.set([`Operation failed: ${msg}`]);
    }
  }

  swapMode(): void {
    const current = this.form.controls.mode.value;
    const next: Mode = current === 'encrypt' ? 'decrypt' : 'encrypt';
    this.form.controls.mode.setValue(next);
  }

  clearAll(): void {
    this.form.controls.plaintext.setValue('');
    this.form.controls.ciphertext.setValue('');
    this.form.controls.password.setValue('');
    this.state.set({ output: '', lastAction: null });
    this.errors.set([]);
    this.warnings.set([]);
  }

  copyOutput(): void {
    const output = this.state().output;
    if (!output) return;
    navigator.clipboard.writeText(output).catch(() => {
      this.errors.set(['Failed to copy output to clipboard.']);
    });
  }

  private async encrypt(plainText: string, password: string): Promise<string> {
    const enc = new TextEncoder();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), { name: 'PBKDF2' }, false, [
      'deriveKey'
    ]);

    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );

    const cipherBuffer = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv
      },
      key,
      enc.encode(plainText)
    );

    const combined = new Uint8Array(salt.length + iv.length + cipherBuffer.byteLength);
    combined.set(salt, 0);
    combined.set(iv, salt.length);
    combined.set(new Uint8Array(cipherBuffer), salt.length + iv.length);

    return btoa(String.fromCharCode(...combined));
  }

  private async decrypt(cipherBase64: string, password: string): Promise<string> {
    const data = Uint8Array.from(atob(cipherBase64), (c) => c.charCodeAt(0));
    const salt = data.slice(0, 16);
    const iv = data.slice(16, 28);
    const cipherBytes = data.slice(28);

    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), { name: 'PBKDF2' }, false, [
      'deriveKey'
    ]);

    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );

    const plainBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv
      },
      key,
      cipherBytes
    );

    const dec = new TextDecoder();
    return dec.decode(plainBuffer);
  }
}
