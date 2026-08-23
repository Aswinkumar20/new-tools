import { Component, OnInit, OnDestroy, HostListener, inject, ViewChild, ElementRef } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Navigation, TooltipDirective, AssetService, ToastService } from '@tools-workspace/features-home';
import type { TuRelatedToolLink, TuToolSuggestion } from '../../shared/tu-tool-suggestion.model';
import {
  SLUG_DEFAULT_REMOVE_NUMBERS,
  SLUG_DEFAULT_SEPARATOR,
  SLUG_HISTORY_LIMIT,
  SLUG_MAX_UPLOAD_BYTES,
  SLUG_RELATED_TOOLS,
  SLUG_SEPARATOR_OPTIONS,
} from '../../constants/slug-generator.constants';
import type { SlugSeparator, SlugSeparatorOption } from '../../types/slug-generator.types';
import {
  generateSlug,
  inputLooksLikeSlug,
  inputLooksLikeUrl,
  resolveSlugSuggestion,
} from '../../utils/slug-generator.utils';

@Component({
  selector: 'lib-slug-generator',
  standalone: true,
  templateUrl: './slug-generator.html',
  styleUrls: ['./slug-generator.scss'],
  imports: [FormsModule, CommonModule, RouterLink, Navigation, ReactiveFormsModule, TooltipDirective],
})
export class SlugGeneratorComponent implements OnInit, OnDestroy {
  @ViewChild('inputTextarea') inputTextareaRef?: ElementRef<HTMLTextAreaElement>;

  readonly assetService = inject(AssetService);
  private readonly toastService = inject(ToastService);

  readonly relatedTools: ReadonlyArray<TuRelatedToolLink> = SLUG_RELATED_TOOLS;
  readonly separatorOptions: ReadonlyArray<SlugSeparatorOption> = SLUG_SEPARATOR_OPTIONS;
  private dismissedSuggestionId: string | null = null;

  inputText = '';
  slug = '';
  separator = SLUG_DEFAULT_SEPARATOR;
  removeNumbers = SLUG_DEFAULT_REMOVE_NUMBERS;
  slugHistory: string[] = [];
  showOptionsPanel = false;

  undoStack: string[] = [''];
  redoStack: string[] = [];
  private isRestoringHistory = false;
  private historyTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingHistoryValue = '';

  isReadingFile = false;
  isDragOver = false;
  readonly maxUploadBytes = SLUG_MAX_UPLOAD_BYTES;
  private fileInput?: HTMLInputElement;

  get hasInput(): boolean {
    return !!this.inputText.trim();
  }

  get hasOutput(): boolean {
    return !!this.slug;
  }

  get canUndo(): boolean {
    return this.undoStack.length > 1;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  get separatorLabel(): string {
    const found = this.separatorOptions.find((o) => o.value === this.separator);
    return found?.label ?? this.separator;
  }

  get primarySuggestion(): TuToolSuggestion | null {
    const suggestion = resolveSlugSuggestion({
      hasInput: this.hasInput,
      hasSlug: this.hasOutput,
      slugLength: this.slug.length,
      separator: this.separator,
      removeNumbers: this.removeNumbers,
      inputLooksLikeUrl: inputLooksLikeUrl(this.inputText),
      inputLooksLikeSlug: inputLooksLikeSlug(this.inputText),
    });
    if (!suggestion || this.dismissedSuggestionId === suggestion.id) {
      return null;
    }
    return suggestion;
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId = suggestionId;
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

  setSeparator(value: SlugSeparator): void {
    if (this.separator === value) return;
    this.separator = value;
    this.onOptionsChange();
  }

  onInputChange(): void {
    if (this.isRestoringHistory) {
      return;
    }
    this.dismissedSuggestionId = null;
    this.runSlugGeneration();
    this.scheduleHistoryPush(this.inputText);
  }

  onOptionsChange(): void {
    this.dismissedSuggestionId = null;
    this.runSlugGeneration();
  }

  private runSlugGeneration(): void {
    this.slug = generateSlug({
      text: this.inputText,
      separator: this.separator,
      removeNumbers: this.removeNumbers,
    });
    if (this.slug && !this.slugHistory.includes(this.slug)) {
      this.slugHistory.unshift(this.slug);
      if (this.slugHistory.length > SLUG_HISTORY_LIMIT) {
        this.slugHistory.pop();
      }
    }
  }

  clear(): void {
    if (this.historyTimer) {
      clearTimeout(this.historyTimer);
      this.historyTimer = null;
    }
    this.applyInputState('');
    this.seedHistory('');
    this.dismissedSuggestionId = null;
    this.toastService.info('Text cleared');
  }

  clearHistory(): void {
    this.slugHistory = [];
    this.toastService.info('Slug history cleared');
  }

  copyInput(): void {
    this.copyText(this.inputText, 'Source');
  }

  copySlug(): void {
    this.copyText(this.slug, 'Slug');
  }

  copyHistoryItem(item: string): void {
    this.copyText(item, 'Slug');
  }

  downloadText(): void {
    if (!this.slug) return;
    const blob = new Blob([this.slug], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'slug.txt';
    link.click();
    URL.revokeObjectURL(link.href);
    this.toastService.info('Downloaded slug.txt');
  }

  useOutputAsInput(): void {
    if (!this.slug) {
      this.toastService.info('No slug to use');
      return;
    }
    const next = this.slug;
    this.applyInputState(next);
    this.pushToUndoStack(next);
    this.toastService.info('Slug moved to input');
  }

  swapInputOutput(): void {
    if (!this.slug && !this.hasInput) {
      this.toastService.info('Nothing to swap');
      return;
    }

    const previousInput = this.inputText;
    const previousSlug = this.slug;

    if (previousSlug) {
      this.isRestoringHistory = true;
      this.inputText = previousSlug;
      this.slug = previousInput;
      this.isRestoringHistory = false;
    } else {
      this.runSlugGeneration();
    }

    this.dismissedSuggestionId = null;
    this.pushToUndoStack(this.inputText);
    this.toastService.info('Input and slug swapped');
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
      this.dismissedSuggestionId = null;
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
    this.runSlugGeneration();
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
