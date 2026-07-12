import { OnDestroy, OnInit, HostListener, inject, ViewChild, ElementRef, Directive } from '@angular/core';
import { AssetService, ToastService } from '@tools-workspace/features-home';

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
  private historyTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingHistoryValue = '';

  isReadingFile = false;
  isDragOver = false;
  readonly maxUploadBytes = 10 * 1024 * 1024;
  private fileInput?: HTMLInputElement;

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
    this.fileInput?.remove();
    this.fileInput = undefined;
  }

  protected seedHistory(value: string): void {
    this.undoStack = [value];
    this.redoStack = [];
  }

  onInputChange(): void {
    if (this.isRestoringHistory) return;
    this.runProcess();
    this.scheduleHistoryPush(this.inputText);
  }

  onOptionsChange(): void {
    this.runProcess();
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
    if (!this.hasOutput) return;
    const blob = new Blob([this.outputText], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'output.txt';
    link.click();
    URL.revokeObjectURL(link.href);
    this.toastService.info('Download started');
  }

  useOutputAsInput(): void {
    if (!this.hasOutput) {
      this.toastService.info('No output to use');
      return;
    }
    const next = this.outputText;
    this.applyInputState(next);
    this.pushToUndoStack(next);
    this.toastService.info('Output moved to input');
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
    if (file.size > this.maxUploadBytes) {
      this.toastService.error(`File is too large. Maximum size is ${Math.round(this.maxUploadBytes / (1024 * 1024))} MB.`);
      return;
    }
    this.isReadingFile = true;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      if (this.historyTimer) {
        clearTimeout(this.historyTimer);
        this.historyTimer = null;
      }
      this.applyInputState(text);
      this.pushToUndoStack(text);
      this.isReadingFile = false;
      this.toastService.info(`Loaded "${file.name}"`);
    };
    reader.onerror = () => {
      this.isReadingFile = false;
      this.toastService.error('Could not read the file.');
    };
    reader.readAsText(file);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
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
    const file = event.dataTransfer?.files?.[0];
    if (file) this.handleUploadedFile(file);
  }

  protected scheduleHistoryPush(value: string): void {
    this.pendingHistoryValue = value;
    if (this.historyTimer) clearTimeout(this.historyTimer);
    const wait = value.length > 5000 ? 600 : value.length > 2000 ? 450 : 300;
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
    this.pendingHistoryValue = value;
    this.isRestoringHistory = true;
    this.inputText = value;
    this.runProcess();
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
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      this.toastService.info(`${label} copied to clipboard`);
    }).catch(() => {
      this.toastService.error('Failed to copy to clipboard');
    });
  }
}
