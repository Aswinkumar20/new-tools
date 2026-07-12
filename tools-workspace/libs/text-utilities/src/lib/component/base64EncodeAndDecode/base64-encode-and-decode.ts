import { Component, OnInit, OnDestroy, HostListener, inject, ViewChild, ElementRef } from '@angular/core';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Navigation, TooltipDirective, AssetService, ToastService } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-base64-encode-and-decode',
  standalone: true,
  templateUrl: './base64-encode-and-decode.html',
  styleUrls: ['./base64-encode-and-decode.scss'],
  imports: [FormsModule, CommonModule, Navigation, ReactiveFormsModule, TooltipDirective],
})
export class Base64EncodeAndDecodeComponent implements OnInit, OnDestroy {
  @ViewChild('inputTextarea') inputTextareaRef?: ElementRef<HTMLTextAreaElement>;

  readonly assetService = inject(AssetService);
  private readonly toastService = inject(ToastService);

  inputText = '';
  outputText = '';
  errorMessage = '';
  mode: 'encode' | 'decode' = 'encode';

  undoStack: string[] = [''];
  redoStack: string[] = [];
  private isRestoringHistory = false;
  private historyTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingHistoryValue = '';

  isReadingFile = false;
  isDragOver = false;
  readonly maxUploadBytes = 10 * 1024 * 1024;
  private fileInput?: HTMLInputElement;

  get modeLabel(): string {
    return this.mode === 'encode' ? 'Encode' : 'Decode';
  }

  get inputLabel(): string {
    return this.mode === 'encode' ? 'Source text' : 'Base64 input';
  }

  get outputLabel(): string {
    return this.mode === 'encode' ? 'Base64 output' : 'Decoded text';
  }

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

  get sizeDelta(): number {
    if (!this.hasOutput || !this.inputText) return 0;
    return this.outputText.length - this.inputText.length;
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

  selectMode(selectedMode: 'encode' | 'decode'): void {
    if (this.mode === selectedMode) return;

    const previousOutput = this.hasOutput ? this.outputText : '';
    this.mode = selectedMode;

    if (previousOutput) {
      this.applyInputState(previousOutput);
      this.pushToUndoStack(previousOutput);
      this.toastService.info(`Switched to ${this.modeLabel} mode`);
      return;
    }

    if (this.inputText) {
      this.runConversion();
    } else {
      this.outputText = '';
      this.errorMessage = '';
    }
  }

  onInputChange(): void {
    if (this.isRestoringHistory) {
      return;
    }
    this.runConversion();
    this.scheduleHistoryPush(this.inputText);
  }

  private runConversion(): void {
    if (this.mode === 'encode') {
      this.encodeText();
    } else {
      this.decodeText();
    }
  }

  private encodeText(): void {
    this.errorMessage = '';
    if (!this.inputText) {
      this.outputText = '';
      return;
    }
    try {
      this.outputText = this.utf8ToBase64(this.inputText);
    } catch {
      this.outputText = '';
      this.errorMessage = 'Invalid input for encoding.';
    }
  }

  private decodeText(): void {
    this.errorMessage = '';
    if (!this.inputText) {
      this.outputText = '';
      return;
    }
    try {
      const trimmed = this.inputText.trim();
      this.outputText = this.base64ToUtf8(trimmed);
    } catch {
      this.outputText = '';
      this.errorMessage = 'Invalid Base64 string. Check padding and characters.';
    }
  }

  private utf8ToBase64(text: string): string {
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    bytes.forEach((b) => {
      binary += String.fromCharCode(b);
    });
    return btoa(binary);
  }

  private base64ToUtf8(base64: string): string {
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  clear(): void {
    if (this.historyTimer) {
      clearTimeout(this.historyTimer);
      this.historyTimer = null;
    }
    this.applyInputState('');
    this.seedHistory('');
    this.errorMessage = '';
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
    const ext = this.mode === 'encode' ? 'b64.txt' : 'txt';
    const blob = new Blob([this.outputText], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `output.${ext}`;
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

  swapInputOutput(): void {
    if (!this.hasOutput && !this.hasInput) {
      this.toastService.info('Nothing to swap');
      return;
    }

    const previousInput = this.inputText;
    const previousOutput = this.hasOutput ? this.outputText : '';

    this.mode = this.mode === 'encode' ? 'decode' : 'encode';

    if (previousOutput) {
      this.isRestoringHistory = true;
      this.inputText = previousOutput;
      this.outputText = previousInput;
      this.errorMessage = '';
      this.isRestoringHistory = false;
    } else {
      this.runConversion();
    }

    this.pushToUndoStack(this.inputText);
    this.toastService.info('Mode and values swapped');
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
      '.txt,.text,.b64,.md,.json,.xml,.csv,.log,text/*,application/json,application/xml';
    this.fileInput.click();
  }

  private handleUploadedFile(file: File): void {
    if (file.size > this.maxUploadBytes) {
      this.toastService.error(`File is too large. Maximum size is ${Math.round(this.maxUploadBytes / (1024 * 1024))} MB.`);
      return;
    }

    if (!this.isLikelyTextFile(file)) {
      this.toastService.error('Please upload a text-based file (.txt, .b64, .json, etc.).');
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
      'txt', 'text', 'b64', 'base64', 'md', 'markdown', 'csv', 'json', 'xml', 'html', 'htm', 'log',
      'yaml', 'yml', 'rtf', 'tsv', 'ini', 'cfg', 'conf',
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
    this.runConversion();
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
}
