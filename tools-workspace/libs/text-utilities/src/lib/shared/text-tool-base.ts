import { OnDestroy, OnInit, HostListener, inject, ViewChild, ElementRef, Directive } from '@angular/core';
import { AssetService, ToastService } from '@tools-workspace/features-home';
import {
  WCC_HUGE_TEXT_THRESHOLD,
  WCC_LARGE_TEXT_THRESHOLD,
} from '../constants/words-and-character-counter.constants';
import { formatCompactCount, formatCountTitle } from '../utils/words-and-character-counter.utils';
import { tuCopyText } from './tu-clipboard.util';
import { isTextToolSyncProcessMode } from './text-tool-sync-process';

@Directive()
export abstract class TextToolBase implements OnInit, OnDestroy {
  @ViewChild('inputTextarea') inputTextareaRef?: ElementRef<HTMLTextAreaElement>;

  readonly assetService = inject(AssetService);
  protected readonly toastService = inject(ToastService);

  inputText = '';
  outputText = '';
  errorMessage = '';

  undoStack: string[] = [''];
  redoStack: string[] = [];
  protected isRestoringHistory = false;
  protected historyTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingHistoryValue = '';

  isReadingFile = false;
  isAnalyzing = false;
  isExporting = false;
  processingProgress: number | null = null;
  isDragOver = false;
  readonly maxUploadBytes = 10 * 1024 * 1024;
  protected fileInput?: HTMLInputElement;

  private processTimer: ReturnType<typeof setTimeout> | null = null;
  private progressTimer: ReturnType<typeof setInterval> | null = null;
  private progressCompleteTimer: ReturnType<typeof setTimeout> | null = null;
  private uploadApplyTimer: ReturnType<typeof setTimeout> | null = null;
  private activeFileReader: FileReader | null = null;
  private uploadSessionId = 0;
  private downloadSessionId = 0;

  get hasInput(): boolean {
    return !!this.inputText?.trim();
  }

  get hasOutput(): boolean {
    return !!this.outputText && !this.errorMessage;
  }

  get canUndo(): boolean {
    return this.undoStack.length > 1;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  get isProcessing(): boolean {
    return this.isReadingFile || this.isAnalyzing || this.isExporting;
  }

  get processingLabel(): string {
    if (this.isReadingFile) return 'Reading file';
    if (this.isAnalyzing) return 'Processing text';
    if (this.isExporting) return 'Downloading';
    return 'Processing';
  }

  get isProgressIndeterminate(): boolean {
    return this.isProcessing && this.processingProgress === null;
  }

  get processingProgressRounded(): number {
    return this.processingProgress === null ? 0 : Math.round(this.processingProgress);
  }

  formatStatCount(value: number): string {
    return formatCompactCount(value);
  }

  formatStatTitle(value: number): string {
    return formatCountTitle(value);
  }

  protected abstract process(): void;

  @HostListener('document:keydown', ['$event'])
  handleKeyboard(evt: KeyboardEvent): void {
    if (!this.isSourceEditorFocused()) return;
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const key = evt.key.toLowerCase();
    const undoKey = isMac
      ? evt.metaKey && key === 'z' && !evt.shiftKey
      : evt.ctrlKey && key === 'z' && !evt.shiftKey;
    const redoKey = isMac
      ? evt.metaKey && (key === 'y' || (evt.shiftKey && key === 'z'))
      : evt.ctrlKey && (key === 'y' || (evt.shiftKey && key === 'z'));
    if (undoKey) {
      evt.preventDefault();
      this.undo();
    } else if (redoKey) {
      evt.preventDefault();
      this.redo();
    }
  }

  protected isSourceEditorFocused(): boolean {
    const textarea = this.inputTextareaRef?.nativeElement;
    return !!textarea && document.activeElement === textarea;
  }

  ngOnInit(): void {
    this.seedHistory('');
  }

  ngOnDestroy(): void {
    if (this.historyTimer) clearTimeout(this.historyTimer);
    if (this.processTimer) clearTimeout(this.processTimer);
    this.clearProgressTimers();
    this.cancelPendingUploadApply();
    this.abortActiveFileReader();
    this.fileInput?.remove();
    this.fileInput = undefined;
  }

  protected seedHistory(value: string): void {
    this.undoStack = [value];
    this.redoStack = [];
  }

  onInputChange(): void {
    if (this.isRestoringHistory) return;
    this.scheduleProcessAndHistory(this.inputText);
  }

  onOptionsChange(): void {
    this.runProcessWithLargeTextHandling();
  }

  protected scheduleProcessAndHistory(text: string): void {
    if (this.processTimer) {
      clearTimeout(this.processTimer);
    }

    const len = text.length;
    const wait = this.isSyncProcessMode() ? 0 : this.getProcessDebounceWait(len);

    if (wait === 0) {
      this.runProcessWithLargeTextHandling();
      this.scheduleHistoryPush(text);
      return;
    }

    this.processTimer = setTimeout(() => {
      this.runProcessWithLargeTextHandling();
      this.scheduleHistoryPush(text);
      this.processTimer = null;
    }, wait);
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

  protected runProcessWithLargeTextHandling(): void {
    const isLargeText = this.inputText.length >= WCC_LARGE_TEXT_THRESHOLD;
    if (isLargeText) {
      this.isAnalyzing = true;
      if (this.processingProgress === null) {
        this.startSimulatedProgress(88);
      }
    }

    this.runProcess();

    if (!isLargeText) {
      this.isAnalyzing = false;
    } else {
      this.isAnalyzing = false;
      this.finishProgressAnimation();
    }
  }

  protected runProcess(): void {
    this.errorMessage = '';
    if (!this.inputText) {
      this.outputText = '';
      this.resetDerivedState();
      return;
    }
    try {
      this.process();
    } catch (e) {
      this.outputText = '';
      this.resetDerivedState();
      this.errorMessage = (e as Error).message || 'Processing failed.';
    }
  }

  /** Override to clear tool-specific stats when input/output is cleared. */
  protected resetDerivedState(): void {}

  clear(): void {
    if (this.historyTimer) {
      clearTimeout(this.historyTimer);
      this.historyTimer = null;
    }
    if (this.processTimer) {
      clearTimeout(this.processTimer);
      this.processTimer = null;
    }
    this.applyInputState('');
    this.seedHistory('');
    this.errorMessage = '';
    this.resetDerivedState();
    this.toastService.info('Text cleared');
  }

  copyInput(): void {
    this.copyText(this.inputText, 'Input');
  }

  copyOutput(): void {
    this.copyText(this.outputText, 'Output');
  }

  downloadText(): void {
    if (!this.hasOutput || this.isProcessing) {
      return;
    }
    this.isExporting = true;
    this.startSimulatedProgress(85);
    const exportSessionId = ++this.downloadSessionId;
    setTimeout(() => {
      if (!this.isDownloadSessionActive(exportSessionId)) {
        return;
      }
      try {
        const blob = new Blob([this.outputText], { type: 'text/plain;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'output.txt';
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

  useOutputAsInput(): void {
    if (!this.hasOutput) {
      this.toastService.info('No output to use');
      return;
    }
    const next = this.outputText;
    this.applyInputState(next);
    this.pushToUndoStack(next);
    this.toastService.success('Output moved to input');
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
    this.fileInput.accept = '.txt,.text,.md,.json,.xml,.csv,.log,.html,text/*,application/json';
    this.fileInput.click();
  }

  protected handleUploadedFile(file: File): void {
    if (file.size === 0) {
      this.toastService.error('The file is empty. Choose a file with text content.');
      return;
    }
    if (file.size > this.maxUploadBytes) {
      this.toastService.error(`File is too large. Maximum size is ${Math.round(this.maxUploadBytes / (1024 * 1024))} MB.`);
      return;
    }

    this.cancelInFlightOperations({ forUpload: true });

    const sessionId = this.uploadSessionId;
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
        if (this.historyTimer) {
          clearTimeout(this.historyTimer);
          this.historyTimer = null;
        }
        this.applyInputState(text);
        this.pushToUndoStack(text);
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

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
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

  protected scheduleHistoryPush(value: string): void {
    this.pendingHistoryValue = value;
    if (this.historyTimer) clearTimeout(this.historyTimer);
    const wait = this.isSyncProcessMode()
      ? 0
      : value.length > WCC_LARGE_TEXT_THRESHOLD
        ? 800
        : value.length > 5000
          ? 600
          : value.length > 2000
            ? 450
            : 300;

    if (wait === 0) {
      if (!this.isRestoringHistory) this.pushToUndoStack(this.pendingHistoryValue);
      return;
    }

    this.historyTimer = setTimeout(() => {
      if (!this.isRestoringHistory) this.pushToUndoStack(this.pendingHistoryValue);
      this.historyTimer = null;
    }, wait);
  }

  protected applyInputState(value: string): void {
    if (this.historyTimer) {
      clearTimeout(this.historyTimer);
      this.historyTimer = null;
    }
    if (this.processTimer) {
      clearTimeout(this.processTimer);
      this.processTimer = null;
    }
    this.pendingHistoryValue = value;
    this.isRestoringHistory = true;
    this.inputText = value;
    this.runProcessWithLargeTextHandling();
    this.isRestoringHistory = false;
  }

  pushToUndoStack(value: string): void {
    if (this.isRestoringHistory) return;
    const last = this.undoStack[this.undoStack.length - 1];
    if (last !== undefined && last === value) return;
    this.undoStack.push(value);
    if (this.undoStack.length > 100) this.undoStack.shift();
    this.redoStack = [];
  }

  undo(): void {
    if (this.undoStack.length > 1) {
      const last = this.undoStack.pop()!;
      this.redoStack.push(last);
      const prev = this.undoStack[this.undoStack.length - 1];
      this.applyInputState(prev);
    }
  }

  redo(): void {
    if (this.redoStack.length > 0) {
      const next = this.redoStack.pop()!;
      this.undoStack.push(next);
      this.applyInputState(next);
    }
  }

  protected copyText(text: string, label: string): void {
    void tuCopyText(this.toastService, text, label);
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

  protected resetUploadFailureState(): void {
    this.isReadingFile = false;
    this.isAnalyzing = false;
    this.activeFileReader = null;
    this.clearProgressTimers();
    this.processingProgress = null;
  }
}
