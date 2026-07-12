import { Component, OnInit, OnDestroy, HostListener, inject, ViewChild, ElementRef } from '@angular/core';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Navigation, TooltipDirective, AssetService, ToastService } from '@tools-workspace/features-home';
import {
  CsvDedupeMode,
  DedupMode,
  DedupOptions,
  DedupResult,
  DEFAULT_DEDUP_OPTIONS,
  EmptyLineMode,
  KeepOccurrence,
  UnicodeForm,
  deduplicateText,
  escapeHtml,
} from './remove-duplicate-lines.utils';

type SidebarTab = 'highlights' | 'duplicates' | 'phrases' | 'diff';

@Component({
  selector: 'lib-remove-duplicate-lines',
  standalone: true,
  templateUrl: './remove-duplicate-lines.html',
  styleUrls: ['./remove-duplicate-lines.scss'],
  imports: [FormsModule, CommonModule, Navigation, ReactiveFormsModule, TooltipDirective],
})
export class RemoveDuplicateLinesComponent implements OnInit, OnDestroy {
  @ViewChild('inputTextarea') inputTextareaRef?: ElementRef<HTMLTextAreaElement>;
  @ViewChild('highlightBackdrop') highlightBackdropRef?: ElementRef<HTMLDivElement>;

  readonly assetService = inject(AssetService);
  private readonly toastService = inject(ToastService);

  inputText = '';
  result: DedupResult | null = null;
  activeSidebarTab: SidebarTab = 'highlights';
  showOptionsPanel = false;
  showSourceHighlights = true;
  editorFontSize = 16;

  dedupMode: DedupMode = DEFAULT_DEDUP_OPTIONS.mode;
  caseSensitive = DEFAULT_DEDUP_OPTIONS.caseSensitive;
  ignorePunctuation = DEFAULT_DEDUP_OPTIONS.ignorePunctuation;
  trimTokens = DEFAULT_DEDUP_OPTIONS.trimTokens;
  keepOccurrence: KeepOccurrence = DEFAULT_DEDUP_OPTIONS.keepOccurrence;
  preserveLineBreaks = DEFAULT_DEDUP_OPTIONS.preserveLineBreaks;
  ignoreStopWords = DEFAULT_DEDUP_OPTIONS.ignoreStopWords;
  detectPhrases = DEFAULT_DEDUP_OPTIONS.detectPhrases;
  phraseMinLength: 2 | 3 = DEFAULT_DEDUP_OPTIONS.phraseMinLength;
  unicodeForm: UnicodeForm = DEFAULT_DEDUP_OPTIONS.unicodeForm;
  locale = DEFAULT_DEDUP_OPTIONS.locale;
  emptyLines: EmptyLineMode = DEFAULT_DEDUP_OPTIONS.emptyLines;
  csvMode: CsvDedupeMode = DEFAULT_DEDUP_OPTIONS.csvMode;

  selectionPreview: { start: number; end: number } | null = null;

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
    return !!this.inputText.trim();
  }

  get outputText(): string {
    return this.result?.output ?? '';
  }

  get highlightedInput(): string {
    return this.result?.sidebarHighlightHtml ?? '';
  }

  get sourceHighlightHtml(): string {
    if (!this.showSourceHighlights || !this.result) return escapeHtml(this.inputText) + '\n';
    return this.result.sourceHighlightHtml;
  }

  get diffHtml(): string {
    return this.result?.diffHtml ?? '';
  }

  get canUndo(): boolean {
    return this.undoStack.length > 1;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  get selectionActive(): boolean {
    return this.selectionPreview !== null;
  }

  get wordCount(): number {
    return this.result?.wordsBefore ?? 0;
  }

  get duplicateCount(): number {
    return this.result?.uniqueDuplicateKeys ?? 0;
  }

  get removedCount(): number {
    return this.result?.totalRemoved ?? 0;
  }

  get reductionPct(): number {
    return this.result?.reductionPct ?? 0;
  }

  get wordsAfter(): number {
    return this.result?.wordsAfter ?? 0;
  }

  get linesBefore(): number {
    return this.result?.linesBefore ?? 0;
  }

  get linesAfter(): number {
    return this.result?.linesAfter ?? 0;
  }

  get duplicateEntries() {
    return this.result?.duplicateEntries ?? [];
  }

  get phraseDuplicates() {
    return this.result?.phraseDuplicates ?? [];
  }

  get removedItems(): string[] {
    return this.result?.removedItems ?? [];
  }

  get editorFontSizeStyle(): Record<string, string> {
    return { 'font-size': `${this.editorFontSize}px` };
  }

  get dedupOptions(): DedupOptions {
    return {
      mode: this.dedupMode,
      caseSensitive: this.caseSensitive,
      ignorePunctuation: this.ignorePunctuation,
      trimTokens: this.trimTokens,
      keepOccurrence: this.keepOccurrence,
      preserveLineBreaks: this.preserveLineBreaks,
      ignoreStopWords: this.ignoreStopWords,
      detectPhrases: this.detectPhrases,
      phraseMinLength: this.phraseMinLength,
      unicodeForm: this.unicodeForm,
      locale: this.locale,
      emptyLines: this.emptyLines,
      csvMode: this.csvMode,
    };
  }

  get modeLabel(): string {
    switch (this.dedupMode) {
      case 'lines':
        return 'Lines';
      case 'both':
        return 'Words + Lines';
      default:
        return 'Words';
    }
  }

  @HostListener('document:keydown', ['$event'])
  handleKeyboard(evt: KeyboardEvent): void {
    if (!this.isSourceEditorFocused()) return;

    const isMac = navigator.platform.toUpperCase().includes('MAC');
    const key = evt.key.toLowerCase();
    const undoKey = isMac ? evt.metaKey && key === 'z' && !evt.shiftKey : evt.ctrlKey && key === 'z' && !evt.shiftKey;
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
    if (this.historyTimer) clearTimeout(this.historyTimer);
    this.fileInput?.remove();
    this.fileInput = undefined;
  }

  private seedHistory(value: string): void {
    this.undoStack = [value];
    this.redoStack = [];
  }

  setSidebarTab(tab: SidebarTab): void {
    this.activeSidebarTab = tab;
  }

  onOptionsChange(): void {
    this.processInput();
  }

  setDedupMode(mode: DedupMode): void {
    this.dedupMode = mode;
    this.processInput();
  }

  private processInput(): void {
    if (!this.hasInput) {
      this.result = null;
      return;
    }

    if (this.selectionPreview) {
      const { start, end } = this.selectionPreview;
      const safeStart = Math.max(0, Math.min(start, this.inputText.length));
      const safeEnd = Math.max(safeStart, Math.min(end, this.inputText.length));
      if (safeStart === safeEnd) {
        this.selectionPreview = null;
        this.result = deduplicateText(this.inputText, this.dedupOptions);
      } else {
        const selected = this.inputText.slice(safeStart, safeEnd);
        const converted = deduplicateText(selected, this.dedupOptions).output;
        const previewOutput =
          this.inputText.slice(0, safeStart) + converted + this.inputText.slice(safeEnd);
        this.result = deduplicateText(previewOutput, this.dedupOptions);
      }
      return;
    }

    this.result = deduplicateText(this.inputText, this.dedupOptions);
  }

  onInputChange(value: string): void {
    if (this.isRestoringHistory) return;
    this.inputText = value;
    this.selectionPreview = null;
    this.processInput();
    this.scheduleHistoryPush(value);
  }

  onTextareaScroll(): void {
    const textarea = this.inputTextareaRef?.nativeElement;
    const backdrop = this.highlightBackdropRef?.nativeElement;
    if (textarea && backdrop) {
      backdrop.scrollTop = textarea.scrollTop;
      backdrop.scrollLeft = textarea.scrollLeft;
    }
  }

  private scheduleHistoryPush(value: string): void {
    this.pendingHistoryValue = value;
    if (this.historyTimer) clearTimeout(this.historyTimer);
    const wait = value.length > 5000 ? 600 : value.length > 2000 ? 450 : 300;
    this.historyTimer = setTimeout(() => {
      if (!this.isRestoringHistory) this.pushToUndoStack(this.pendingHistoryValue);
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
    this.selectionPreview = null;
    this.processInput();
    this.isRestoringHistory = false;
  }

  pushToUndoStack(value: string): void {
    if (this.isRestoringHistory) return;
    const last = this.undoStack[this.undoStack.length - 1];
    if (last === value) return;
    this.undoStack.push(value);
    if (this.undoStack.length > 100) this.undoStack.shift();
    this.redoStack = [];
  }

  undo(): void {
    if (this.undoStack.length > 1) {
      const last = this.undoStack.pop()!;
      this.redoStack.push(last);
      this.applyInputState(this.undoStack[this.undoStack.length - 1]);
    }
  }

  redo(): void {
    if (this.redoStack.length > 0) {
      const next = this.redoStack.pop()!;
      this.undoStack.push(next);
      this.applyInputState(next);
    }
  }

  convertSelectionOnly(): void {
    const textarea = this.inputTextareaRef?.nativeElement;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    if (start === end) {
      this.toastService.info('Select text in the source editor first');
      return;
    }
    this.selectionPreview = { start, end };
    this.processInput();
    this.toastService.info('Previewing selection only — edit source to reset');
  }

  applyCleanup(): void {
    if (!this.outputText) {
      this.toastService.info('Nothing to apply');
      return;
    }
    this.applyInputState(this.outputText);
    this.pushToUndoStack(this.outputText);
    this.selectionPreview = null;
    this.toastService.info('Cleanup applied to source');
  }

  copyInput(): void {
    this.copyText(this.inputText, 'Source');
  }

  copyOutput(): void {
    this.copyText(this.outputText, 'Clean output');
  }

  copyRemoved(): void {
    if (!this.removedItems.length) return;
    this.copyText(this.removedItems.join(this.dedupMode === 'lines' ? '\n' : ' '), 'Removed items');
  }

  copyAsJson(): void {
    if (!this.result) return;
    const payload = JSON.stringify(
      {
        original: this.inputText,
        cleaned: this.outputText,
        removed: this.removedItems,
        options: this.dedupOptions,
        stats: {
          removed: this.removedCount,
          reductionPct: this.reductionPct,
        },
      },
      null,
      2
    );
    navigator.clipboard.writeText(payload).then(() => this.toastService.info('Copied as JSON'));
  }

  copyAsCsv(): void {
    if (!this.result) return;
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const header = 'key,occurrences,removed';
    const rows = this.duplicateEntries.map((e) => `${escape(e.key)},${e.occurrences},${e.removed}`);
    navigator.clipboard.writeText([header, ...rows].join('\n')).then(() => this.toastService.info('Copied duplicates as CSV'));
  }

  private copyText(text: string, label: string): void {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      this.toastService.info(`${label} copied to clipboard`);
    }).catch(() => this.toastService.error('Failed to copy'));
  }

  downloadText(): void {
    if (!this.outputText) return;
    const blob = new Blob([this.outputText], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `deduplicated-${this.dedupMode}.txt`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  useOutputAsInput(): void {
    this.applyCleanup();
  }

  swapSourceOutput(): void {
    if (!this.outputText) {
      this.toastService.info('No output to swap');
      return;
    }
    this.applyInputState(this.outputText);
    this.pushToUndoStack(this.outputText);
    this.toastService.info('Output moved to source');
  }

  clear(): void {
    if (this.historyTimer) {
      clearTimeout(this.historyTimer);
      this.historyTimer = null;
    }
    this.applyInputState('');
    this.seedHistory('');
    this.result = null;
    this.toastService.info('Text cleared');
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
      this.toastService.error('Please upload a text-based file.');
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

  private isLikelyTextFile(file: File): boolean {
    const blocked = ['image/', 'video/', 'audio/', 'application/pdf', 'application/zip'];
    if (file.type && blocked.some((p) => file.type.startsWith(p))) return false;
    if (!file.type || file.type.startsWith('text/')) return true;
    const ext = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : '';
    return ['txt', 'md', 'csv', 'json', 'xml', 'html', 'log', 'yaml', 'yml'].includes(ext);
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
}
