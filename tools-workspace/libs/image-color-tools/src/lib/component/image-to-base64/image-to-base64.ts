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
  IMAGE_TO_BASE64_DEFAULT_CHUNK_SIZE,
  IMAGE_TO_BASE64_DEFAULT_WRAP_WIDTH,
  IMAGE_TO_BASE64_ERROR,
  IMAGE_TO_BASE64_MAX_FILE_SIZE,
  IMAGE_TO_BASE64_MIN_CHUNK_SIZE,
  IMAGE_TO_BASE64_RELATED_TOOLS
} from '../../constants/image-to-base64.constants';
import { ictCopyText } from '../../shared/ict-clipboard.util';
import { ictFormatBytes } from '../../shared/ict-format.util';
import type { IctRelatedToolLink } from '../../shared/ict-tool-suggestion.model';
import type {
  ImageToBase64ConversionResult,
  ImageToBase64FormGroup,
  ImageToBase64HistoryEntry,
  ImageToBase64OutputFormat
} from '../../types/image-to-base64.types';
import {
  arrayBufferToBase64,
  buildEncodedDownloadFilename,
  buildImageToBase64Payload,
  createImageToBase64HistoryEntry,
  prependImageToBase64History,
  resolveImageToBase64Suggestion,
  validateImageToBase64File
} from '../../utils/image-to-base64.utils';

@Component({
  selector: 'lib-image-to-base64',
  standalone: true,
  templateUrl: './image-to-base64.html',
  styleUrls: ['./image-to-base64.scss'],
  imports: [CommonModule, ReactiveFormsModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ImageToBase64Component {
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly toast = inject(ToastService);
  readonly assetService = inject(AssetService);
  readonly maxFileSize = IMAGE_TO_BASE64_MAX_FILE_SIZE;
  readonly relatedTools: ReadonlyArray<IctRelatedToolLink> = IMAGE_TO_BASE64_RELATED_TOOLS;

  readonly form: ImageToBase64FormGroup = this.fb.group({
    outputFormat: this.fb.control<ImageToBase64OutputFormat>('base64', { nonNullable: true }),
    wrapWidth: this.fb.control<number | null>(IMAGE_TO_BASE64_DEFAULT_WRAP_WIDTH),
    includeMime: this.fb.control<boolean>(true, { nonNullable: true }),
    chunkSize: this.fb.control<number>(IMAGE_TO_BASE64_DEFAULT_CHUNK_SIZE, {
      nonNullable: true,
      validators: [Validators.min(IMAGE_TO_BASE64_MIN_CHUNK_SIZE)]
    }),
    rememberHistory: this.fb.control<boolean>(true, { nonNullable: true })
  });

  readonly selectedFile = signal<File | null>(null);
  readonly errors = signal<string[]>([]);
  readonly warnings = signal<string[]>([]);
  readonly result = signal<ImageToBase64ConversionResult | null>(null);
  readonly history = signal<ImageToBase64HistoryEntry[]>([]);
  readonly isProcessing = signal(false);
  readonly dragActive = signal(false);
  private readonly dismissedSuggestionId = signal<string | null>(null);
  private readonly lastErrorWasOversized = signal(false);
  private previewObjectUrl: string | null = null;

  readonly hasHistory = computed(() => this.history().length > 0);
  readonly hasResult = computed(() => this.result() !== null);
  readonly shareable = computed(() => {
    const current = this.result();
    return !!current && navigator.clipboard !== undefined;
  });

  readonly primarySuggestion = computed(() => {
    const current = this.result();
    const suggestion = resolveImageToBase64Suggestion({
      hasFile: !!this.selectedFile(),
      hasResult: current !== null,
      hasError: this.errors().length > 0,
      isOversizedHint: this.lastErrorWasOversized(),
      encodedSize: current?.encodedSize ?? null,
      outputFormat: current?.outputFormat ?? null
    });
    if (!suggestion || this.dismissedSuggestionId() === suggestion.id) {
      return null;
    }
    return suggestion;
  });

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (this.result()) {
        this.reprocess();
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
    const file = event.dataTransfer?.files?.[0] ?? null;
    if (file) {
      this.handleFile(file);
    }
  }

  handleFileInput(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    if (!input?.files?.length) {
      return;
    }
    const file = input.files[0];
    this.handleFile(file);
    input.value = '';
  }

  async handleFile(file: File): Promise<void> {
    this.errors.set([]);
    this.warnings.set([]);
    this.revokePreviewUrl();
    this.result.set(null);
    this.lastErrorWasOversized.set(false);

    const validation = validateImageToBase64File(file);
    if (validation.warnings.length) {
      this.warnings.set(validation.warnings);
    }
    if (validation.errors) {
      this.errors.set(validation.errors);
      this.lastErrorWasOversized.set(validation.isOversized);
      return;
    }

    this.selectedFile.set(file);
    await this.convertFile(file);
  }

  async convertFile(file: File): Promise<void> {
    this.isProcessing.set(true);
    try {
      const buffer = await file.arrayBuffer();
      const base64 = arrayBufferToBase64(buffer);
      this.buildResult(file, base64);
    } catch (error) {
      this.errors.set([
        `${IMAGE_TO_BASE64_ERROR.processFailed}: ${(error as Error)?.message ?? 'Unknown error.'}`
      ]);
      this.result.set(null);
    } finally {
      this.isProcessing.set(false);
    }
  }

  reprocess(): void {
    const file = this.selectedFile();
    if (!file) {
      return;
    }
    this.convertFile(file);
  }

  async copyToClipboard(): Promise<void> {
    const current = this.result();
    if (!current) {
      return;
    }
    const ok = await ictCopyText(this.toast, current.textPreview, 'Encoded output');
    if (!ok) {
      this.errors.set([`Unable to copy: ${IMAGE_TO_BASE64_ERROR.clipboardDenied}`]);
    }
  }

  downloadEncoded(): void {
    const current = this.result();
    if (!current) {
      return;
    }
    const blob = new Blob([current.textPreview], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = buildEncodedDownloadFilename(current.filename, current.outputFormat);
    anchor.click();
    URL.revokeObjectURL(url);
    this.toast.info('Encoded output downloaded');
  }

  clear(): void {
    this.revokePreviewUrl();
    this.selectedFile.set(null);
    this.result.set(null);
    this.errors.set([]);
    this.warnings.set([]);
    this.lastErrorWasOversized.set(false);
  }

  applyHistory(entry: ImageToBase64HistoryEntry): void {
    this.warnings.set([
      `History entry: ${entry.filename ?? 'Untitled'} (${ictFormatBytes(entry.size)}) · ${entry.mime}`
    ]);
  }

  removeHistoryEntry(timestamp: number): void {
    this.history.update((current) => current.filter((entry) => entry.timestamp !== timestamp));
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

  private buildResult(file: File, base64: string): void {
    const { outputFormat, wrapWidth, includeMime, chunkSize, rememberHistory } =
      this.form.getRawValue();
    const payload = buildImageToBase64Payload(file, base64, {
      outputFormat,
      wrapWidth,
      includeMime,
      chunkSize
    });

    this.revokePreviewUrl();
    const objectUrl = URL.createObjectURL(file);
    this.previewObjectUrl = objectUrl;
    const previewUrl: SafeUrl = this.sanitizer.bypassSecurityTrustUrl(objectUrl);

    const conversionResult: ImageToBase64ConversionResult = {
      dataUri: payload.dataUri,
      textPreview: payload.textPreview,
      size: payload.size,
      encodedSize: payload.encodedSize,
      compressionRatio: payload.compressionRatio,
      previewUrl,
      filename: payload.filename,
      mime: payload.mime,
      outputFormat: payload.outputFormat,
      chunks: payload.chunks
    };

    this.result.set(conversionResult);

    if (rememberHistory) {
      const entry = createImageToBase64HistoryEntry(payload);
      this.history.update((current) => prependImageToBase64History(current, entry));
    }
  }

  private revokePreviewUrl(): void {
    if (this.previewObjectUrl) {
      URL.revokeObjectURL(this.previewObjectUrl);
      this.previewObjectUrl = null;
    }
  }
}
