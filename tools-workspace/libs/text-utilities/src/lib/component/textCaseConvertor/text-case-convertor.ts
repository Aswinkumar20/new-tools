import { Component, OnInit, OnDestroy, HostListener, inject, ViewChild, ElementRef } from '@angular/core';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Navigation, TooltipDirective, AssetService, ToastService } from '@tools-workspace/features-home';
import {
  AP_SMALL_WORDS,
  CHICAGO_SMALL_WORDS,
  DEFAULT_FAVORITES,
  DEFAULT_TITLE_EXCEPTIONS,
  PROGRAMMING_CYCLE,
} from './text-case-convertor.constants';
import {
  ALL_PRESETS,
  CaseId,
  CasePreset,
  ConvertOptions,
  CustomRule,
  EscapeMode,
  UnicodeForm,
  convertCase,
  detectCase,
  getPresetsByCategory,
  isValidIdentifier,
} from './text-case-convertor.converters';

@Component({
  selector: 'lib-text-case-convertor',
  standalone: true,
  templateUrl: './text-case-convertor.html',
  styleUrls: ['./text-case-convertor.scss'],
  imports: [FormsModule, CommonModule, Navigation, ReactiveFormsModule, TooltipDirective],
})
export class TextCaseConvertorComponent implements OnInit, OnDestroy {
  @ViewChild('inputTextarea') inputTextareaRef?: ElementRef<HTMLTextAreaElement>;

  inputText = '';
  convertedText = '';
  selectedCase: CaseId = 'upper';
  screenReaderMessage = '';

  charCount = 0;
  wordCount = 0;

  undoStack: string[] = [''];
  redoStack: string[] = [];
  private isRestoringHistory = false;
  private historyTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingHistoryValue = '';

  isReadingFile = false;
  isDragOver = false;
  readonly maxUploadBytes = 10 * 1024 * 1024;
  private fileInput?: HTMLInputElement;

  activePresetTab: 'standard' | 'programming' | 'fun' | 'favorites' = 'standard';
  presetSearch = '';
  favoritePresets: CaseId[] = [...DEFAULT_FAVORITES];
  recentPresets: CaseId[] = [];

  batchLineMode = false;
  preserveLineBreaks = true;
  showOptionsPanel = false;
  selectionPreview: { start: number; end: number } | null = null;

  locale = 'en';
  unicodeForm: UnicodeForm = 'none';
  escapeMode: EscapeMode = 'none';
  randomSeed = 42;
  titleStyle: 'ap' | 'chicago' = 'ap';
  titleExceptionsText = DEFAULT_TITLE_EXCEPTIONS.join(', ');
  smallWordsText = Array.from(AP_SMALL_WORDS).join(', ');
  customRules: CustomRule[] = [{ pattern: '', replacement: 'upper' }];
  identifierLang: 'js' | 'python' = 'js';
  editorFontSize = 16;

  readonly standardPresets = getPresetsByCategory('standard');
  readonly programmingPresets = getPresetsByCategory('programming');
  readonly funPresets = getPresetsByCategory('fun');
  readonly allPresets = ALL_PRESETS;

  readonly assetService = inject(AssetService);
  private readonly toastService = inject(ToastService);

  get canUndo(): boolean {
    return this.undoStack.length > 1;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  get hasContent(): boolean {
    return this.inputText.trim().length > 0;
  }

  get selectedCaseLabel(): string {
    return ALL_PRESETS.find((p) => p.id === this.selectedCase)?.label ?? this.selectedCase;
  }

  get detectedCaseLabel(): string {
    const sample = this.inputText.trim().split(/\n/)[0]?.trim() ?? '';
    const detected = detectCase(sample);
    return detected === 'unknown' ? '' : detected;
  }

  get identifierWarning(): string {
    if (!this.convertedText.trim()) return '';
    const lines = this.convertedText.trim().split(/\n/);
    const first = lines[0]?.trim() ?? '';
    if (!first || first.includes(' ')) return '';
    return isValidIdentifier(first, this.identifierLang) ? '' : `Not a valid ${this.identifierLang.toUpperCase()} identifier`;
  }

  get shortcutPresets(): CasePreset[] {
    return this.favoritePresets
      .slice(0, 5)
      .map((id) => ALL_PRESETS.find((p) => p.id === id))
      .filter((p): p is CasePreset => !!p);
  }

  get activePresets(): CasePreset[] {
    if (this.activePresetTab === 'favorites') {
      return this.favoritePresets
        .map((id) => ALL_PRESETS.find((p) => p.id === id))
        .filter((p): p is CasePreset => !!p);
    }
    const base =
      this.activePresetTab === 'programming'
        ? this.programmingPresets
        : this.activePresetTab === 'fun'
          ? this.funPresets
          : this.standardPresets;
    return this.filterPresets(base);
  }

  get filteredAllPresets(): CasePreset[] {
    return this.filterPresets(ALL_PRESETS);
  }

  get editorFontSizeStyle(): Record<string, string> {
    return { 'font-size': `${this.editorFontSize}px` };
  }

  get convertOptions(): ConvertOptions {
    const smallWords = new Set(
      this.smallWordsText
        .split(/[,;\s]+/)
        .map((w) => w.trim().toLowerCase())
        .filter(Boolean)
    );
    const titleExceptions = this.titleExceptionsText
      .split(/[,;\n]+/)
      .map((w) => w.trim())
      .filter(Boolean);

    return {
      locale: this.locale,
      smallWords: smallWords.size ? smallWords : this.titleStyle === 'chicago' ? CHICAGO_SMALL_WORDS : AP_SMALL_WORDS,
      titleExceptions,
      randomSeed: this.randomSeed,
      unicodeForm: this.unicodeForm,
      customRules: this.customRules.filter((r) => r.pattern.trim()),
      escapeMode: this.escapeMode,
    };
  }

  private filterPresets(presets: CasePreset[]): CasePreset[] {
    const q = this.presetSearch.trim().toLowerCase();
    if (!q) return presets;
    return presets.filter(
      (p) => p.label.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)
    );
  }

  setPresetTab(tab: 'standard' | 'programming' | 'fun' | 'favorites'): void {
    this.activePresetTab = tab;
  }

  get selectionActive(): boolean {
    return this.selectionPreview !== null;
  }

  get zalgoLengthWarning(): string {
    if (this.selectedCase !== 'zalgo' || this.inputText.length <= 200) return '';
    return 'Zalgo works best on shorter text (200+ chars may be slow)';
  }

  getPresetLabel(id: CaseId): string {
    return ALL_PRESETS.find((p) => p.id === id)?.label ?? id;
  }

  isFavorite(id: CaseId): boolean {
    return this.favoritePresets.includes(id);
  }

  toggleFavorite(id: CaseId, event?: Event): void {
    event?.stopPropagation();
    if (this.favoritePresets.includes(id)) {
      this.favoritePresets = this.favoritePresets.filter((f) => f !== id);
    } else {
      this.favoritePresets = [...this.favoritePresets, id];
    }
  }

  private trackRecent(id: CaseId): void {
    this.recentPresets = [id, ...this.recentPresets.filter((r) => r !== id)].slice(0, 8);
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
      return;
    }
    if (redoKey) {
      evt.preventDefault();
      this.redo();
      return;
    }

    if (!evt.ctrlKey && !evt.metaKey && !evt.altKey && /^[1-5]$/.test(evt.key)) {
      const idx = Number(evt.key) - 1;
      const preset = this.shortcutPresets[idx];
      if (preset) {
        evt.preventDefault();
        this.onCaseChange(preset.id);
      }
    }
  }

  private isSourceEditorFocused(): boolean {
    const textarea = this.inputTextareaRef?.nativeElement;
    return !!textarea && document.activeElement === textarea;
  }

  ngOnInit(): void {
    this.applyShareFromUrl();
    this.seedHistory(this.inputText);
    this.syncPresetTab();
    this.refreshOutput();
    this.updateCounts(this.inputText);
  }

  ngOnDestroy(): void {
    if (this.historyTimer) {
      clearTimeout(this.historyTimer);
      this.historyTimer = null;
    }
    this.fileInput?.remove();
    this.fileInput = undefined;
  }

  private seedHistory(value: string): void {
    this.undoStack = [value];
    this.redoStack = [];
  }

  onInputChange(value: string): void {
    if (this.isRestoringHistory) {
      return;
    }

    this.inputText = value;
    this.selectionPreview = null;
    this.refreshOutput();
    this.updateCounts(value);
    this.scheduleHistoryPush(value);
  }

  private refreshOutput(): void {
    this.convertedText = this.runConversion(this.inputText);
    this.announceOutput();
  }

  private runConversion(value: string): string {
    if (!value) return '';

    const text = this.preserveLineBreaks ? value : value.replace(/\s+/g, ' ').trim();

    if (this.selectionPreview) {
      const { start, end } = this.selectionPreview;
      const safeStart = Math.max(0, Math.min(start, text.length));
      const safeEnd = Math.max(safeStart, Math.min(end, text.length));
      if (safeStart === safeEnd) {
        this.selectionPreview = null;
      } else {
        const before = text.slice(0, safeStart);
        const selected = text.slice(safeStart, safeEnd);
        const after = text.slice(safeEnd);
        return before + this.convertTextSegment(selected) + after;
      }
    }

    return this.convertTextSegment(text);
  }

  private convertTextSegment(text: string): string {
    if (this.batchLineMode) {
      return text
        .split('\n')
        .map((line) => this.convertSingle(line))
        .join('\n');
    }
    return this.convertSingle(text);
  }

  private convertSingle(text: string): string {
    let smallWords = this.convertOptions.smallWords;
    if (this.selectedCase === 'chicagoTitle' && (!smallWords || smallWords.size === 0)) {
      smallWords = CHICAGO_SMALL_WORDS;
    }

    return convertCase(this.selectedCase, text, { ...this.convertOptions, smallWords });
  }

  private announceOutput(): void {
    if (!this.convertedText) {
      this.screenReaderMessage = '';
      return;
    }
    this.screenReaderMessage = `Converted to ${this.selectedCaseLabel}. Output length ${this.convertedText.length} characters.`;
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
    this.selectionPreview = null;
    this.refreshOutput();
    this.updateCounts(value);
    this.isRestoringHistory = false;
  }

  onCaseChange(caseType: CaseId): void {
    this.selectedCase = caseType;
    this.trackRecent(caseType);
    this.refreshOutput();
    this.syncPresetTab();
    this.updateShareUrl();
  }

  cycleProgrammingCase(): void {
    const idx = PROGRAMMING_CYCLE.indexOf(this.selectedCase);
    const next = PROGRAMMING_CYCLE[(idx + 1) % PROGRAMMING_CYCLE.length] as CaseId;
    this.onCaseChange(next);
    this.toastService.info(`Switched to ${ALL_PRESETS.find((p) => p.id === next)?.label ?? next}`);
  }

  onOptionsChange(): void {
    this.refreshOutput();
  }

  private syncPresetTab(): void {
    if (this.favoritePresets.includes(this.selectedCase) && this.activePresetTab === 'favorites') {
      return;
    }
    const preset = ALL_PRESETS.find((p) => p.id === this.selectedCase);
    if (preset) {
      this.activePresetTab = preset.category;
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
    this.refreshOutput();
    this.toastService.info('Converting selection only — edit source to reset');
  }

  swapSourceOutput(): void {
    if (!this.convertedText) {
      this.toastService.info('No output to swap');
      return;
    }
    const prev = this.convertedText;
    this.applyInputState(prev);
    this.pushToUndoStack(prev);
    this.toastService.info('Output moved to source');
  }

  useOutputAsInput(): void {
    this.swapSourceOutput();
  }

  addCustomRule(): void {
    this.customRules = [...this.customRules, { pattern: '', replacement: 'upper' }];
  }

  removeCustomRule(index: number): void {
    this.customRules = this.customRules.filter((_, i) => i !== index);
    this.onOptionsChange();
  }

  updateCounts(value: string): void {
    this.charCount = value.length;
    this.wordCount = value.trim() ? value.trim().split(/\s+/).length : 0;
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

  reset(): void {
    if (this.historyTimer) {
      clearTimeout(this.historyTimer);
      this.historyTimer = null;
    }
    this.applyInputState('');
    this.seedHistory('');
    this.updateShareUrl();
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
      this.updateShareUrl();
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
    this.copyText(this.inputText, 'Source');
  }

  copyOutput(): void {
    this.copyText(this.convertedText, 'Output');
  }

  copyWithLabel(): void {
    if (!this.convertedText) return;
    const text = `${this.selectedCaseLabel}: ${this.convertedText}`;
    navigator.clipboard.writeText(text).then(() => {
      this.toastService.info('Copied with case label');
    });
  }

  copyAsJson(): void {
    if (!this.convertedText) return;
    const payload = JSON.stringify({ original: this.inputText, converted: this.convertedText, preset: this.selectedCase }, null, 2);
    navigator.clipboard.writeText(payload).then(() => {
      this.toastService.info('Copied as JSON');
    });
  }

  copyAsCsv(): void {
    if (!this.convertedText) return;
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const row = `${escape(this.inputText)},${escape(this.convertedText)},${escape(this.selectedCase)}`;
    navigator.clipboard.writeText(row).then(() => {
      this.toastService.info('Copied as CSV');
    });
  }

  private copyText(text: string, label: string): void {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      this.toastService.info(`${label} copied to clipboard`);
    });
  }

  downloadText(): void {
    this.downloadWithName(`output-${this.selectedCase}.txt`);
  }

  downloadWithName(filename?: string): void {
    if (!this.convertedText) return;
    const blob = new Blob([this.convertedText], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename ?? `output-${this.selectedCase}.txt`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  copyShareLink(): void {
    this.updateShareUrl();
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      this.toastService.info('Share link copied (text is in URL — share carefully)');
    });
  }

  private encodeSharePayload(payload: object): string {
    const json = JSON.stringify(payload);
    const bytes = new TextEncoder().encode(json);
    let binary = '';
    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }
    return btoa(binary);
  }

  private decodeSharePayload(encoded: string): { t?: string; c?: CaseId } | null {
    try {
      const binary = atob(encoded);
      const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
      const json = new TextDecoder().decode(bytes);
      return JSON.parse(json) as { t?: string; c?: CaseId };
    } catch {
      return null;
    }
  }

  private updateShareUrl(): void {
    if (typeof window === 'undefined') return;
    try {
      const payload = { t: this.inputText.slice(0, 2000), c: this.selectedCase };
      const encoded = this.encodeSharePayload(payload);
      const base = window.location.pathname + window.location.search;
      window.history.replaceState(null, '', `${base}#tcc=${encoded}`);
    } catch {
      // skip if payload too large
    }
  }

  private applyShareFromUrl(): void {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash;
    if (!hash.startsWith('#tcc=')) return;
    const data = this.decodeSharePayload(hash.slice(5));
    if (!data) return;
    if (data.t !== undefined) this.inputText = data.t;
    if (data.c && ALL_PRESETS.some((p) => p.id === data.c)) {
      this.selectedCase = data.c;
    }
  }
}
