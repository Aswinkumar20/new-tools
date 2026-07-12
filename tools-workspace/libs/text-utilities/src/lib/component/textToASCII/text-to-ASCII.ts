import { Component, OnInit, OnDestroy, HostListener, inject, ViewChild, ElementRef } from '@angular/core';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Navigation, ToastService, AssetService, TooltipDirective } from '@tools-workspace/features-home';

interface FormatOption {
  value: string;
  label: string;
  description: string;
}

@Component({
  selector: 'lib-text-to-ascii',
  standalone: true,
  templateUrl: './text-to-ASCII.html',
  styleUrls: ['./text-to-ASCII.scss'],
  imports: [FormsModule, CommonModule, Navigation, ReactiveFormsModule, TooltipDirective],
})
export class TextToASCIIComponent implements OnInit, OnDestroy {
  @ViewChild('inputTextarea') inputTextareaRef?: ElementRef<HTMLTextAreaElement>;

  inputValue = '';
  outputValue = '';
  errorMessage = '';
  isConverting = false;

  leftType = 'text';
  rightType = 'ascii';

  undoStack: string[] = [''];
  redoStack: string[] = [];
  private isRestoringHistory = false;
  private historyTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingHistoryValue = '';

  isReadingFile = false;
  isDragOver = false;
  readonly maxUploadBytes = 10 * 1024 * 1024;
  private fileInput?: HTMLInputElement;

  private convertTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly DEBOUNCE_DELAY = 300;

  private readonly toastService = inject(ToastService);
  readonly assetService = inject(AssetService);

  readonly typeOptions: FormatOption[] = [
    { value: 'text', label: 'Text', description: 'Plain readable text.' },
    { value: 'ascii', label: 'ASCII', description: 'ASCII codes representing each character.' },
    { value: 'binary', label: 'Binary', description: 'Binary representation (0s and 1s) of text.' },
    { value: 'hex', label: 'Hex', description: 'Hexadecimal representation of text.' },
  ];

  get hasInput(): boolean {
    return !!this.inputValue?.trim();
  }

  get canUndo(): boolean {
    return this.undoStack.length > 1;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  get fromLabel(): string {
    return this.typeOptions.find((o) => o.value === this.leftType)?.label ?? this.leftType;
  }

  get toLabel(): string {
    return this.typeOptions.find((o) => o.value === this.rightType)?.label ?? this.rightType;
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
    if (this.convertTimer) {
      clearTimeout(this.convertTimer);
    }
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

  convert(): void {
    this.errorMessage = '';
    this.outputValue = '';
    this.isConverting = true;

    try {
      const raw = this.inputValue ?? '';
      const trimmed = raw.trim();

      if (!trimmed) {
        this.outputValue = '';
        return;
      }

      if (this.leftType === this.rightType) {
        this.outputValue = trimmed;
        return;
      }

      if (!this.isValidType(this.leftType) || !this.isValidType(this.rightType)) {
        throw new Error('Invalid conversion type selected.');
      }

      let text: string;
      switch (this.leftType) {
        case 'text':
          text = trimmed;
          break;
        case 'ascii':
          text = this.asciiToText(trimmed);
          break;
        case 'binary':
          text = this.binaryToText(trimmed);
          break;
        case 'hex':
          text = this.hexToText(trimmed);
          break;
        default:
          throw new Error('Invalid input type selected.');
      }

      if (text === null || text === undefined) {
        throw new Error('Failed to convert input to text. Please check your input format.');
      }

      switch (this.rightType) {
        case 'text':
          this.outputValue = text;
          break;
        case 'ascii':
          this.outputValue = this.textToAscii(text);
          break;
        case 'binary':
          this.outputValue = this.textToBinary(text);
          break;
        case 'hex':
          this.outputValue = this.textToHex(text);
          break;
        default:
          throw new Error('Invalid output type selected.');
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Invalid input for the selected conversion. Please check the format and try again.';
      this.errorMessage = message;
      this.outputValue = '';
    } finally {
      this.isConverting = false;
    }
  }

  private isValidType(type: string): boolean {
    return this.typeOptions.some((opt) => opt.value === type);
  }

  onInputChange(): void {
    if (this.isRestoringHistory) {
      return;
    }

    if (this.convertTimer) {
      clearTimeout(this.convertTimer);
    }

    this.errorMessage = '';
    this.isConverting = true;

    this.convertTimer = setTimeout(() => {
      if (this.inputValue && this.inputValue.trim()) {
        this.convert();
      } else {
        this.outputValue = '';
        this.isConverting = false;
      }
    }, this.DEBOUNCE_DELAY);

    this.scheduleHistoryPush(this.inputValue);
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
    if (this.convertTimer) {
      clearTimeout(this.convertTimer);
      this.convertTimer = null;
    }
    this.pendingHistoryValue = value;
    this.isRestoringHistory = true;
    this.inputValue = value;
    this.errorMessage = '';
    if (value.trim()) {
      this.isConverting = true;
      this.convert();
    } else {
      this.outputValue = '';
      this.isConverting = false;
    }
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

  onFormatChange(): void {
    if (this.convertTimer) {
      clearTimeout(this.convertTimer);
      this.convertTimer = null;
    }

    this.errorMessage = '';

    if (this.inputValue && this.inputValue.trim()) {
      this.isConverting = true;
      this.convert();
    } else {
      this.outputValue = '';
      this.isConverting = false;
    }
  }

  swapTypes(): void {
    const tmpType = this.leftType;
    this.leftType = this.rightType;
    this.rightType = tmpType;

    const tmpValue = this.inputValue;
    this.inputValue = this.outputValue;
    this.outputValue = tmpValue;

    this.errorMessage = '';

    if (this.convertTimer) {
      clearTimeout(this.convertTimer);
      this.convertTimer = null;
    }

    this.toastService.info('Formats swapped');

    if (this.inputValue && this.inputValue.trim()) {
      this.isConverting = true;
      setTimeout(() => this.convert(), 0);
    } else {
      this.outputValue = '';
      this.isConverting = false;
    }
  }

  useOutputAsInput(): void {
    if (!this.outputValue) {
      this.toastService.info('No output to use');
      return;
    }
    const next = this.outputValue;
    this.applyInputState(next);
    this.pushToUndoStack(next);
    this.toastService.info('Output moved to input');
  }

  getTypeDescription(type: string): string {
    const found = this.typeOptions.find((opt) => opt.value === type);
    return found ? found.description : '';
  }

  clear(): void {
    if (this.historyTimer) {
      clearTimeout(this.historyTimer);
      this.historyTimer = null;
    }
    if (this.convertTimer) {
      clearTimeout(this.convertTimer);
      this.convertTimer = null;
    }
    this.applyInputState('');
    this.seedHistory('');
    this.errorMessage = '';
    this.isConverting = false;
    this.toastService.info('Text cleared');
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

  copyInput(): void {
    this.copyText(this.inputValue, 'Input');
  }

  copyOutput(): void {
    this.copyText(this.outputValue, 'Output');
  }

  downloadText(): void {
    if (!this.outputValue) return;
    const ext = this.rightType === 'text' ? 'txt' : this.rightType;
    const blob = new Blob([this.outputValue], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `output.${ext}`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  private copyText(text: string, label: string): void {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      this.toastService.info(`${label} copied to clipboard`);
    }).catch(() => {
      this.toastService.error('Failed to copy to clipboard');
    });
  }

  textToAscii(text: string): string {
    if (!text) return '';
    return text.split('').map((c) => c.charCodeAt(0)).join(' ');
  }

  asciiToText(ascii: string): string {
    if (!ascii || !ascii.trim()) {
      throw new Error('ASCII input cannot be empty.');
    }
    const trimmed = ascii.trim();
    const parts = trimmed.split(/\s+/).filter((p) => p.length > 0);

    if (parts.length === 0) {
      throw new Error('ASCII input must contain at least one number.');
    }

    if (!parts.every((p) => /^\d+$/.test(p))) {
      throw new Error('ASCII must contain only numbers separated by spaces (e.g., "72 101 108 108 111").');
    }

    const invalidCodes = parts.filter((p) => {
      const num = Number(p);
      return isNaN(num) || num < 0 || num > 65535;
    });

    if (invalidCodes.length > 0) {
      throw new Error(`Invalid ASCII code(s): ${invalidCodes.join(', ')}. Codes must be between 0 and 65535.`);
    }

    return parts.map((p) => String.fromCharCode(Number(p))).join('');
  }

  textToBinary(text: string): string {
    return text.split('').map((c) => c.charCodeAt(0).toString(2).padStart(8, '0')).join(' ');
  }

  binaryToText(binary: string): string {
    if (!binary || !binary.trim()) {
      throw new Error('Binary input cannot be empty.');
    }
    const trimmed = binary.trim();
    const parts = trimmed.split(/\s+/).filter((p) => p.length > 0);

    if (parts.length === 0) {
      throw new Error('Binary input must contain at least one binary number.');
    }

    if (!parts.every((b) => /^[01]+$/.test(b))) {
      throw new Error('Binary must contain only 0s and 1s, separated by spaces (e.g., "01001000 01100101").');
    }

    try {
      return parts.map((b) => {
        const charCode = parseInt(b, 2);
        if (isNaN(charCode) || charCode < 0 || charCode > 65535) {
          throw new Error(`Invalid binary value: ${b}`);
        }
        return String.fromCharCode(charCode);
      }).join('');
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Invalid binary format. Each binary number should represent a valid character code.';
      throw new Error(message);
    }
  }

  textToHex(text: string): string {
    return text.split('').map((c) => c.charCodeAt(0).toString(16).padStart(2, '0')).join(' ');
  }

  hexToText(hex: string): string {
    if (!hex || !hex.trim()) {
      throw new Error('Hexadecimal input cannot be empty.');
    }
    const trimmed = hex.trim();
    const parts = trimmed.split(/\s+/).filter((p) => p.length > 0);

    if (parts.length === 0) {
      throw new Error('Hexadecimal input must contain at least one hex value.');
    }

    if (!parts.every((h) => /^[0-9a-fA-F]+$/.test(h))) {
      throw new Error('Hexadecimal must contain only 0-9 and A-F (case-insensitive), separated by spaces (e.g., "48 65 6C 6C 6F").');
    }

    try {
      return parts.map((h) => {
        const charCode = parseInt(h, 16);
        if (isNaN(charCode) || charCode < 0 || charCode > 65535) {
          throw new Error(`Invalid hex value: ${h}`);
        }
        return String.fromCharCode(charCode);
      }).join('');
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Invalid hexadecimal format. Each hex value should represent a valid character code.';
      throw new Error(message);
    }
  }
}
