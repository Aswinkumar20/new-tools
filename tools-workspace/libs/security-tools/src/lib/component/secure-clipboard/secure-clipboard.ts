import { ChangeDetectionStrategy, Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Navigation, TooltipDirective, AssetService } from '@tools-workspace/features-home';

interface ClipboardState {
  stored: string | null;
  expiresAt: number | null;
}

type SecureClipboardFormGroup = FormGroup<{
  text: FormControl<string>;
  password: FormControl<string>;
  ttlSeconds: FormControl<number>;
}>;

@Component({
  selector: 'lib-secure-clipboard',
  standalone: true,
  templateUrl: './secure-clipboard.html',
  styleUrls: ['./secure-clipboard.scss'],
  imports: [CommonModule, ReactiveFormsModule, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SecureClipboardComponent implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private intervalId: number | null = null;
  readonly assetService = inject(AssetService);

  readonly form: SecureClipboardFormGroup = this.fb.group({
    text: this.fb.control('', { nonNullable: true }),
    password: this.fb.control('', { nonNullable: true }),
    ttlSeconds: this.fb.control(60, { nonNullable: true })
  });

  readonly errors = signal<string[]>([]);
  readonly warnings = signal<string[]>([]);
  readonly state = signal<ClipboardState>({ stored: null, expiresAt: null });

  readonly hasStored = computed(() => this.state().stored !== null);
  readonly isExpired = computed(() => {
    const expiresAt = this.state().expiresAt;
    if (!expiresAt) return false;
    return Date.now() >= expiresAt;
  });
  readonly remainingSeconds = computed(() => {
    const expiresAt = this.state().expiresAt;
    if (!expiresAt) return 0;
    const diff = Math.max(0, expiresAt - Date.now());
    return Math.floor(diff / 1000);
  });

  readonly canStore = computed(() => {
    return !!this.form.controls.text.value.trim() && !!this.form.controls.password.value;
  });

  constructor() {
    this.startTimer();
  }

  ngOnDestroy(): void {
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
    }
  }

  statusLabel(): string {
    if (!this.hasStored()) return 'Empty';
    return this.isExpired() ? 'Expired' : 'Active';
  }

  async copyToSecureClipboard(): Promise<void> {
    this.errors.set([]);
    this.warnings.set([]);

    const { text, password, ttlSeconds } = this.form.getRawValue();

    if (!text.trim()) {
      this.errors.set(['Enter some text to copy to the secure clipboard.']);
      return;
    }
    if (!password) {
      this.errors.set(['Enter a password to encrypt the clipboard content.']);
      return;
    }
    if (ttlSeconds <= 0) {
      this.errors.set(['Time to live must be greater than 0 seconds.']);
      return;
    }

    try {
      const encrypted = await this.encrypt(text, password);
      const expiresAt = Date.now() + ttlSeconds * 1000;
      this.state.set({ stored: encrypted, expiresAt });

      await navigator.clipboard.writeText(text);
      this.warnings.set([
        'Text copied to system clipboard and encrypted in memory. It will clear when the timer ends.'
      ]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error while copying or encrypting.';
      this.errors.set([`Failed to use secure clipboard: ${msg}`]);
    }
  }

  clearClipboard(): void {
    this.state.set({ stored: null, expiresAt: null });
    this.errors.set([]);
    this.warnings.set([]);
  }

  clearText(): void {
    this.form.controls.text.setValue('');
  }

  copyText(): void {
    const text = this.form.controls.text.value;
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      alert('Text copied to clipboard!');
    });
  }

  formatExpiresAt(): string {
    const expiresAt = this.state().expiresAt;
    if (!expiresAt) return 'N/A';
    return new Date(expiresAt).toLocaleTimeString();
  }

  private startTimer(): void {
    this.intervalId = window.setInterval(() => {
      const current = this.state();
      if (current.expiresAt && Date.now() >= current.expiresAt) {
        this.state.set({ stored: null, expiresAt: null });
        this.warnings.set(['Secure clipboard content has expired and was cleared.']);
      }
    }, 1000);
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
}
