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
  IMAGE_RESIZER_DEFAULT_QUALITY,
  IMAGE_RESIZER_ERROR,
  IMAGE_RESIZER_MAX_DIMENSION,
  IMAGE_RESIZER_MAX_FILE_SIZE,
  IMAGE_RESIZER_PRESETS,
  IMAGE_RESIZER_RELATED_TOOLS
} from '../../constants/image-resizer.constants';
import { ictFormatBytes } from '../../shared/ict-format.util';
import type { IctRelatedToolLink } from '../../shared/ict-tool-suggestion.model';
import type {
  ImageResizePreset,
  ImageResizeResult,
  ImageResizerFormGroup,
  ImageResizerFormat,
  ImageResizerHistoryEntry,
  ImageResizerInterpolation
} from '../../types/image-resizer.types';
import {
  buildImageResizeOptions,
  buildResizedFilename,
  canvasToResizerBlob,
  createImageResizerHistoryEntry,
  prependImageResizerHistory,
  renderResizerCanvas,
  resolveImageResizerSuggestion,
  syncImageResizerAspect,
  validateImageResizerFile
} from '../../utils/image-resizer.utils';

@Component({
  selector: 'lib-image-resizer',
  standalone: true,
  templateUrl: './image-resizer.html',
  styleUrls: ['./image-resizer.scss'],
  imports: [CommonModule, ReactiveFormsModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ImageResizerComponent {
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly toast = inject(ToastService);
  readonly assetService = inject(AssetService);

  readonly form: ImageResizerFormGroup = this.fb.group({
    width: this.fb.control<number | null>(null, [
      Validators.min(1),
      Validators.max(IMAGE_RESIZER_MAX_DIMENSION)
    ]),
    height: this.fb.control<number | null>(null, [
      Validators.min(1),
      Validators.max(IMAGE_RESIZER_MAX_DIMENSION)
    ]),
    keepAspect: this.fb.control<boolean>(true, { nonNullable: true }),
    interpolation: this.fb.control<ImageResizerInterpolation>('smooth', { nonNullable: true }),
    background: this.fb.control<string | null>(null),
    format: this.fb.control<ImageResizerFormat>('image/png', { nonNullable: true }),
    quality: this.fb.control<number>(IMAGE_RESIZER_DEFAULT_QUALITY, {
      nonNullable: true,
      validators: [Validators.min(0.1), Validators.max(1)]
    }),
    rememberHistory: this.fb.control<boolean>(true, { nonNullable: true })
  });

  readonly presets = IMAGE_RESIZER_PRESETS;
  readonly relatedTools: ReadonlyArray<IctRelatedToolLink> = IMAGE_RESIZER_RELATED_TOOLS;
  readonly maxFileSize = IMAGE_RESIZER_MAX_FILE_SIZE;

  readonly selectedFile = signal<File | null>(null);
  readonly originalImage = signal<HTMLImageElement | null>(null);
  readonly previewUrl = signal<SafeUrl | null>(null);
  readonly result = signal<ImageResizeResult | null>(null);
  readonly errors = signal<string[]>([]);
  readonly warnings = signal<string[]>([]);
  readonly isProcessing = signal(false);
  readonly history = signal<ImageResizerHistoryEntry[]>([]);
  readonly dragActive = signal(false);
  private readonly dismissedSuggestionId = signal<string | null>(null);
  private readonly lastErrorWasOversized = signal(false);

  readonly hasHistory = computed(() => this.history().length > 0);
  readonly canResize = computed(() => !!this.selectedFile() && !!this.originalImage());

  readonly primarySuggestion = computed(() => {
    const current = this.result();
    const suggestion = resolveImageResizerSuggestion({
      hasFile: !!this.selectedFile(),
      hasResult: current !== null,
      hasError: this.errors().length > 0,
      isOversizedHint: this.lastErrorWasOversized(),
      targetWidth: this.form.controls.width.value,
      targetHeight: this.form.controls.height.value,
      resizedWidth: current?.resizedDimensions.width ?? null,
      resizedHeight: current?.resizedDimensions.height ?? null
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

  applyPreset(preset: ImageResizePreset): void {
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
    this.revokeResultUrl();
    this.result.set(null);
    this.lastErrorWasOversized.set(false);

    const validationErrors = validateImageResizerFile(file);
    if (validationErrors) {
      this.errors.set(validationErrors);
      this.lastErrorWasOversized.set(file.size > IMAGE_RESIZER_MAX_FILE_SIZE);
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
      this.errors.set([IMAGE_RESIZER_ERROR.loadFailed]);
      this.selectedFile.set(null);
      this.lastErrorWasOversized.set(false);
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

    const options = buildImageResizeOptions(this.form.getRawValue());
    if (!options.width || !options.height) {
      this.errors.set([IMAGE_RESIZER_ERROR.invalidDimensions]);
      this.lastErrorWasOversized.set(false);
      return;
    }

    this.isProcessing.set(true);
    this.errors.set([]);
    this.lastErrorWasOversized.set(false);
    try {
      const canvas = await renderResizerCanvas(image, options);
      const blob = await canvasToResizerBlob(canvas, options.format, options.quality);
      if (!blob) {
        throw new Error(IMAGE_RESIZER_ERROR.encodeFailed);
      }

      this.revokeResultUrl();
      const downloadUrl = URL.createObjectURL(blob);
      const sanitizedPreview = this.sanitizer.bypassSecurityTrustUrl(downloadUrl);

      const resizeResult: ImageResizeResult = {
        originalName: file.name,
        originalSize: file.size,
        originalDimensions: { width: image.naturalWidth, height: image.naturalHeight },
        resizedSize: blob.size,
        resizedDimensions: { width: options.width, height: options.height },
        ratioChange: blob.size / file.size,
        previewUrl: sanitizedPreview,
        downloadUrl,
        format: options.format
      };

      this.result.set(resizeResult);
      if (this.form.controls.rememberHistory.value) {
        this.addToHistory(resizeResult);
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
    anchor.download = buildResizedFilename(
      current.originalName,
      current.resizedDimensions.width,
      current.resizedDimensions.height,
      current.format
    );
    anchor.click();
    this.toast.info('Resized image downloaded');
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

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId.set(suggestionId);
  }

  formatBytes(value: number): string {
    return ictFormatBytes(value);
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
    const synced = syncImageResizerAspect(
      source,
      image.naturalWidth,
      image.naturalHeight,
      this.form.controls.width.value,
      this.form.controls.height.value
    );
    if (source === 'width') {
      this.form.controls.height.setValue(synced.height, { emitEvent: false });
    } else {
      this.form.controls.width.setValue(synced.width, { emitEvent: false });
    }
  }

  private addToHistory(result: ImageResizeResult): void {
    const entry = createImageResizerHistoryEntry(result);
    this.history.update((entries) => prependImageResizerHistory(entries, entry));
  }

  private revokeResultUrl(): void {
    const current = this.result();
    if (current?.downloadUrl) {
      URL.revokeObjectURL(current.downloadUrl);
    }
  }
}
