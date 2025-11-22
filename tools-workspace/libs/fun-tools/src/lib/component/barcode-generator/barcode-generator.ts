import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';
import { Subscription } from 'rxjs';

type BarcodeFormat =
  | 'CODE128'
  | 'CODE39'
  | 'EAN13'
  | 'EAN8'
  | 'UPC'
  | 'ITF14'
  | 'MSI'
  | 'pharmacode'
  | 'codabar';

interface BarcodeOptions {
  text: string;
  format: BarcodeFormat;
  width: number;
  height: number;
  displayValue: boolean;
  fontSize: number;
  textAlign: 'left' | 'center' | 'right';
  textPosition: 'bottom' | 'top';
  textMargin: number;
  background: string;
  lineColor: string;
  margin: number;
}

type BarcodeFormGroup = FormGroup<{
  text: FormControl<string>;
  format: FormControl<BarcodeFormat>;
  width: FormControl<number>;
  height: FormControl<number>;
  displayValue: FormControl<boolean>;
  fontSize: FormControl<number>;
  textAlign: FormControl<'left' | 'center' | 'right'>;
  textPosition: FormControl<'bottom' | 'top'>;
  textMargin: FormControl<number>;
  background: FormControl<string>;
  lineColor: FormControl<string>;
  margin: FormControl<number>;
}>;

declare const JsBarcode: any;

@Component({
  selector: 'lib-barcode-generator',
  standalone: true,
  templateUrl: './barcode-generator.html',
  styleUrls: ['./barcode-generator.scss'],
  imports: [CommonModule, ReactiveFormsModule, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BarcodeGeneratorComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private formSubscription?: Subscription;

  readonly form: BarcodeFormGroup = this.fb.group({
    text: this.fb.control('123456789012', { nonNullable: true }),
    format: this.fb.control<BarcodeFormat>('CODE128', { nonNullable: true }),
    width: this.fb.control(2, { nonNullable: true }),
    height: this.fb.control(100, { nonNullable: true }),
    displayValue: this.fb.control(true, { nonNullable: true }),
    fontSize: this.fb.control(20, { nonNullable: true }),
    textAlign: this.fb.control<'left' | 'center' | 'right'>('center', { nonNullable: true }),
    textPosition: this.fb.control<'bottom' | 'top'>('bottom', { nonNullable: true }),
    textMargin: this.fb.control(2, { nonNullable: true }),
    background: this.fb.control('#ffffff', { nonNullable: true }),
    lineColor: this.fb.control('#000000', { nonNullable: true }),
    margin: this.fb.control(10, { nonNullable: true })
  });

  readonly errors = signal<string[]>([]);
  readonly barcodeDataUrl = signal<string | null>(null);
  readonly libraryLoaded = signal(false);

  readonly hasBarcode = computed(() => this.barcodeDataUrl() !== null);
  readonly canGenerate = computed(() => {
    const text = this.form.controls.text.value.trim();
    return text.length > 0 && this.libraryLoaded();
  });

  readonly formats: Array<{ value: BarcodeFormat; label: string; description: string }> = [
    { value: 'CODE128', label: 'CODE128', description: 'Most common, supports alphanumeric' },
    { value: 'CODE39', label: 'CODE39', description: 'Alphanumeric, widely used' },
    { value: 'EAN13', label: 'EAN13', description: '13 digits, used for products' },
    { value: 'EAN8', label: 'EAN8', description: '8 digits, compact version' },
    { value: 'UPC', label: 'UPC', description: '12 digits, North American standard' },
    { value: 'ITF14', label: 'ITF14', description: '14 digits, shipping containers' },
    { value: 'MSI', label: 'MSI', description: 'Numeric only, retail' },
    { value: 'pharmacode', label: 'Pharmacode', description: 'Pharmaceutical packaging' },
    { value: 'codabar', label: 'Codabar', description: 'Numeric with special chars' }
  ];

  constructor() {
    // Subscribe to form changes to regenerate barcode
    this.formSubscription = this.form.valueChanges.subscribe(() => {
      if (this.libraryLoaded()) {
        const values = this.form.getRawValue();
        if (values.text.trim().length > 0) {
          this.generateBarcode(values);
        }
      }
    });
  }

  async ngOnInit(): Promise<void> {
    await this.loadBarcodeLibrary();
  }

  private async loadBarcodeLibrary(): Promise<void> {
    if (typeof window === 'undefined') {
      return;
    }

    if ((window as any).JsBarcode) {
      this.libraryLoaded.set(true);
      this.generateBarcode(this.form.getRawValue());
      return;
    }

    try {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js';
      script.async = true;

      await new Promise<void>((resolve, reject) => {
        script.onload = () => {
          this.libraryLoaded.set(true);
          this.generateBarcode(this.form.getRawValue());
          resolve();
        };
        script.onerror = () => {
          this.errors.set(['Failed to load barcode library.']);
          reject(new Error('Failed to load barcode library'));
        };
        document.head.appendChild(script);
      });
    } catch (e) {
      this.errors.set([e instanceof Error ? e.message : 'Failed to load barcode library.']);
    }
  }

  private generateBarcode(options: BarcodeOptions): void {
    if (!this.libraryLoaded() || typeof JsBarcode === 'undefined') {
      return;
    }

    try {
      const canvas = document.createElement('canvas');
      const barcodeOptions: any = {
        format: options.format,
        width: options.width,
        height: options.height,
        displayValue: options.displayValue,
        fontSize: options.fontSize,
        textAlign: options.textAlign,
        textPosition: options.textPosition,
        textMargin: options.textMargin,
        background: options.background,
        lineColor: options.lineColor,
        margin: options.margin
      };

      JsBarcode(canvas, options.text.trim(), barcodeOptions);

      this.barcodeDataUrl.set(canvas.toDataURL('image/png'));
      this.errors.set([]);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Failed to generate barcode.';
      this.errors.set([errorMessage]);
      this.barcodeDataUrl.set(null);
    }
  }

  downloadBarcode(): void {
    const dataUrl = this.barcodeDataUrl();
    if (!dataUrl) {
      return;
    }

    try {
      const link = document.createElement('a');
      link.download = `barcode-${Date.now()}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      this.errors.set([e instanceof Error ? e.message : 'Failed to download barcode.']);
    }
  }

  copyBarcode(): void {
    const dataUrl = this.barcodeDataUrl();
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
        this.errors.set(['Failed to copy barcode to clipboard.']);
      });
  }

  formatSize(size: number): string {
    return `${size}px`;
  }

  ngOnDestroy(): void {
    this.formSubscription?.unsubscribe();
  }
}
