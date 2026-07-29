import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  computed,
  inject,
  signal
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { DomSanitizer } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import {
  AssetService,
  Navigation,
  ToastService,
  TooltipDirective
} from '@tools-workspace/features-home';
import {
  PALETTE_DEFAULT_COLOR_COUNT,
  PALETTE_DEFAULT_METHOD,
  PALETTE_ERROR,
  PALETTE_EXTRACTION_METHODS,
  PALETTE_MAX_FILE_SIZE,
  PALETTE_RELATED_TOOLS
} from '../../constants/palette-generator.constants';
import { ictCopyText } from '../../shared/ict-clipboard.util';
import { ictFormatBytes } from '../../shared/ict-format.util';
import type { IctRelatedToolLink } from '../../shared/ict-tool-suggestion.model';
import type {
  PaletteColorInfo,
  PaletteFormGroup,
  PaletteHistoryEntry,
  PaletteResult
} from '../../types/palette-generator.types';
import {
  buildPaletteCssExport,
  buildPaletteCssFilename,
  computePaletteSampleScale,
  createPaletteHistoryEntry,
  extractPaletteFromImageData,
  prependPaletteHistory,
  resolvePaletteMethodLabel,
  resolvePaletteSuggestion,
  validatePaletteFile
} from '../../utils/palette-generator.utils';

@Component({
  selector: 'lib-palette-generator',
  standalone: true,
  templateUrl: './palette-generator.html',
  styleUrls: ['./palette-generator.scss'],
  imports: [CommonModule, ReactiveFormsModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PaletteGeneratorComponent {
  private readonly fb = inject(FormBuilder);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly toast = inject(ToastService);
  readonly assetService = inject(AssetService);

  @ViewChild('fileInput', { static: false }) fileInput!: ElementRef<HTMLInputElement>;

  readonly form: PaletteFormGroup = this.fb.group({
    colorCount: this.fb.control(PALETTE_DEFAULT_COLOR_COUNT, { nonNullable: true }),
    method: this.fb.control(PALETTE_DEFAULT_METHOD, { nonNullable: true }),
    rememberHistory: this.fb.control(true, { nonNullable: true })
  });

  readonly methods = PALETTE_EXTRACTION_METHODS;
  readonly maxFileSize = PALETTE_MAX_FILE_SIZE;
  readonly relatedTools: ReadonlyArray<IctRelatedToolLink> = PALETTE_RELATED_TOOLS;

  readonly selectedFile = signal<File | null>(null);
  readonly errors = signal<string[]>([]);
  readonly warnings = signal<string[]>([]);
  readonly result = signal<PaletteResult | null>(null);
  readonly history = signal<PaletteHistoryEntry[]>([]);
  readonly isProcessing = signal(false);
  readonly progress = signal(0);
  readonly dragActive = signal(false);
  private readonly dismissedSuggestionId = signal<string | null>(null);
  private readonly lastErrorWasOversized = signal(false);
  private previewObjectUrl: string | null = null;
  private progressResetTimer: ReturnType<typeof setTimeout> | null = null;

  readonly hasHistory = computed(() => this.history().length > 0);
  readonly hasResult = computed(() => this.result() !== null);
  readonly currentMethodLabel = computed(() =>
    resolvePaletteMethodLabel(this.form.controls.method.value)
  );

  readonly primarySuggestion = computed(() => {
    const current = this.result();
    const suggestion = resolvePaletteSuggestion({
      hasFile: !!this.selectedFile(),
      hasResult: current !== null,
      hasError: this.errors().length > 0,
      isOversizedHint: this.lastErrorWasOversized(),
      colorCount: current?.colors.length ?? 0,
      method: this.form.controls.method.value
    });
    if (!suggestion || this.dismissedSuggestionId() === suggestion.id) {
      return null;
    }
    return suggestion;
  });

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
    this.progress.set(0);
    this.lastErrorWasOversized.set(false);

    const validation = validatePaletteFile(file);
    if (validation.errors) {
      this.errors.set(validation.errors);
      this.lastErrorWasOversized.set(validation.isOversized);
      return;
    }

    this.selectedFile.set(file);
    await this.extractPalette(file);
  }

  async extractPalette(file: File): Promise<void> {
    this.isProcessing.set(true);
    this.progress.set(10);
    this.clearProgressResetTimer();

    try {
      this.revokePreviewUrl();
      const objectUrl = URL.createObjectURL(file);
      this.previewObjectUrl = objectUrl;
      const previewUrl = this.sanitizer.bypassSecurityTrustUrl(objectUrl);
      const { colorCount, method } = this.form.getRawValue();

      this.progress.set(30);

      const colors = await this.extractColorsFromImage(file, colorCount, method);

      this.progress.set(90);

      const paletteResult: PaletteResult = {
        colors,
        previewUrl,
        filename: file.name || null,
        method: resolvePaletteMethodLabel(method),
        colorCount: colors.length
      };

      this.result.set(paletteResult);
      this.progress.set(100);

      if (this.form.controls.rememberHistory.value) {
        this.addToHistory(paletteResult);
      }
    } catch (error) {
      this.errors.set([`Failed to extract palette: ${(error as Error)?.message ?? 'Unknown error'}`]);
      this.result.set(null);
    } finally {
      this.isProcessing.set(false);
      this.progressResetTimer = setTimeout(() => this.progress.set(0), 500);
    }
  }

  async copyToClipboard(value: string, label: string): Promise<void> {
    const ok = await ictCopyText(this.toast, value, label);
    if (!ok) {
      this.errors.set([`Unable to copy ${label} to clipboard.`]);
    }
  }

  downloadPalette(): void {
    const current = this.result();
    if (!current) {
      return;
    }

    const css = buildPaletteCssExport(current.colors);
    const blob = new Blob([css], { type: 'text/css;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = buildPaletteCssFilename(current.filename);
    anchor.click();
    URL.revokeObjectURL(url);
    this.toast.info('Palette CSS downloaded');
  }

  clear(): void {
    this.revokePreviewUrl();
    this.clearProgressResetTimer();
    this.selectedFile.set(null);
    this.result.set(null);
    this.errors.set([]);
    this.warnings.set([]);
    this.progress.set(0);
    this.lastErrorWasOversized.set(false);
    if (this.fileInput?.nativeElement) {
      this.fileInput.nativeElement.value = '';
    }
  }

  applyHistory(entry: PaletteHistoryEntry): void {
    const result: PaletteResult = {
      colors: entry.colors,
      previewUrl: this.sanitizer.bypassSecurityTrustUrl(entry.preview),
      filename: entry.filename,
      method: 'History',
      colorCount: entry.colors.length
    };
    this.result.set(result);
  }

  clearHistory(): void {
    this.history.set([]);
  }

  removeHistoryEntry(timestamp: number): void {
    this.history.update((entries) => entries.filter((entry) => entry.timestamp !== timestamp));
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId.set(suggestionId);
  }

  formatBytes(value: number): string {
    return ictFormatBytes(value);
  }

  private async extractColorsFromImage(
    file: File,
    count: number,
    method: string
  ): Promise<PaletteColorInfo[]> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const sourceUrl = URL.createObjectURL(file);
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error(PALETTE_ERROR.canvasUnavailable));
            return;
          }

          const scale = computePaletteSampleScale(img.width, img.height);
          canvas.width = img.width * scale;
          canvas.height = img.height * scale;

          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          resolve(extractPaletteFromImageData(imageData, count, method));
        } catch (error) {
          reject(error);
        } finally {
          URL.revokeObjectURL(sourceUrl);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(sourceUrl);
        reject(new Error(PALETTE_ERROR.loadFailed));
      };
      img.src = sourceUrl;
    });
  }

  private addToHistory(result: PaletteResult): void {
    const entry = createPaletteHistoryEntry(result);
    this.history.update((entries) => prependPaletteHistory(entries, entry));
  }

  private revokePreviewUrl(): void {
    if (this.previewObjectUrl) {
      URL.revokeObjectURL(this.previewObjectUrl);
      this.previewObjectUrl = null;
    }
  }

  private clearProgressResetTimer(): void {
    if (this.progressResetTimer !== null) {
      clearTimeout(this.progressResetTimer);
      this.progressResetTimer = null;
    }
  }
}
