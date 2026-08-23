import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

interface NoteState {
  encrypted: string | null;
  lastSavedAt: number | null;
}

type PrivateNotesFormGroup = FormGroup<{
  note: FormControl<string>;
  password: FormControl<string>;
  showNote: FormControl<boolean>;
}>;

@Component({
  selector: 'lib-private-notes',
  standalone: true,
  templateUrl: './private-notes.html',
  styleUrls: ['./private-notes.scss'],
  imports: [CommonModule, ReactiveFormsModule, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PrivateNotesComponent {
  private readonly fb = inject(FormBuilder);

  readonly form: PrivateNotesFormGroup = this.fb.group({
    note: this.fb.control('', { nonNullable: true }),
    password: this.fb.control('', { nonNullable: true }),
    showNote: this.fb.control(false, { nonNullable: true })
  });

  readonly errors = signal<string[]>([]);
  readonly warnings = signal<string[]>([]);
  readonly state = signal<NoteState>({ encrypted: null, lastSavedAt: null });

  readonly hasEncrypted = computed(() => !!this.state().encrypted);
  readonly isLocked = computed(() => !!this.state().encrypted && !this.form.controls.note.value);

  async encryptAndSave(): Promise<void> {
    this.errors.set([]);
    this.warnings.set([]);

    const { note, password } = this.form.getRawValue();

    if (!note.trim()) {
      this.errors.set(['Enter some note content to encrypt.']);
      return;
    }
    if (!password) {
      this.errors.set(['Enter a password to encrypt your notes.']);
      return;
    }

    try {
      const encrypted = await this.encrypt(note, password);
      const newState: NoteState = {
        encrypted,
        lastSavedAt: Date.now()
      };
      this.state.set(newState);
      this.form.controls.note.setValue('');
      this.warnings.set(['Note encrypted and stored in memory for this session. It is not sent to a server.']);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error during encryption.';
      this.errors.set([`Failed to encrypt note: ${msg}`]);
    }
  }

  async decrypt(): Promise<void> {
    this.errors.set([]);
    this.warnings.set([]);

    const encrypted = this.state().encrypted;
    const password = this.form.controls.password.value;

    if (!encrypted) {
      this.errors.set(['There is no encrypted note to decrypt.']);
      return;
    }
    if (!password) {
      this.errors.set(['Enter the password used to encrypt this note.']);
      return;
    }

    try {
      const note = await this.decryptText(encrypted, password);
      this.form.controls.note.setValue(note);
      this.form.controls.showNote.setValue(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error during decryption.';
      this.errors.set([`Failed to decrypt note: ${msg}`]);
    }
  }

  clear(): void {
    this.form.controls.note.setValue('');
    this.errors.set([]);
    this.warnings.set([]);
  }

  clearAll(): void {
    this.form.controls.note.setValue('');
    this.form.controls.password.setValue('');
    this.form.controls.showNote.setValue(false);
    this.state.set({ encrypted: null, lastSavedAt: null });
    this.errors.set([]);
    this.warnings.set([]);
  }

  formatTimestamp(timestamp: number | null): string {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    return date.toLocaleString();
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

  private async decryptText(cipherBase64: string, password: string): Promise<string> {
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
