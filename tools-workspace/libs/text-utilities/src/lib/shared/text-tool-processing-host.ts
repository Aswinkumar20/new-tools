import { Directive, OnDestroy, inject } from '@angular/core';
import { ToastService } from '@tools-workspace/features-home';
import {
  WCC_HUGE_TEXT_THRESHOLD,
  WCC_LARGE_TEXT_THRESHOLD,
} from '../constants/words-and-character-counter.constants';
import { formatCompactCount, formatCountTitle } from '../utils/words-and-character-counter.utils';
import { isLikelyTextUploadFile } from './text-tool-file.util';
import { isTextToolSyncProcessMode } from './text-tool-sync-process';

/** Shared upload/download/progress helpers for custom-layout text tools. */
@Directive()
export abstract class TextToolProcessingHost implements OnDestroy {
  protected readonly toastService = inject(ToastService);

  isReadingFile = false;
  isAnalyzing = false;
  isExporting = false;
  processingProgress: number | null = null;
  isDragOver = false;
  maxUploadBytes = 10 * 1024 * 1024;

  protected fileInput?: HTMLInputElement;
  private processTimer: ReturnType<typeof setTimeout> | null = null;
  private progressTimer: ReturnType<typeof setInterval> | null = null;
  private progressCompleteTimer: ReturnType<typeof setTimeout> | null = null;
  private uploadApplyTimer: ReturnType<typeof setTimeout> | null = null;
  private activeFileReader: FileReader | null = null;
  private uploadSessionId = 0;
  private downloadSessionId = 0;

  get isProcessing(): boolean {
    return this.isReadingFile || this.isAnalyzing || this.isExporting;
  }

  get processingLabel(): string {
    if (this.isReadingFile) return 'Reading file';
    if (this.isAnalyzing) return 'Processing text';
    if (this.isExporting) return 'Downloading';
    return 'Processing';
  }

  formatStatCount(value: number): string {
    return formatCompactCount(value);
  }

  formatStatTitle(value: number): string {
    return formatCountTitle(value);
  }

  ngOnDestroy(): void {
    if (this.processTimer) clearTimeout(this.processTimer);
    this.clearProgressTimers();
    this.cancelPendingUploadApply();
    this.abortActiveFileReader();
    this.fileInput?.remove();
    this.fileInput = undefined;
  }

  /** Override to apply uploaded text to the tool UI/state. */
  protected onUploadedTextApplied(text: string): void {
    void text;
  }

  /** Optional hook before upload processing starts. */
  protected onUploadStarting(): void {}

  /** Override to customize accepted file types. */
  protected get uploadAccept(): string {
    return '.txt,.text,.md,.json,.xml,.csv,.log,.html,text/*,application/json,application/xml';
  }

  uploadTextFile(): void {
    if (!this.fileInput) {
      this.fileInput = document.createElement('input');
      this.fileInput.type = 'file';
      this.fileInput.style.display = 'none';
      this.fileInput.addEventListener('change', () => {
        const file = this.fileInput?.files?.[0];
        if (file) this.handleUploadedFile(file);
        if (this.fileInput) this.fileInput.value = '';
      });
      document.body.appendChild(this.fileInput);
    }
    this.fileInput.accept = this.uploadAccept;
    this.fileInput.click();
  }

  protected handleUploadedFile(file: File): void {
    if (file.size === 0) {
      this.toastService.error('The file is empty. Choose a file with text content.');
      return;
    }
    if (file.size > this.maxUploadBytes) {
      this.toastService.error(
        `File is too large. Maximum size is ${Math.round(this.maxUploadBytes / (1024 * 1024))} MB.`
      );
      return;
    }
    if (!isLikelyTextUploadFile(file)) {
      this.toastService.error('Please upload a text-based file (.txt, .md, .csv, .json, etc.).');
      return;
    }

    this.cancelInFlightOperations({ forUpload: true });
    this.onUploadStarting();

    const sessionId = ++this.uploadSessionId;
    this.isReadingFile = true;
    this.startDeterminateProgress(0);

    const reader = new FileReader();
    this.activeFileReader = reader;

    reader.onprogress = (event: ProgressEvent<FileReader>) => {
      if (!this.isUploadSessionActive(sessionId)) return;
      if (event.lengthComputable && event.total > 0) {
        this.processingProgress = Math.min(99, (event.loaded / event.total) * 100);
      } else if (this.processingProgress === null) {
        this.startSimulatedProgress(75);
      }
    };

    reader.onabort = () => {
      if (!this.isUploadSessionActive(sessionId)) return;
      this.resetUploadFailureState();
    };

    reader.onload = () => {
      if (!this.isUploadSessionActive(sessionId)) return;

      this.activeFileReader = null;
      const text = typeof reader.result === 'string' ? reader.result : '';
      if (!text.trim()) {
        this.resetUploadFailureState();
        this.toastService.error(`"${file.name}" has no readable text content.`);
        return;
      }

      this.processingProgress = 100;
      this.isReadingFile = false;
      const needsAnalysis = text.length >= WCC_LARGE_TEXT_THRESHOLD;
      if (needsAnalysis) {
        this.isAnalyzing = true;
        this.startSimulatedProgress(92);
      }

      this.uploadApplyTimer = setTimeout(() => {
        if (!this.isUploadSessionActive(sessionId)) return;
        this.uploadApplyTimer = null;
        this.onUploadedTextApplied(text);
        this.isAnalyzing = false;
        this.finishProgressAnimation();
        this.toastService.success(`Loaded "${file.name}"`);
      }, 0);
    };

    reader.onerror = () => {
      if (!this.isUploadSessionActive(sessionId)) return;
      this.resetUploadFailureState();
      this.toastService.error('Could not read the file.');
    };

    try {
      reader.readAsText(file, 'UTF-8');
    } catch {
      if (!this.isUploadSessionActive(sessionId)) return;
      this.resetUploadFailureState();
      this.toastService.error('Could not read the file.');
    }
  }

  downloadContent(content: string, filename: string): void {
    if (!content || this.isProcessing) return;

    this.isExporting = true;
    this.startSimulatedProgress(85);
    const exportSessionId = ++this.downloadSessionId;
    setTimeout(() => {
      if (!this.isDownloadSessionActive(exportSessionId)) return;
      try {
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
        URL.revokeObjectURL(link.href);
        this.toastService.success('Download started');
      } finally {
        if (this.isDownloadSessionActive(exportSessionId)) {
          this.isExporting = false;
          this.finishProgressAnimation();
        }
      }
    }, 0);
  }

  /** Debounce heavy work for large pasted/typed text. */
  protected scheduleDebouncedWork(work: () => void, textLength: number): void {
    if (this.processTimer) clearTimeout(this.processTimer);

    const wait = this.isSyncProcessMode() ? 0 : this.getProcessDebounceWait(textLength);

    if (wait === 0) {
      this.runWithLargeTextHandling(work, textLength);
      return;
    }

    if (textLength >= WCC_LARGE_TEXT_THRESHOLD) {
      this.isAnalyzing = true;
      this.startSimulatedProgress(88);
    }

    this.processTimer = setTimeout(() => {
      this.runWithLargeTextHandling(work, textLength);
      this.processTimer = null;
    }, wait);
  }

  protected cancelDebouncedWork(): void {
    if (this.processTimer) {
      clearTimeout(this.processTimer);
      this.processTimer = null;
    }
  }

  protected runWithLargeTextHandling(work: () => void, textLength: number): void {
    const isLarge = textLength >= WCC_LARGE_TEXT_THRESHOLD;
    if (isLarge && !this.isAnalyzing) {
      this.isAnalyzing = true;
      this.startSimulatedProgress(88);
    }

    work();

    this.isAnalyzing = false;
    if (isLarge) {
      this.finishProgressAnimation();
    }
  }

  protected getProcessDebounceWait(len: number): number {
    if (len > WCC_HUGE_TEXT_THRESHOLD) return 2000;
    if (len > WCC_LARGE_TEXT_THRESHOLD) return 800;
    if (len > 10000) return 500;
    if (len > 5000) return 600;
    if (len > 2000) return 450;
    return 300;
  }

  protected isSyncProcessMode(): boolean {
    return isTextToolSyncProcessMode();
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;

    const files = event.dataTransfer?.files;
    if (!files?.length) return;
    if (files.length > 1) {
      this.toastService.info('Multiple files dropped — using the first file only.');
    }
    this.handleUploadedFile(files[0]);
  }

  protected cancelInFlightOperations(options: { forUpload?: boolean } = {}): void {
    const hadWork =
      this.isReadingFile ||
      this.isAnalyzing ||
      this.isExporting ||
      !!this.activeFileReader ||
      !!this.uploadApplyTimer;

    this.uploadSessionId++;
    this.downloadSessionId++;
    this.abortActiveFileReader();
    this.cancelPendingUploadApply();
    if (this.processTimer) {
      clearTimeout(this.processTimer);
      this.processTimer = null;
    }
    this.isReadingFile = false;
    this.isAnalyzing = false;
    this.isExporting = false;
    this.clearProgressTimers();
    this.processingProgress = null;
    this.isDragOver = false;

    if (options.forUpload && hadWork) {
      this.toastService.info('Previous operation cancelled — starting new upload.');
    }
  }

  protected isUploadSessionActive(sessionId: number): boolean {
    return sessionId === this.uploadSessionId;
  }

  protected isDownloadSessionActive(sessionId: number): boolean {
    return sessionId === this.downloadSessionId;
  }

  protected clearProgressTimers(): void {
    if (this.progressTimer) {
      clearInterval(this.progressTimer);
      this.progressTimer = null;
    }
    if (this.progressCompleteTimer) {
      clearTimeout(this.progressCompleteTimer);
      this.progressCompleteTimer = null;
    }
  }

  protected startDeterminateProgress(initial = 0): void {
    this.clearProgressTimers();
    this.processingProgress = Math.max(0, Math.min(100, initial));
  }

  protected startSimulatedProgress(cap = 90): void {
    this.clearProgressTimers();
    if (this.processingProgress === null || this.processingProgress >= cap) {
      this.processingProgress = 0;
    }
    this.progressTimer = setInterval(() => {
      if (this.processingProgress === null) return;
      const remaining = cap - this.processingProgress;
      const step = Math.max(0.5, remaining * 0.07);
      this.processingProgress = Math.min(cap, this.processingProgress + step);
    }, 100);
  }

  protected finishProgressAnimation(): void {
    this.clearProgressTimers();
    this.processingProgress = 100;
    this.progressCompleteTimer = setTimeout(() => {
      if (!this.isProcessing) {
        this.processingProgress = null;
      }
      this.progressCompleteTimer = null;
    }, 450);
  }

  protected cancelPendingUploadApply(): void {
    if (this.uploadApplyTimer) {
      clearTimeout(this.uploadApplyTimer);
      this.uploadApplyTimer = null;
    }
  }

  protected abortActiveFileReader(): void {
    if (!this.activeFileReader) return;
    const reader = this.activeFileReader;
    this.activeFileReader = null;
    reader.onload = null;
    reader.onerror = null;
    reader.onprogress = null;
    reader.onabort = null;
    try {
      reader.abort();
    } catch {
      // Reader may already be finished.
    }
  }

  protected resetUploadFailureState(): void {
    this.isReadingFile = false;
    this.isAnalyzing = false;
    this.activeFileReader = null;
    this.clearProgressTimers();
    this.processingProgress = null;
  }
}
