import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Navigation, TooltipDirective, AssetService } from '@tools-workspace/features-home';

type HashAlgorithm = 'md5' | 'sha1' | 'sha256' | 'sha384' | 'sha512';

interface HashResult {
  algorithm: HashAlgorithm;
  hex: string;
  base64: string;
  lengthBits: number;
}

type HashGeneratorFormGroup = FormGroup<{
  input: FormControl<string>;
  algorithm: FormControl<HashAlgorithm>;
  uppercase: FormControl<boolean>;
  outputFormat: FormControl<'hex' | 'base64' | 'both'>;
}>;

@Component({
  selector: 'lib-hash-generator',
  standalone: true,
  templateUrl: './hash-generator.html',
  styleUrls: ['./hash-generator.scss'],
  imports: [CommonModule, ReactiveFormsModule, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HashGeneratorComponent {
  private readonly fb = inject(FormBuilder);
  readonly assetService = inject(AssetService);

  readonly form: HashGeneratorFormGroup = this.fb.group({
    input: this.fb.control('', { nonNullable: true }),
    algorithm: this.fb.control<HashAlgorithm>('sha256', { nonNullable: true }),
    uppercase: this.fb.control(false, { nonNullable: true }),
    outputFormat: this.fb.control<'hex' | 'base64' | 'both'>('hex', { nonNullable: true })
  });

  readonly errors = signal<string[]>([]);
  readonly result = signal<HashResult | null>(null);
  readonly hasResult = computed(() => this.result() !== null);
  readonly hasInput = computed(() => !!this.form.controls.input.value.trim());

  readonly displayHex = computed(() => {
    const res = this.result();
    if (!res) return '';
    const hex = res.hex;
    return this.form.controls.uppercase.value ? hex.toUpperCase() : hex.toLowerCase();
  });

  async generate(): Promise<void> {
    this.errors.set([]);
    this.result.set(null);

    const { input, algorithm } = this.form.getRawValue();
    const value = input ?? '';

    if (!value) {
      this.errors.set(['Enter some text to hash.']);
      return;
    }

    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(value);

      let hashBuffer: ArrayBuffer;
      switch (algorithm) {
        case 'md5':
        case 'sha1':
          this.errors.set([
            'MD5 and SHA-1 are not available via Web Crypto in this demo. Please use SHA-256, SHA-384, or SHA-512.'
          ]);
          return;
        case 'sha256':
          hashBuffer = await crypto.subtle.digest('SHA-256', data);
          break;
        case 'sha384':
          hashBuffer = await crypto.subtle.digest('SHA-384', data);
          break;
        case 'sha512':
          hashBuffer = await crypto.subtle.digest('SHA-512', data);
          break;
      }

      const bytes = new Uint8Array(hashBuffer);
      const hex = Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      const base64 = btoa(String.fromCodePoint(...bytes));

      const lengthBits = bytes.length * 8;

      this.result.set({
        algorithm,
        hex,
        base64,
        lengthBits
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error while hashing.';
      this.errors.set([`Failed to generate hash: ${msg}`]);
    }
  }

  clear(): void {
    this.form.controls.input.setValue('');
    this.result.set(null);
    this.errors.set([]);
  }

  copyInput(): void {
    this.copyText(this.form.controls.input.value, 'Input');
  }

  copyOutput(): void {
    const r = this.result();
    if (!r) return;
    const format = this.form.controls.outputFormat.value;
    if (format === 'hex') {
      this.copyText(this.displayHex(), 'Hex hash');
    } else if (format === 'base64') {
      this.copyText(r.base64, 'Base64 hash');
    } else {
      this.copyText(`Hex:\n${this.displayHex()}\n\nBase64:\n${r.base64}`, 'Hash output');
    }
  }

  copyHex(): void {
    this.copyText(this.displayHex(), 'Hex hash');
  }

  copyBase64(): void {
    const r = this.result();
    if (r) this.copyText(r.base64, 'Base64 hash');
  }

  private copyText(text: string, label: string): void {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      alert(`${label} copied to clipboard!`);
    });
  }
}
