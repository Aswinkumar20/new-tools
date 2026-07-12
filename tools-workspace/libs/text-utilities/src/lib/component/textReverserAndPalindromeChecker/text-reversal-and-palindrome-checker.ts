import { Component, OnInit, OnDestroy, HostListener, inject, ViewChild, ElementRef } from '@angular/core';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Navigation, TooltipDirective, AssetService, ToastService } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-text-reversal-and-palindrome-checker',
  standalone: true,
  templateUrl: './text-reversal-and-palindrome-checker.html',
  styleUrls: ['./text-reversal-and-palindrome-checker.scss'],
  imports: [FormsModule, CommonModule, Navigation, ReactiveFormsModule, TooltipDirective],
})
export class TextReversalAndPalindromeCheckerComponent implements OnInit, OnDestroy {
  @ViewChild('inputTextarea') inputTextareaRef?: ElementRef<HTMLTextAreaElement>;

  readonly assetService = inject(AssetService);
  private readonly toastService = inject(ToastService);

  inputText = '';
  isPalindromeMode = true;
  resultText = '';
  palindromeStatus: boolean | null = null;

  undoStack: string[] = [''];
  redoStack: string[] = [];
  private isRestoringHistory = false;
  private historyTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingHistoryValue = '';

  isReadingFile = false;
  isDragOver = false;
  readonly maxUploadBytes = 10 * 1024 * 1024;
  private fileInput?: HTMLInputElement;

  get hasInput(): boolean {
    return !!this.inputText?.trim();
  }

  get canUndo(): boolean {
    return this.undoStack.length > 1;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  get normalizedLength(): number {
    if (!this.inputText) return 0;
    return this.inputText.toLowerCase().replace(/[\W_]/g, '').length;
  }

  get outputLength(): number {
    if (this.isPalindromeMode) return this.inputText.length;
    return this.resultText.length;
  }

  get modeLabel(): string {
    return this.isPalindromeMode ? 'Palindrome' : 'Reverse';
  }

  @HostListener('document:keydown', ['$event'])
  handleKeyboard(evt: KeyboardEvent): void {
    if (!this.isSourceEditorFocused()) {
      return;
    }

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

  private isSourceEditorFocused(): boolean {
    const textarea = this.inputTextareaRef?.nativeElement;
    return !!textarea && document.activeElement === textarea;
  }

  ngOnInit(): void {
    this.seedHistory('');
  }

  ngOnDestroy(): void {
    if (this.historyTimer) {
      clearTimeout(this.historyTimer);
    }
    this.fileInput?.remove();
    this.fileInput = undefined;
  }

  private seedHistory(value: string): void {
    this.undoStack = [value];
    this.redoStack = [];
  }

  onInputChange(): void {
    if (this.isRestoringHistory) {
      return;
    }
    this.runAnalysis();
    this.scheduleHistoryPush(this.inputText);
  }

  private runAnalysis(): void {
    if (this.isPalindromeMode) {
      this.checkPalindrome();
    } else {
      this.reverseText();
    }
  }

  setMode(mode: 'palindrome' | 'reverse'): void {
    const nextIsPalindrome = mode === 'palindrome';
    if (this.isPalindromeMode === nextIsPalindrome) return;
    this.isPalindromeMode = nextIsPalindrome;
    this.resultText = '';
    this.palindromeStatus = null;
    if (this.inputText) {
      this.runAnalysis();
    }
  }

  clear(): void {
    if (this.historyTimer) {
      clearTimeout(this.historyTimer);
      this.historyTimer = null;
    }
    this.applyInputState('');
    this.seedHistory('');
    this.toastService.info('Text cleared');
  }

  copyInput(): void {
    this.copyText(this.inputText, 'Input');
  }

  copyOutput(): void {
    if (this.isPalindromeMode) {
      this.copyPalindromeVerdict();
      return;
    }
    this.copyText(this.resultText, 'Reversed text');
  }

  copyPalindromeVerdict(): void {
    if (this.palindromeStatus === null) return;
    const verdict = this.palindromeStatus ? 'Palindrome' : 'Not a palindrome';
    this.copyText(`${verdict}: ${this.inputText}`, 'Result');
  }

  downloadText(): void {
    if (!this.resultText) return;
    const blob = new Blob([this.resultText], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'reversed.txt';
    link.click();
    URL.revokeObjectURL(link.href);
    this.toastService.info('Downloaded reversed.txt');
  }

  useOutputAsInput(): void {
    if (!this.resultText) {
      this.toastService.info('No output to use');
      return;
    }
    const next = this.resultText;
    this.applyInputState(next);
    this.pushToUndoStack(next);
    this.toastService.info('Output moved to input');
  }

  swapInputOutput(): void {
    if (this.isPalindromeMode) {
      if (!this.inputText) {
        this.toastService.info('Nothing to reverse');
        return;
      }
      const reversed = this.inputText.split('').reverse().join('');
      this.applyInputState(reversed);
      this.pushToUndoStack(reversed);
      this.toastService.info('Input reversed');
      return;
    }

    if (!this.resultText && !this.inputText) {
      this.toastService.info('Nothing to swap');
      return;
    }

    const tmp = this.inputText;
    this.applyInputState(this.resultText || '');
    this.resultText = tmp;
    this.toastService.info('Input and output swapped');
  }

  loadSample(text: string): void {
    this.applyInputState(text);
    this.pushToUndoStack(text);
    this.toastService.info('Sample loaded');
  }

  uploadTextFile(): void {
    if (!this.fileInput) {
      this.fileInput = document.createElement('input');
      this.fileInput.type = 'file';
      this.fileInput.style.display = 'none';
      this.fileInput.addEventListener('change', () => {
        const file = this.fileInput?.files?.[0];
        if (file) {
          this.handleUploadedFile(file);
        }
        if (this.fileInput) {
          this.fileInput.value = '';
        }
      });
      document.body.appendChild(this.fileInput);
    }

    this.fileInput.accept =
      '.txt,.text,.md,.markdown,.csv,.json,.xml,.html,.htm,.log,.yaml,.yml,.rtf,.tsv,text/*,application/json,application/xml';
    this.fileInput.click();
  }

  private handleUploadedFile(file: File): void {
    if (file.size > this.maxUploadBytes) {
      this.toastService.error(`File is too large. Maximum size is ${Math.round(this.maxUploadBytes / (1024 * 1024))} MB.`);
      return;
    }

    if (!this.isLikelyTextFile(file)) {
      this.toastService.error('Please upload a text-based file (.txt, .md, .csv, .json, etc.).');
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
      this.toastService.error('Could not read the file. Please try another text file.');
    };

    reader.readAsText(file);
  }

  private isLikelyTextFile(file: File): boolean {
    const blockedTypes = ['image/', 'video/', 'audio/', 'application/pdf', 'application/zip', 'application/x-zip-compressed'];
    if (file.type && blockedTypes.some((prefix) => file.type.startsWith(prefix) || file.type === prefix)) {
      return false;
    }
    if (!file.type || file.type.startsWith('text/')) {
      return true;
    }
    const allowedTypes = new Set([
      'application/json', 'application/xml', 'application/javascript',
      'application/x-yaml', 'application/yaml', 'application/csv', 'application/rtf', 'application/octet-stream',
    ]);
    if (allowedTypes.has(file.type)) {
      return true;
    }
    const ext = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : '';
    const textExtensions = new Set([
      'txt', 'text', 'md', 'markdown', 'csv', 'json', 'xml', 'html', 'htm', 'log',
      'yaml', 'yml', 'rtf', 'tsv', 'ini', 'cfg', 'conf', 'js', 'ts', 'css', 'scss',
    ]);
    return textExtensions.has(ext);
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
    if (file) {
      this.handleUploadedFile(file);
    }
  }

  private scheduleHistoryPush(value: string): void {
    this.pendingHistoryValue = value;
    if (this.historyTimer) {
      clearTimeout(this.historyTimer);
    }
    const wait = value.length > 5000 ? 600 : value.length > 2000 ? 450 : 300;
    this.historyTimer = setTimeout(() => {
      if (!this.isRestoringHistory) {
        this.pushToUndoStack(this.pendingHistoryValue);
      }
      this.historyTimer = null;
    }, wait);
  }

  private applyInputState(value: string): void {
    if (this.historyTimer) {
      clearTimeout(this.historyTimer);
      this.historyTimer = null;
    }
    this.pendingHistoryValue = value;
    this.isRestoringHistory = true;
    this.inputText = value;
    this.runAnalysis();
    this.isRestoringHistory = false;
  }

  pushToUndoStack(value: string): void {
    if (this.isRestoringHistory) {
      return;
    }
    const last = this.undoStack[this.undoStack.length - 1];
    if (last !== undefined && last === value) {
      return;
    }
    this.undoStack.push(value);
    if (this.undoStack.length > 100) {
      this.undoStack.shift();
    }
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

  private copyText(text: string, label: string): void {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      this.toastService.info(`${label} copied to clipboard`);
    }).catch(() => {
      this.toastService.error('Failed to copy to clipboard');
    });
  }

  private reverseText(): void {
    this.resultText = this.inputText.split('').reverse().join('');
    this.palindromeStatus = null;
  }

  private checkPalindrome(): void {
    const normalized = this.inputText.toLowerCase().replace(/[\W_]/g, '');
    const reversed = normalized.split('').reverse().join('');
    this.palindromeStatus = normalized.length > 0 && normalized === reversed;
    this.resultText = '';
  }
}
