import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import {
  AssetService,
  Navigation,
  ToastService,
  TooltipDirective
} from '@tools-workspace/features-home';
import {
  IMAGE_COMPRESSOR_DEFAULT_QUALITY,
  IMAGE_COMPRESSOR_ERROR,
  IMAGE_COMPRESSOR_MAX_DIMENSION,
  IMAGE_COMPRESSOR_MAX_FILE_SIZE,
  IMAGE_COMPRESSOR_PRESETS,
  IMAGE_COMPRESSOR_RELATED_TOOLS
} from '../../constants/image-compressor.constants';
import { ictFormatBytes } from '../../shared/ict-format.util';
import type { IctRelatedToolLink } from '../../shared/ict-tool-suggestion.model';
import type {
  ImageCompressionPreset,
  ImageCompressionResult,
  ImageCompressorFormGroup,
  ImageCompressorFormat,
  ImageCompressorHistoryEntry
} from '../../types/image-compressor.types';
import {
  buildCompressedFilename,
  buildImageCompressorOptions,
  canvasToCompressorBlob,
  createImageCompressorHistoryEntry,
  prependImageCompressorHistory,
  renderCompressorCanvas,
  resolveImageCompressorSuggestion,
  syncImageCompressorAspect,
  validateImageCompressorFile
} from '../../utils/image-compressor.utils';

@Component({
  selector: 'lib-image-compressor',
  standalone: true,
  templateUrl: './image-compressor.html',
  styleUrls: ['./image-compressor.scss'],
  imports: [CommonModule, ReactiveFormsModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ImageCompressorComponent {
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly toast = inject(ToastService);
  readonly assetService = inject(AssetService);

  readonly form: ImageCompressorFormGroup = this.fb.group({
    quality: this.fb.control<number>(IMAGE_COMPRESSOR_DEFAULT_QUALITY, {
      nonNullable: true,
      validators: [Validators.min(0.1), Validators.max(1)]
    }),
    format: this.fb.control<ImageCompressorFormat>('image/jpeg', { nonNullable: true }),
    resizeWidth: this.fb.control<number | null>(null, [
      Validators.min(1),
      Validators.max(IMAGE_COMPRESSOR_MAX_DIMENSION)
    ]),
    resizeHeight: this.fb.control<number | null>(null, [
      Validators.min(1),
      Validators.max(IMAGE_COMPRESSOR_MAX_DIMENSION)
    ]),
    keepAspect: this.fb.control<boolean>(true, { nonNullable: true }),
    stripMetadata: this.fb.control<boolean>(true, { nonNullable: true }),
    rememberHistory: this.fb.control<boolean>(true, { nonNullable: true })
  });

  readonly presets = IMAGE_COMPRESSOR_PRESETS;
  readonly relatedTools: ReadonlyArray<IctRelatedToolLink> = IMAGE_COMPRESSOR_RELATED_TOOLS;
  readonly maxFileSize = IMAGE_COMPRESSOR_MAX_FILE_SIZE;

  readonly selectedFile = signal<File | null>(null);
  readonly originalImage = signal<HTMLImageElement | null>(null);
  readonly previewUrl = signal<SafeUrl | null>(null);
  readonly result = signal<ImageCompressionResult | null>(null);
  readonly errors = signal<string[]>([]);
  readonly warnings = signal<string[]>([]);
  readonly history = signal<ImageCompressorHistoryEntry[]>([]);
  readonly isProcessing = signal(false);
  readonly dragActive = signal(false);
  private readonly dismissedSuggestionId = signal<string | null>(null);
  private readonly lastErrorWasOversized = signal(false);

  readonly hasHistory = computed(() => this.history().length > 0);
  readonly canCompress = computed(() => !!this.originalImage() && !!this.selectedFile());

  readonly primarySuggestion = computed(() => {
    const current = this.result();
    const suggestion = resolveImageCompressorSuggestion({
      hasFile: !!this.selectedFile(),
      hasResult: current !== null,
      hasError: this.errors().length > 0,
      reduction: current?.reduction ?? null,
      format: current?.format ?? null,
      isOversizedHint: this.lastErrorWasOversized()
    });
    if (!suggestion || this.dismissedSuggestionId() === suggestion.id) {
      return null;
    }
    return suggestion;
  });

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

  applyPreset(preset: ImageCompressionPreset): void {
    this.form.patchValue({ quality: preset.quality, format: preset.format });
  }

  onDimensionInput(source: 'width' | 'height'): void {
    if (this.form.controls.keepAspect.value) {
      this.syncAspectRatio(source);
    }
  }

  async compress(): Promise<void> {
    const file = this.selectedFile();
    const image = this.originalImage();
    if (!file || !image) {
      return;
    }

    const built = buildImageCompressorOptions(image, this.form.getRawValue());
    if (!built.options) {
      this.errors.set([built.error ?? IMAGE_COMPRESSOR_ERROR.invalidDimensions]);
      this.lastErrorWasOversized.set(false);
      return;
    }

    this.isProcessing.set(true);
    this.errors.set([]);
    this.lastErrorWasOversized.set(false);
    try {
      const canvas = await renderCompressorCanvas(image, built.options);
      const blob = await canvasToCompressorBlob(
        canvas,
        built.options.format,
        built.options.quality
      );
      if (!blob) {
        throw new Error(IMAGE_COMPRESSOR_ERROR.encodeFailed);
      }

      this.revokeResultUrl();
      const downloadUrl = URL.createObjectURL(blob);
      const sanitizedPreview = this.sanitizer.bypassSecurityTrustUrl(downloadUrl);

      const compressionResult: ImageCompressionResult = {
        originalName: file.name,
        originalSize: file.size,
        originalDimensions: { width: image.naturalWidth, height: image.naturalHeight },
        compressedSize: blob.size,
        compressedDimensions: { width: canvas.width, height: canvas.height },
        reduction: blob.size / file.size,
        previewUrl: sanitizedPreview,
        downloadUrl,
        format: built.options.format
      };

      this.result.set(compressionResult);
      if (this.form.controls.rememberHistory.value) {
        this.addToHistory(compressionResult);
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
    anchor.download = buildCompressedFilename(current.originalName, current.format);
    anchor.click();
    this.toast.info('Compressed image downloaded');
  }

  clear(): void {
    this.revokeResultUrl();
    this.selectedFile.set(null);
    this.originalImage.set(null);
    this.previewUrl.set(null);
    this.result.set(null);
    this.errors.set([]);
    this.warnings.set([]);
    this.lastErrorWasOversized.set(false);
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

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId.set(suggestionId);
  }

  formatBytes(value: number): string {
    return ictFormatBytes(value);
  }

  private async loadFile(file: File): Promise<void> {
    this.errors.set([]);
    this.warnings.set([]);
    this.revokeResultUrl();
    this.result.set(null);
    this.lastErrorWasOversized.set(false);

    const validationErrors = validateImageCompressorFile(file);
    if (validationErrors) {
      this.errors.set(validationErrors);
      this.lastErrorWasOversized.set(file.size > IMAGE_COMPRESSOR_MAX_FILE_SIZE);
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
      this.errors.set([IMAGE_COMPRESSOR_ERROR.loadFailed]);
      this.selectedFile.set(null);
      this.lastErrorWasOversized.set(false);
    };

    const reader = new FileReader();
    reader.onload = () => {
      image.src = reader.result as string;
    };
    reader.readAsDataURL(file);
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
    const synced = syncImageCompressorAspect(
      source,
      image.naturalWidth,
      image.naturalHeight,
      this.form.controls.resizeWidth.value,
      this.form.controls.resizeHeight.value
    );
    if (source === 'width') {
      this.form.controls.resizeHeight.setValue(synced.height, { emitEvent: false });
    } else {
      this.form.controls.resizeWidth.setValue(synced.width, { emitEvent: false });
    }
  }

  private addToHistory(result: ImageCompressionResult): void {
    const entry = createImageCompressorHistoryEntry(result);
    this.history.update((entries) => prependImageCompressorHistory(entries, entry));
  }

  private revokeResultUrl(): void {
    const current = this.result();
    if (current?.downloadUrl) {
      URL.revokeObjectURL(current.downloadUrl);
    }
  }
}
