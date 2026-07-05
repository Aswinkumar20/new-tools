import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, WritableSignal, computed, inject, signal } from '@angular/core';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Navigation, TooltipDirective, AssetService } from '@tools-workspace/features-home';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

interface CompressionPreset {
  label: string;
  description: string;
  quality: number;
  format: 'image/jpeg' | 'image/webp';
}

interface CompressionOptions {
  quality: number;
  format: 'image/png' | 'image/jpeg' | 'image/webp';
  resizeWidth: number | null;
  resizeHeight: number | null;
  keepAspect: boolean;
  stripMetadata: boolean;
}

interface CompressionResult {
  originalName: string | null;
  originalSize: number;
  originalDimensions: { width: number; height: number };
  compressedSize: number;
  compressedDimensions: { width: number; height: number };
  reduction: number;
  previewUrl: SafeUrl;
  downloadUrl: string;
  format: CompressionOptions['format'];
}

interface HistoryEntry {
  timestamp: number;
  name: string | null;
  format: string;
  sizes: string;
  dimensions: string;
}

type CompressorFormGroup = FormGroup<{
  quality: FormControl<number>;
  format: FormControl<'image/png' | 'image/jpeg' | 'image/webp'>;
  resizeWidth: FormControl<number | null>;
  resizeHeight: FormControl<number | null>;
  keepAspect: FormControl<boolean>;
  stripMetadata: FormControl<boolean>;
  rememberHistory: FormControl<boolean>;
}>;

const PRESETS: CompressionPreset[] = [
  { label: 'High quality JPEG', description: 'Quality 0.85', quality: 0.85, format: 'image/jpeg' },
  { label: 'Balanced WebP', description: 'Quality 0.7', quality: 0.7, format: 'image/webp' },
  { label: 'Lightweight WebP', description: 'Quality 0.5', quality: 0.5, format: 'image/webp' }
];

const MAX_DIMENSION = 8000;
const MAX_FILE_SIZE = 45 * 1024 * 1024;

@Component({
  selector: 'lib-image-compressor',
  standalone: true,
  templateUrl: './image-compressor.html',
  styleUrls: ['./image-compressor.scss'],
  imports: [CommonModule, ReactiveFormsModule, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ImageCompressorComponent {
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly sanitizer = inject(DomSanitizer);
  readonly assetService = inject(AssetService);

  readonly form: CompressorFormGroup = this.fb.group({
    quality: this.fb.control<number>(0.8, { nonNullable: true, validators: [Validators.min(0.1), Validators.max(1)] }),
    format: this.fb.control<'image/png' | 'image/jpeg' | 'image/webp'>('image/jpeg', { nonNullable: true }),
    resizeWidth: this.fb.control<number | null>(null, [Validators.min(1), Validators.max(MAX_DIMENSION)]),
    resizeHeight: this.fb.control<number | null>(null, [Validators.min(1), Validators.max(MAX_DIMENSION)]),
    keepAspect: this.fb.control<boolean>(true, { nonNullable: true }),
    stripMetadata: this.fb.control<boolean>(true, { nonNullable: true }),
    rememberHistory: this.fb.control<boolean>(true, { nonNullable: true })
  });

  readonly presets = PRESETS;
  readonly selectedFile = signal<File | null>(null);
  readonly originalImage = signal<HTMLImageElement | null>(null);
  readonly previewUrl = signal<SafeUrl | null>(null);
  readonly result: WritableSignal<CompressionResult | null> = signal(null);
  readonly errors = signal<string[]>([]);
  readonly warnings = signal<string[]>([]);
  readonly history = signal<HistoryEntry[]>([]);
  readonly isProcessing = signal(false);
  readonly dragActive = signal(false);

  readonly hasHistory = computed(() => this.history().length > 0);
  readonly canCompress = computed(() => !!this.originalImage() && !!this.selectedFile());

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((value) => {
      if (value.keepAspect) {
        this.syncAspectRatio('width');
      }
    });
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragActive.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.dragActive.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragActive.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      this.loadFile(file);
    }
  }

  handleFileInput(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0] ?? null;
    if (file) {
      this.loadFile(file);
      input!.value = '';
    }
  }

  applyPreset(preset: CompressionPreset): void {
    this.form.patchValue({ quality: preset.quality, format: preset.format });
  }

  onDimensionInput(source: 'width' | 'height'): void {
    if (this.form.controls.keepAspect.value) {
      this.syncAspectRatio(source);
    }
  }

  private async loadFile(file: File): Promise<void> {
    this.errors.set([]);
    this.warnings.set([]);
    this.result.set(null);

    if (!file.type.startsWith('image/')) {
      this.errors.set(['Please upload a valid image file.']);
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      this.errors.set([
        `File size ${this.formatBytes(file.size)} exceeds the ${this.formatBytes(MAX_FILE_SIZE)} limit.`,
        'Compress or resize externally before importing.'
      ]);
      return;
    }

    this.selectedFile.set(file);

    const image = new Image();
    image.decoding = 'async';
    image.onload = () => {
      this.originalImage.set(image);
      this.previewUrl.set(this.sanitizer.bypassSecurityTrustUrl(image.src));
      this.initializeDimensions(image);
    };
    image.onerror = () => {
      this.errors.set(['Unable to load the selected image.']);
      this.selectedFile.set(null);
    };

    const reader = new FileReader();
    reader.onload = () => {
      image.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  async compress(): Promise<void> {
    const file = this.selectedFile();
    const image = this.originalImage();
    if (!file || !image) {
      return;
    }

    const options = this.getOptions(image);
    if (!options) {
      return;
    }

    this.isProcessing.set(true);
    try {
      const canvas = await this.renderCanvas(image, options);
      const blob = await this.canvasToBlob(canvas, options.format, options.quality);
      if (!blob) {
        throw new Error('Unable to encode compressed image.');
      }
      const downloadUrl = URL.createObjectURL(blob);
      const sanitizedPreview = this.sanitizer.bypassSecurityTrustUrl(downloadUrl);

      const result: CompressionResult = {
        originalName: file.name,
        originalSize: file.size,
        originalDimensions: { width: image.naturalWidth, height: image.naturalHeight },
        compressedSize: blob.size,
        compressedDimensions: { width: canvas.width, height: canvas.height },
        reduction: blob.size / file.size,
        previewUrl: sanitizedPreview,
        downloadUrl,
        format: options.format
      };

      this.result.set(result);
      if (this.form.controls.rememberHistory.value) {
        this.addToHistory(result);
      }
    } catch (error) {
      this.errors.set([`Compression failed: ${(error as Error)?.message ?? 'Unknown error'}`]);
      this.result.set(null);
    } finally {
      this.isProcessing.set(false);
    }
  }

  download(): void {
    const current = this.result();
    if (!current) {
      return;
    }
    const anchor = document.createElement('a');
    anchor.href = current.downloadUrl;
    let extension = 'png';
    if (current.format === 'image/jpeg') {
      extension = 'jpg';
    } else if (current.format === 'image/webp') {
      extension = 'webp';
    }
    const name = current.originalName ? current.originalName.replace(/\.[^.]+$/, '') : 'compressed-image';
    anchor.download = `${name}.${extension}`;
    anchor.click();
  }

  clear(): void {
    this.selectedFile.set(null);
    this.originalImage.set(null);
    this.previewUrl.set(null);
    this.result.set(null);
    this.errors.set([]);
    this.warnings.set([]);
    this.form.patchValue({
      resizeWidth: null,
      resizeHeight: null,
      keepAspect: true
    });
  }

  removeHistoryEntry(timestamp: number): void {
    this.history.update((entries) => entries.filter((entry) => entry.timestamp !== timestamp));
  }

  clearHistory(): void {
    this.history.set([]);
  }

  private renderCanvas(image: HTMLImageElement, options: CompressionOptions): Promise<HTMLCanvasElement> {
    return new Promise((resolve, reject) => {
      const targetWidth = options.resizeWidth ?? image.naturalWidth;
      const targetHeight = options.resizeHeight ?? image.naturalHeight;
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Unable to create rendering context.'));
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      ctx.drawImage(image, 0, 0, targetWidth, targetHeight);
      resolve(canvas);
    });
  }

  private canvasToBlob(canvas: HTMLCanvasElement, format: CompressionOptions['format'], quality: number): Promise<Blob | null> {
    return new Promise((resolve) => {
      canvas.toBlob(resolve, format, quality);
    });
  }

  private initializeDimensions(image: HTMLImageElement): void {
    this.form.patchValue({
      resizeWidth: image.naturalWidth,
      resizeHeight: image.naturalHeight
    });
    this.warnings.set([
      `Original: ${image.naturalWidth} × ${image.naturalHeight}`,
      `Adjust size or quality, or apply presets below.`
    ]);
  }

  private syncAspectRatio(source: 'width' | 'height'): void {
    const image = this.originalImage();
    if (!image || !this.form.controls.keepAspect.value) {
      return;
    }
    const widthControl = this.form.controls.resizeWidth;
    const heightControl = this.form.controls.resizeHeight;
    const originalAspect = image.naturalWidth / image.naturalHeight;
    if (source === 'width') {
      const width = widthControl.value;
      if (width) {
        const nextHeight = Math.round(width / originalAspect);
        heightControl.setValue(nextHeight, { emitEvent: false });
      }
    } else {
      const height = heightControl.value;
      if (height) {
        const nextWidth = Math.round(height * originalAspect);
        widthControl.setValue(nextWidth, { emitEvent: false });
      }
    }
  }

  private getOptions(image: HTMLImageElement): CompressionOptions | null {
    const { quality, format, resizeWidth, resizeHeight, keepAspect, stripMetadata } = this.form.getRawValue();
    if (quality <= 0 || quality > 1) {
      this.errors.set(['Quality must be between 0.1 and 1.']);
      return null;
    }

    const targetWidth = resizeWidth ?? image.naturalWidth;
    const targetHeight = resizeHeight ?? image.naturalHeight;
    if (targetWidth <= 0 || targetHeight <= 0) {
      this.errors.set(['Please provide valid resize dimensions.']);
      return null;
    }

    return {
      quality,
      format,
      resizeWidth: targetWidth,
      resizeHeight: targetHeight,
      keepAspect,
      stripMetadata
    };
  }

  private addToHistory(result: CompressionResult): void {
    const entry: HistoryEntry = {
      timestamp: Date.now(),
      name: result.originalName,
      format: result.format,
      sizes: `${this.formatBytes(result.originalSize)} → ${this.formatBytes(result.compressedSize)}`,
      dimensions: `${result.originalDimensions.width}×${result.originalDimensions.height} → ${result.compressedDimensions.width}×${result.compressedDimensions.height}`
    };
    this.history.update((entries) => [entry, ...entries].slice(0, 10));
  }

  formatBytes(value: number): string {
    if (value === 0) {
      return '0 B';
    }
    const units = ['B', 'KB', 'MB', 'GB'];
    const exponent = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
    const scaled = value / Math.pow(1024, exponent);
    return `${scaled.toFixed(scaled >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
  }
}
