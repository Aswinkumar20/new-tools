import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, ViewChild, WritableSignal, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged } from 'rxjs';

type FaviconMode = 'text' | 'image' | 'emoji';
type FaviconSize = 16 | 32 | 48 | 64 | 96 | 128 | 180 | 192 | 512;

interface FaviconResult {
  dataUrl: string;
  size: FaviconSize;
  format: 'png' | 'ico';
  htmlCode: string;
}

interface HistoryEntry {
  timestamp: number;
  mode: FaviconMode;
  preview: string;
  size: FaviconSize;
}

type FaviconFormGroup = FormGroup<{
  mode: FormControl<FaviconMode>;
  text: FormControl<string>;
  fontSize: FormControl<number>;
  fontFamily: FormControl<string>;
  backgroundColor: FormControl<string>;
  textColor: FormControl<string>;
  emoji: FormControl<string>;
  size: FormControl<FaviconSize>;
  format: FormControl<'png' | 'ico'>;
  rememberHistory: FormControl<boolean>;
}>;

const FAVICON_SIZES: FaviconSize[] = [16, 32, 48, 64, 96, 128, 180, 192, 512];
const FONT_FAMILIES = [
  'Arial',
  'Helvetica',
  'Times New Roman',
  'Courier New',
  'Verdana',
  'Georgia',
  'Palatino',
  'Garamond',
  'Comic Sans MS',
  'Impact',
  'Trebuchet MS',
  'Lucida Console',
  'Monaco',
  'Menlo'
];

@Component({
  selector: 'lib-favicon-generator',
  standalone: true,
  templateUrl: './favicon-generator.html',
  styleUrls: ['./favicon-generator.scss'],
  imports: [CommonModule, ReactiveFormsModule, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FaviconGeneratorComponent {
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild('previewCanvas', { static: false }) previewCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('fileInput', { static: false }) fileInput!: ElementRef<HTMLInputElement>;

  readonly form: FaviconFormGroup = this.fb.group({
    mode: this.fb.control<FaviconMode>('text', { nonNullable: true }),
    text: this.fb.control('F', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(3)]
    }),
    fontSize: this.fb.control(80, {
      nonNullable: true,
      validators: [Validators.min(10), Validators.max(200)]
    }),
    fontFamily: this.fb.control('Arial', { nonNullable: true }),
    backgroundColor: this.fb.control('#007bff', {
      nonNullable: true,
      validators: [this.hexValidator.bind(this)]
    }),
    textColor: this.fb.control('#ffffff', {
      nonNullable: true,
      validators: [this.hexValidator.bind(this)]
    }),
    emoji: this.fb.control('⭐', { nonNullable: true }),
    size: this.fb.control<FaviconSize>(32, { nonNullable: true }),
    format: this.fb.control<'png' | 'ico'>('png', { nonNullable: true }),
    rememberHistory: this.fb.control(true, { nonNullable: true })
  });

  readonly sizes = FAVICON_SIZES;
  readonly fontFamilies = FONT_FAMILIES;
  readonly result: WritableSignal<FaviconResult | null> = signal(null);
  readonly errors = signal<string[]>([]);
  readonly history = signal<HistoryEntry[]>([]);
  readonly uploadedImage = signal<HTMLImageElement | null>(null);
  readonly isProcessing = signal(false);

  readonly hasHistory = computed(() => this.history().length > 0);
  readonly currentMode = computed(() => this.form.controls.mode.value);

  constructor() {
    this.form.valueChanges
      .pipe(debounceTime(200), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.generateFavicon();
      });

    // Initial generation
    setTimeout(() => this.generateFavicon(), 100);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.errors.set(['Please select a valid image file.']);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        this.uploadedImage.set(img);
        this.form.patchValue({ mode: 'image' });
        this.generateFavicon();
      };
      img.onerror = () => {
        this.errors.set(['Failed to load image.']);
      };
      img.src = e.target?.result as string;
    };
    reader.onerror = () => {
      this.errors.set(['Failed to read file.']);
    };
    reader.readAsDataURL(file);
  }

  generateFavicon(): void {
    this.errors.set([]);
    this.isProcessing.set(true);

    try {
      const canvas = this.previewCanvas?.nativeElement;
      if (!canvas) {
        setTimeout(() => this.generateFavicon(), 100);
        return;
      }

      const { mode, size, format, text, fontSize, fontFamily, backgroundColor, textColor, emoji } = this.form.getRawValue();
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        this.errors.set(['Canvas context not available.']);
        this.isProcessing.set(false);
        return;
      }

      // Set canvas size (actual pixel dimensions)
      canvas.width = size;
      canvas.height = size;
      
      // Set display size for better rendering
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;

      // Clear canvas
      ctx.clearRect(0, 0, size, size);

      // Fill background
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, size, size);

      if (mode === 'text') {
        this.drawTextFavicon(ctx, size, text, fontSize, fontFamily, textColor);
      } else if (mode === 'emoji') {
        this.drawEmojiFavicon(ctx, size, emoji, fontSize);
      } else if (mode === 'image') {
        const img = this.uploadedImage();
        if (img) {
          this.drawImageFavicon(ctx, size, img);
        } else {
          this.errors.set(['No image uploaded.']);
          this.isProcessing.set(false);
          return;
        }
      }

      const dataUrl = canvas.toDataURL('image/png');
      const htmlCode = this.generateHtmlCode(dataUrl, size);

      const result: FaviconResult = {
        dataUrl,
        size,
        format,
        htmlCode
      };

      this.result.set(result);

      if (this.form.controls.rememberHistory.value) {
        this.addToHistory(result, mode);
      }
    } catch (error) {
      this.errors.set([`Failed to generate favicon: ${(error as Error)?.message ?? 'Unknown error'}`]);
    } finally {
      this.isProcessing.set(false);
    }
  }

  private drawTextFavicon(
    ctx: CanvasRenderingContext2D,
    size: number,
    text: string,
    fontSize: number,
    fontFamily: string,
    textColor: string
  ): void {
    ctx.fillStyle = textColor;
    ctx.font = `bold ${fontSize}px ${fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, size / 2, size / 2);
  }

  private drawEmojiFavicon(ctx: CanvasRenderingContext2D, size: number, emoji: string, fontSize: number): void {
    ctx.font = `${fontSize}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, size / 2, size / 2);
  }

  private drawImageFavicon(ctx: CanvasRenderingContext2D, size: number, img: HTMLImageElement): void {
    // Calculate scaling to fit image while maintaining aspect ratio
    const scale = Math.min(size / img.width, size / img.height);
    const scaledWidth = img.width * scale;
    const scaledHeight = img.height * scale;
    const x = (size - scaledWidth) / 2;
    const y = (size - scaledHeight) / 2;

    ctx.drawImage(img, x, y, scaledWidth, scaledHeight);
  }

  private generateHtmlCode(dataUrl: string, size: FaviconSize): string {
    const sizes = size === 32 ? '32x32' : `${size}x${size}`;
    return `<link rel="icon" type="image/png" sizes="${sizes}" href="${dataUrl}">`;
  }

  downloadFavicon(): void {
    const current = this.result();
    if (!current) return;

    const canvas = this.previewCanvas?.nativeElement;
    if (!canvas) return;

    const { format, size } = current;

    if (format === 'png') {
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `favicon-${size}x${size}.png`;
        anchor.click();
        URL.revokeObjectURL(url);
      }, 'image/png');
    } else {
      // For ICO format, we'll create a simple ICO file
      // Note: Real ICO support would require a library, but we'll create a PNG with .ico extension
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `favicon-${size}x${size}.ico`;
        anchor.click();
        URL.revokeObjectURL(url);
      }, 'image/png');
    }
  }

  downloadAllSizes(): void {
    const originalSize = this.form.controls.size.value;
    const originalResult = this.result();

    FAVICON_SIZES.forEach((size) => {
      this.form.patchValue({ size }, { emitEvent: false });
      setTimeout(() => {
        this.generateFavicon();
        setTimeout(() => {
          const result = this.result();
          if (result) {
            const canvas = this.previewCanvas?.nativeElement;
            if (canvas) {
              canvas.toBlob((blob) => {
                if (!blob) return;
                const url = URL.createObjectURL(blob);
                const anchor = document.createElement('a');
                anchor.href = url;
                anchor.download = `favicon-${size}x${size}.png`;
                anchor.click();
                URL.revokeObjectURL(url);
              }, 'image/png');
            }
          }
        }, 100);
      }, size * 10);
    });

    // Restore original size
    setTimeout(() => {
      this.form.patchValue({ size: originalSize });
      if (originalResult) {
        this.result.set(originalResult);
      }
    }, FAVICON_SIZES.length * 100);
  }

  copyHtmlCode(): void {
    const current = this.result();
    if (!current) return;

    navigator.clipboard
      .writeText(current.htmlCode)
      .then(() => {
        // Success - could show toast
      })
      .catch(() => {
        this.errors.set(['Unable to copy HTML code to clipboard.']);
      });
  }

  copyToClipboard(value: string, label: string): void {
    navigator.clipboard
      .writeText(value)
      .then(() => {
        // Success
      })
      .catch(() => {
        this.errors.set([`Unable to copy ${label} to clipboard.`]);
      });
  }

  clear(): void {
    this.uploadedImage.set(null);
    this.result.set(null);
    this.errors.set([]);
    if (this.fileInput?.nativeElement) {
      this.fileInput.nativeElement.value = '';
    }
    this.form.patchValue({
      mode: 'text',
      text: 'F',
      fontSize: 80,
      fontFamily: 'Arial',
      backgroundColor: '#007bff',
      textColor: '#ffffff',
      emoji: '⭐',
      size: 32
    });
    setTimeout(() => this.generateFavicon(), 100);
  }

  clearHistory(): void {
    this.history.set([]);
  }

  removeHistoryEntry(timestamp: number): void {
    this.history.update((entries) => entries.filter((entry) => entry.timestamp !== timestamp));
  }

  applyHistory(entry: HistoryEntry): void {
    this.form.patchValue({ mode: entry.mode, size: entry.size });
    setTimeout(() => this.generateFavicon(), 100);
  }

  private addToHistory(result: FaviconResult, mode: FaviconMode): void {
    const entry: HistoryEntry = {
      timestamp: Date.now(),
      mode,
      preview: result.dataUrl,
      size: result.size
    };
    this.history.update((entries) => {
      const exists = entries.some((e) => e.preview === entry.preview && e.size === entry.size);
      if (exists) {
        return entries;
      }
      return [entry, ...entries].slice(0, 10);
    });
  }

  private hexValidator(control: AbstractControl): { [key: string]: any } | null {
    const value = (control.value as string)?.trim() || '';
    if (!value) {
      return null;
    }
    const cleaned = value.replace(/^#/, '');
    if ((cleaned.length === 3 || cleaned.length === 6) && /^[0-9A-Fa-f]+$/.test(cleaned)) {
      return null;
    }
    return { invalidHex: true };
  }
}
