import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import {
  AssetService,
  Navigation,
  ToastService,
  TooltipDirective
} from '@tools-workspace/features-home';
import {
  IMAGE_TO_TEXT_DEFAULT_LANGUAGE,
  IMAGE_TO_TEXT_DEFAULT_OEM,
  IMAGE_TO_TEXT_DEFAULT_PSM,
  IMAGE_TO_TEXT_ERROR,
  IMAGE_TO_TEXT_LANGUAGES,
  IMAGE_TO_TEXT_MAX_FILE_SIZE,
  IMAGE_TO_TEXT_PSM_OPTIONS,
  IMAGE_TO_TEXT_RELATED_TOOLS
} from '../../constants/image-to-text.constants';
import { ictCopyText } from '../../shared/ict-clipboard.util';
import { ictFormatBytes } from '../../shared/ict-format.util';
import type { IctRelatedToolLink } from '../../shared/ict-tool-suggestion.model';
import type {
  ImageToTextExtractionResult,
  ImageToTextFormGroup,
  ImageToTextHistoryEntry
} from '../../types/image-to-text.types';
import {
  buildExtractedTextFilename,
  computeImageToTextStats,
  createImageToTextHistoryEntry,
  getImageToTextFallbackMessage,
  prependImageToTextHistory,
  resolveImageToTextLanguageName,
  resolveImageToTextSuggestion,
  validateImageToTextFile
} from '../../utils/image-to-text.utils';

/** Minimal Tesseract worker surface used by this tool. */
interface TesseractWorkerLike {
  loadLanguage(lang: string): Promise<unknown>;
  initialize(lang: string): Promise<unknown>;
  setParameters(params: Record<string, string>): Promise<unknown>;
  recognize(file: File): Promise<{ data: { text?: string; confidence?: number } }>;
  terminate(): Promise<unknown>;
}

@Component({
  selector: 'lib-image-to-text',
  standalone: true,
  templateUrl: './image-to-text.html',
  styleUrls: ['./image-to-text.scss'],
  imports: [CommonModule, ReactiveFormsModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ImageToTextComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly toast = inject(ToastService);
  readonly assetService = inject(AssetService);

  @ViewChild('fileInput', { static: false }) fileInput!: ElementRef<HTMLInputElement>;

  readonly form: ImageToTextFormGroup = this.fb.group({
    language: this.fb.control(IMAGE_TO_TEXT_DEFAULT_LANGUAGE, { nonNullable: true }),
    psm: this.fb.control(IMAGE_TO_TEXT_DEFAULT_PSM, { nonNullable: true }),
    oem: this.fb.control(IMAGE_TO_TEXT_DEFAULT_OEM, { nonNullable: true }),
    rememberHistory: this.fb.control(true, { nonNullable: true })
  });

  readonly languages = IMAGE_TO_TEXT_LANGUAGES;
  readonly psmOptions = IMAGE_TO_TEXT_PSM_OPTIONS;
  readonly maxFileSize = IMAGE_TO_TEXT_MAX_FILE_SIZE;
  readonly relatedTools: ReadonlyArray<IctRelatedToolLink> = IMAGE_TO_TEXT_RELATED_TOOLS;

  readonly selectedFile = signal<File | null>(null);
  readonly errors = signal<string[]>([]);
  readonly warnings = signal<string[]>([]);
  readonly result = signal<ImageToTextExtractionResult | null>(null);
  readonly history = signal<ImageToTextHistoryEntry[]>([]);
  readonly isProcessing = signal(false);
  readonly progress = signal(0);
  readonly dragActive = signal(false);
  private readonly dismissedSuggestionId = signal<string | null>(null);
  private readonly lastErrorWasOversized = signal(false);
  private readonly tesseractUnavailable = signal(false);

  readonly hasHistory = computed(() => this.history().length > 0);
  readonly hasResult = computed(() => this.result() !== null);
  readonly currentLanguageName = computed(() =>
    resolveImageToTextLanguageName(this.form.controls.language.value, this.languages)
  );

  readonly primarySuggestion = computed(() => {
    const current = this.result();
    const suggestion = resolveImageToTextSuggestion({
      hasFile: !!this.selectedFile(),
      hasResult: current !== null,
      hasError: this.errors().length > 0,
      isOversizedHint: this.lastErrorWasOversized(),
      tesseractUnavailable: this.tesseractUnavailable(),
      emptyText: !!current && !current.text.trim(),
      lowConfidence: !!current && current.confidence > 0 && current.confidence < 60
    });
    if (!suggestion || this.dismissedSuggestionId() === suggestion.id) {
      return null;
    }
    return suggestion;
  });

  private tesseractWorker: TesseractWorkerLike | null = null;
  private tesseractAvailable = false;
  private previewObjectUrl: string | null = null;
  private progressIntervalId: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.initializeTesseract();
  }

  ngOnDestroy(): void {
    this.clearProgressInterval();
    this.revokePreviewUrl();
    this.terminateWorker();
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
    this.progress.set(0);
    this.lastErrorWasOversized.set(false);

    const validation = validateImageToTextFile(file);
    if (validation.errors) {
      this.errors.set(validation.errors);
      this.lastErrorWasOversized.set(validation.isOversized);
      return;
    }

    this.selectedFile.set(file);
    await this.extractText(file);
  }

  async extractText(file: File): Promise<void> {
    this.isProcessing.set(true);
    this.progress.set(0);
    this.clearProgressInterval();

    try {
      if (!this.tesseractAvailable || !this.tesseractWorker) {
        this.progress.set(5);
        await this.initializeTesseract();
      }

      const startTime = Date.now();
      this.revokePreviewUrl();
      const objectUrl = URL.createObjectURL(file);
      this.previewObjectUrl = objectUrl;
      const previewUrl = this.sanitizer.bypassSecurityTrustUrl(objectUrl);

      let extractedText = '';
      let confidence = 0;

      if (this.tesseractAvailable && this.tesseractWorker) {
        try {
          await this.tesseractWorker.setParameters({
            tessedit_pageseg_mode: this.form.controls.psm.value.toString(),
            tessedit_ocr_engine_mode: this.form.controls.oem.value.toString()
          });

          this.progress.set(20);

          // No logger callback — logger functions cannot be cloned for Web Workers.
          const recognizePromise = this.tesseractWorker.recognize(file);

          let currentProgress = 20;
          this.progressIntervalId = setInterval(() => {
            currentProgress = Math.min(currentProgress + 3, 90);
            this.progress.set(currentProgress);
          }, 300);

          const { data } = await recognizePromise;

          this.clearProgressInterval();
          this.progress.set(100);

          extractedText = data.text || '';
          confidence = data.confidence || 0;

          if (!extractedText.trim()) {
            this.warnings.set([IMAGE_TO_TEXT_ERROR.noText]);
          }
        } catch (error) {
          const errorMessage = (error as Error)?.message ?? 'Unknown error';
          this.warnings.set([`OCR processing failed: ${errorMessage}`]);
          extractedText = await this.basicTextExtraction();
        }
      } else {
        extractedText = await this.basicTextExtraction();
      }

      const processingTime = Date.now() - startTime;
      const stats = computeImageToTextStats(extractedText);

      const extractionResult: ImageToTextExtractionResult = {
        text: extractedText,
        confidence: Math.round(confidence),
        words: stats.words,
        characters: stats.characters,
        lines: stats.lines,
        previewUrl,
        filename: file.name || null,
        processingTime
      };

      this.result.set(extractionResult);

      if (this.form.controls.rememberHistory.value) {
        this.addToHistory(extractionResult);
      }
    } catch (error) {
      this.errors.set([`Failed to extract text: ${(error as Error)?.message ?? 'Unknown error'}`]);
      this.result.set(null);
    } finally {
      this.clearProgressInterval();
      this.isProcessing.set(false);
      this.progress.set(0);
    }
  }

  async copyToClipboard(): Promise<void> {
    const current = this.result();
    if (!current) {
      return;
    }
    const ok = await ictCopyText(this.toast, current.text, 'Extracted text');
    if (!ok) {
      this.errors.set([`Unable to copy: ${IMAGE_TO_TEXT_ERROR.clipboardDenied}`]);
    }
  }

  downloadText(): void {
    const current = this.result();
    if (!current) {
      return;
    }
    const blob = new Blob([current.text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = buildExtractedTextFilename(current.filename);
    anchor.click();
    URL.revokeObjectURL(url);
    this.toast.info('Extracted text downloaded');
  }

  clear(): void {
    this.revokePreviewUrl();
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

  applyHistory(entry: ImageToTextHistoryEntry): void {
    const result: ImageToTextExtractionResult = {
      text: entry.text,
      confidence: 0,
      words: entry.words,
      characters: entry.text.length,
      lines: entry.text.split('\n').filter((line) => line.trim()).length,
      previewUrl: this.sanitizer.bypassSecurityTrustUrl(entry.preview),
      filename: entry.filename,
      processingTime: 0
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

  async onLanguageChange(): Promise<void> {
    if (this.tesseractAvailable && this.tesseractWorker && this.selectedFile()) {
      const language = this.form.controls.language.value;
      try {
        this.isProcessing.set(true);
        this.progress.set(0);

        await this.tesseractWorker.loadLanguage(language);
        await this.tesseractWorker.initialize(language);

        await this.tesseractWorker.setParameters({
          tessedit_pageseg_mode: this.form.controls.psm.value.toString(),
          tessedit_ocr_engine_mode: this.form.controls.oem.value.toString()
        });

        const file = this.selectedFile();
        if (file) {
          await this.extractText(file);
        }
      } catch (error) {
        this.errors.set([`Failed to load language: ${(error as Error)?.message ?? 'Unknown error'}`]);
        this.isProcessing.set(false);
      }
    }
  }

  async onPsmChange(): Promise<void> {
    if (this.tesseractAvailable && this.tesseractWorker && this.selectedFile()) {
      try {
        await this.tesseractWorker.setParameters({
          tessedit_pageseg_mode: this.form.controls.psm.value.toString(),
          tessedit_ocr_engine_mode: this.form.controls.oem.value.toString()
        });

        const file = this.selectedFile();
        if (file) {
          await this.extractText(file);
        }
      } catch (error) {
        this.errors.set([
          `Failed to update settings: ${(error as Error)?.message ?? 'Unknown error'}`
        ]);
      }
    }
  }

  private async terminateWorker(): Promise<void> {
    if (this.tesseractWorker) {
      try {
        await this.tesseractWorker.terminate();
      } catch {
        // Ignore terminate failures during teardown.
      }
      this.tesseractWorker = null;
      this.tesseractAvailable = false;
      this.tesseractUnavailable.set(true);
    }
  }

  private async initializeTesseract(): Promise<void> {
    try {
      const tesseractModule = await import('tesseract.js');
      this.tesseractWorker = (await tesseractModule.createWorker()) as unknown as TesseractWorkerLike;

      const language = this.form.controls.language.value;
      await this.tesseractWorker.loadLanguage(language);
      await this.tesseractWorker.initialize(language);

      await this.tesseractWorker.setParameters({
        tessedit_pageseg_mode: this.form.controls.psm.value.toString(),
        tessedit_ocr_engine_mode: this.form.controls.oem.value.toString()
      });

      this.tesseractAvailable = true;
      this.tesseractUnavailable.set(false);
      this.warnings.set([]);
    } catch (error) {
      this.tesseractAvailable = false;
      this.tesseractUnavailable.set(true);
      const errorMessage = (error as Error)?.message ?? 'Unknown error';
      this.warnings.set([
        `Tesseract.js OCR library not loaded: ${errorMessage}`,
        'Please ensure tesseract.js is installed: npm install tesseract.js'
      ]);
    }
  }

  private async basicTextExtraction(): Promise<string> {
    return getImageToTextFallbackMessage();
  }

  private addToHistory(result: ImageToTextExtractionResult): void {
    const entry = createImageToTextHistoryEntry(result);
    this.history.update((entries) => prependImageToTextHistory(entries, entry));
  }

  private revokePreviewUrl(): void {
    if (this.previewObjectUrl) {
      URL.revokeObjectURL(this.previewObjectUrl);
      this.previewObjectUrl = null;
    }
  }

  private clearProgressInterval(): void {
    if (this.progressIntervalId !== null) {
      clearInterval(this.progressIntervalId);
      this.progressIntervalId = null;
    }
  }
}
