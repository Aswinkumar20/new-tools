import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Navigation, TooltipDirective, AssetService } from '@tools-workspace/features-home';

interface QRCodeOptions {
  text: string;
  size: number;
  errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H';
  darkColor: string;
  lightColor: string;
  margin: number;
}

type QRCodeFormGroup = FormGroup<{
  text: FormControl<string>;
  size: FormControl<number>;
  errorCorrectionLevel: FormControl<'L' | 'M' | 'Q' | 'H'>;
  darkColor: FormControl<string>;
  lightColor: FormControl<string>;
  margin: FormControl<number>;
}>;

declare const QRCode: any;

@Component({
  selector: 'lib-qr-code-generator',
  standalone: true,
  templateUrl: './qr-code-generator.html',
  styleUrls: ['./qr-code-generator.scss'],
  imports: [CommonModule, ReactiveFormsModule, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class QrCodeGeneratorComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  readonly assetService = inject(AssetService);
  private formSubscription?: Subscription;

  readonly form: QRCodeFormGroup = this.fb.group({
    text: this.fb.control('https://example.com', { nonNullable: true }),
    size: this.fb.control(256, { nonNullable: true }),
    errorCorrectionLevel: this.fb.control<'L' | 'M' | 'Q' | 'H'>('M', { nonNullable: true }),
    darkColor: this.fb.control('#000000', { nonNullable: true }),
    lightColor: this.fb.control('#ffffff', { nonNullable: true }),
    margin: this.fb.control(4, { nonNullable: true })
  });

  readonly errors = signal<string[]>([]);
  readonly qrCodeDataUrl = signal<string | null>(null);
  readonly libraryLoaded = signal(false);

  readonly hasQRCode = computed(() => this.qrCodeDataUrl() !== null);
  readonly canGenerate = computed(() => {
    const text = this.form.controls.text.value.trim();
    return text.length > 0 && this.libraryLoaded();
  });

  constructor() {
    // Subscribe to form changes to regenerate QR code
    this.formSubscription = this.form.valueChanges.subscribe(() => {
      if (this.libraryLoaded()) {
        const values = this.form.getRawValue();
        if (values.text.trim().length > 0) {
          this.generateQRCode(values);
        }
      }
    });
  }

  async ngOnInit(): Promise<void> {
    await this.loadQRCodeLibrary();
  }

  private async loadQRCodeLibrary(): Promise<void> {
    if (typeof window === 'undefined') {
      return;
    }

    if ((window as any).QRCode) {
      this.libraryLoaded.set(true);
      this.generateQRCode(this.form.getRawValue());
      return;
    }

    try {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js';
      script.async = true;

      await new Promise<void>((resolve, reject) => {
        script.onload = () => {
          this.libraryLoaded.set(true);
          this.generateQRCode(this.form.getRawValue());
          resolve();
        };
        script.onerror = () => {
          this.errors.set(['Failed to load QR code library.']);
          reject(new Error('Failed to load QR code library'));
        };
        document.head.appendChild(script);
      });
    } catch (e) {
      this.errors.set([e instanceof Error ? e.message : 'Failed to load QR code library.']);
    }
  }

  private generateQRCode(options: QRCodeOptions): void {
    if (!this.libraryLoaded() || typeof QRCode === 'undefined') {
      return;
    }

    try {
      const canvas = document.createElement('canvas');
      const qrOptions = {
        width: options.size,
        margin: options.margin,
        color: {
          dark: options.darkColor,
          light: options.lightColor
        },
        errorCorrectionLevel: options.errorCorrectionLevel
      };

      QRCode.toCanvas(
        canvas,
        options.text,
        qrOptions,
        (error: Error | null) => {
          if (error) {
            this.errors.set([error.message || 'Failed to generate QR code.']);
            this.qrCodeDataUrl.set(null);
            return;
          }

          this.qrCodeDataUrl.set(canvas.toDataURL('image/png'));
          this.errors.set([]);
        }
      );
    } catch (e) {
      this.errors.set([e instanceof Error ? e.message : 'Failed to generate QR code.']);
      this.qrCodeDataUrl.set(null);
    }
  }

  downloadQRCode(): void {
    const dataUrl = this.qrCodeDataUrl();
    if (!dataUrl) {
      return;
    }

    try {
      const link = document.createElement('a');
      link.download = `qrcode-${Date.now()}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      this.errors.set([e instanceof Error ? e.message : 'Failed to download QR code.']);
    }
  }

  copyContent(): void {
    this.copyText(this.form.controls.text.value.trim(), 'QR content');
  }

  private copyText(text: string, label: string): void {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      alert(`${label} copied to clipboard!`);
    });
  }

  copyQRCode(): void {
    const dataUrl = this.qrCodeDataUrl();
    if (!dataUrl) {
      return;
    }

    fetch(dataUrl)
      .then((res) => res.blob())
      .then((blob) => navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]))
      .then(() => {
        // Success - could show a toast notification
      })
      .catch(() => {
        this.errors.set(['Failed to copy QR code to clipboard.']);
      });
  }

  formatSize(size: number): string {
    return `${size}px`;
  }

  ngOnDestroy(): void {
    this.formSubscription?.unsubscribe();
  }
}
