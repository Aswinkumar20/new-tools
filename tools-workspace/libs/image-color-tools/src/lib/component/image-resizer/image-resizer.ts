import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, WritableSignal, computed, inject, signal } from '@angular/core';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Navigation, TooltipDirective, AssetService } from '@tools-workspace/features-home';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

interface ResizePreset {
  label: string;
  description: string;
  width: number;
  height: number;
  lockAspect: boolean;
}

interface ResizeOptions {
  width: number;
  height: number;
  keepAspect: boolean;
  interpolation: 'pixelated' | 'smooth';
  background: string | null;
  format: 'image/png' | 'image/jpeg' | 'image/webp';
  quality: number;
}

interface ResizeResult {
  originalName: string | null;
  originalSize: number;
  originalDimensions: { width: number; height: number };
  resizedSize: number;
  resizedDimensions: { width: number; height: number };
  ratioChange: number;
  previewUrl: SafeUrl;
  downloadUrl: string;
  format: ResizeOptions['format'];
}

interface HistoryEntry {
  timestamp: number;
  name: string | null;
  originalDimensions: string;
  resizedDimensions: string;
  format: string;
  sizeDiff: string;
}

type ResizeFormGroup = FormGroup<{
  width: FormControl<number | null>;
  height: FormControl<number | null>;
  keepAspect: FormControl<boolean>;
  interpolation: FormControl<'pixelated' | 'smooth'>;
  background: FormControl<string | null>;
  format: FormControl<'image/png' | 'image/jpeg' | 'image/webp'>;
  quality: FormControl<number>;
  rememberHistory: FormControl<boolean>;
}>;

const PRESETS: ResizePreset[] = [
  { label: '1080p HD', description: '1920 × 1080', width: 1920, height: 1080, lockAspect: true },
  { label: 'Instagram Post', description: '1080 × 1080', width: 1080, height: 1080, lockAspect: true },
  { label: 'Instagram Story', description: '1080 × 1920', width: 1080, height: 1920, lockAspect: true },
  { label: 'Twitter Header', description: '1500 × 500', width: 1500, height: 500, lockAspect: true },
  { label: 'YouTube Thumbnail', description: '1280 × 720', width: 1280, height: 720, lockAspect: true },
  { label: 'Favicon', description: '64 × 64', width: 64, height: 64, lockAspect: false }
];

const MAX_DIMENSION = 8000;
const MAX_FILE_SIZE = 35 * 1024 * 1024;

@Component({
  selector: 'lib-image-resizer',
  standalone: true,
  templateUrl: './image-resizer.html',
  styleUrls: ['./image-resizer.scss'],
  imports: [CommonModule, ReactiveFormsModule, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ImageResizerComponent {
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly sanitizer = inject(DomSanitizer);
  readonly assetService = inject(AssetService);

  readonly form: ResizeFormGroup = this.fb.group({
    width: this.fb.control<number | null>(null, [Validators.min(1), Validators.max(MAX_DIMENSION)]),
    height: this.fb.control<number | null>(null, [Validators.min(1), Validators.max(MAX_DIMENSION)]),
    keepAspect: this.fb.control<boolean>(true, { nonNullable: true }),
    interpolation: this.fb.control<'pixelated' | 'smooth'>('smooth', { nonNullable: true }),
    background: this.fb.control<string | null>(null),
    format: this.fb.control<'image/png' | 'image/jpeg' | 'image/webp'>('image/png', { nonNullable: true }),
    quality: this.fb.control<number>(0.92, { nonNullable: true, validators: [Validators.min(0.1), Validators.max(1)] }),
    rememberHistory: this.fb.control<boolean>(true, { nonNullable: true })
  });

  readonly presets = PRESETS;
  readonly selectedFile = signal<File | null>(null);
  readonly originalImage = signal<HTMLImageElement | null>(null);
  readonly previewUrl = signal<SafeUrl | null>(null);
  readonly result: WritableSignal<ResizeResult | null> = signal(null);
  readonly errors = signal<string[]>([]);
  readonly warnings = signal<string[]>([]);
  readonly isProcessing = signal(false);
  readonly history = signal<HistoryEntry[]>([]);
  readonly dragActive = signal(false);

  readonly hasHistory = computed(() => this.history().length > 0);
  readonly canResize = computed(() => !!this.selectedFile() && !!this.originalImage());

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

  applyPreset(preset: ResizePreset): void {
    this.form.patchValue({
      width: preset.width,
      height: preset.height,
      keepAspect: preset.lockAspect
    });
    if (preset.lockAspect) {
      this.syncAspectRatio('width');
    }
  }

  async loadFile(file: File): Promise<void> {
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

  async resize(): Promise<void> {
    const file = this.selectedFile();
    const image = this.originalImage();
    if (!file || !image) {
      return;
    }
    const options = this.getOptions();
    if (!options.width || !options.height) {
      this.errors.set(['Please provide valid target width and height.']);
      return;
    }

    this.isProcessing.set(true);
    try {
      const canvas = await this.renderCanvas(image, options);
      const blob = await this.canvasToBlob(canvas, options.format, options.quality);
      if (!blob) {
        throw new Error('Unable to encode resized image.');
      }
      const downloadUrl = URL.createObjectURL(blob);
      const sanitizedPreview = this.sanitizer.bypassSecurityTrustUrl(downloadUrl);
      const resizedSize = blob.size;

      const result: ResizeResult = {
        originalName: file.name,
        originalSize: file.size,
        originalDimensions: { width: image.naturalWidth, height: image.naturalHeight },
        resizedSize,
        resizedDimensions: { width: options.width, height: options.height },
        ratioChange: resizedSize / file.size,
        previewUrl: sanitizedPreview,
        downloadUrl,
        format: options.format
      };

      this.result.set(result);
      if (this.form.controls.rememberHistory.value) {
        this.addToHistory(result);
      }
    } catch (error) {
      this.errors.set([`Resize failed: ${(error as Error)?.message ?? 'Unknown error'}`]);
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
    const name = current.originalName ? current.originalName.replace(/\.[^.]+$/, '') : 'resized-image';
    anchor.download = `${name}-${current.resizedDimensions.width}x${current.resizedDimensions.height}.${extension}`;
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
      width: null,
      height: null,
      keepAspect: true
    });
  }

  removeHistoryEntry(timestamp: number): void {
    this.history.update((entries) => entries.filter((entry) => entry.timestamp !== timestamp));
  }

  clearHistory(): void {
    this.history.set([]);
  }

  onDimensionInput(source: 'width' | 'height'): void {
    if (this.form.controls.keepAspect.value) {
      this.syncAspectRatio(source);
    }
  }

  private renderCanvas(image: HTMLImageElement, options: ResizeOptions): Promise<HTMLCanvasElement> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      canvas.width = options.width;
      canvas.height = options.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Unable to create rendering context.'));
        return;
      }

      ctx.imageSmoothingEnabled = options.interpolation === 'smooth';
      ctx.imageSmoothingQuality = options.interpolation === 'smooth' ? 'high' : 'low';

      if (options.background) {
        ctx.fillStyle = options.background;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas);
    });
  }

  private canvasToBlob(canvas: HTMLCanvasElement, format: ResizeOptions['format'], quality: number): Promise<Blob | null> {
    return new Promise((resolve) => {
      canvas.toBlob(resolve, format, quality);
    });
  }

  private initializeDimensions(image: HTMLImageElement): void {
    this.form.patchValue({
      width: image.naturalWidth,
      height: image.naturalHeight
    });
    this.warnings.set([
      `Original: ${image.naturalWidth} × ${image.naturalHeight}`,
      `Adjust width/height below or pick a preset.`
    ]);
  }

  private syncAspectRatio(source: 'width' | 'height'): void {
    const image = this.originalImage();
    if (!image || !this.form.controls.keepAspect.value) {
      return;
    }
    const widthControl = this.form.controls.width;
    const heightControl = this.form.controls.height;
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

  private getOptions(): ResizeOptions {
    const { width, height, keepAspect, interpolation, background, format, quality } = this.form.getRawValue();
    const safeWidth = Math.min(Math.max(width ?? 0, 1), MAX_DIMENSION);
    const safeHeight = Math.min(Math.max(height ?? 0, 1), MAX_DIMENSION);
    return {
      width: safeWidth,
      height: safeHeight,
      keepAspect: !!keepAspect,
      interpolation,
      background: background?.trim() ? background : null,
      format,
      quality
    };
  }

  private addToHistory(result: ResizeResult): void {
    const entry: HistoryEntry = {
      timestamp: Date.now(),
      name: result.originalName,
      originalDimensions: `${result.originalDimensions.width}×${result.originalDimensions.height}`,
      resizedDimensions: `${result.resizedDimensions.width}×${result.resizedDimensions.height}`,
      format: result.format,
      sizeDiff: `${this.formatBytes(result.originalSize)} → ${this.formatBytes(result.resizedSize)}`
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
