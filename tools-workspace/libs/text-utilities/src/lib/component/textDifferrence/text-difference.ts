import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
  ViewChild,
  ElementRef,
  inject,
  ChangeDetectorRef,
} from '@angular/core';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Navigation, TooltipDirective, AssetService, ToastService } from '@tools-workspace/features-home';
import { MonacoEditorModule } from 'ngx-monaco-editor-v2';
import { Subject } from 'rxjs';

interface DiffStats {
  originalChars: number;
  modifiedChars: number;
  originalLines: number;
  modifiedLines: number;
  changes: number;
  hasContent: boolean;
}

@Component({
  selector: 'lib-text-difference',
  standalone: true,
  templateUrl: './text-difference.html',
  styleUrls: ['./text-difference.scss'],
  imports: [FormsModule, CommonModule, Navigation, ReactiveFormsModule, MonacoEditorModule, TooltipDirective],
})
export class TextDifferenceComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toastService = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly themes = ['vs-dark', 'vs-light', 'hc-black'];
  readonly languages = [
    'typescript',
    'javascript',
    'json',
    'html',
    'css',
    'markdown',
    'python',
    'java',
    'xml',
    'yaml',
    'plaintext',
  ];

  showSidebar = true;
  showSideBySide = true;
  ignoreTrimWhitespace = false;

  editorOptions = {
    theme: this.themes[0],
    language: this.languages[0],
    readOnly: false,
    originalEditable: true,
    fontSize: 14,
    minimap: { enabled: typeof window !== 'undefined' && window.innerWidth > 768 },
    scrollBeyondLastLine: false,
    automaticLayout: true,
    wordWrap: 'on' as const,
    renderSideBySide: typeof window !== 'undefined' && window.innerWidth > 768,
    enableSplitViewResizing: true,
    ignoreTrimWhitespace: false,
    renderIndicators: true,
    diffWordWrap: 'on' as const,
    padding: { top: 12, bottom: 12 },
    cursorBlinking: 'blink' as const,
    cursorSmoothCaretAnimation: 'on' as const,
    cursorStyle: 'line' as const,
    cursorWidth: 2,
    scrollbar: {
      vertical: 'auto',
      horizontal: 'auto',
      useShadows: false,
      verticalHasArrows: false,
      horizontalHasArrows: false,
    },
  };

  originalModel = {
    code: 'heLLo world!\nThis is the original text.',
    language: this.languages[0],
  };

  modifiedModel = {
    code: 'hello world!\nThis is the modified text.',
    language: this.languages[0],
  };

  diffStats: DiffStats = {
    originalChars: 0,
    modifiedChars: 0,
    originalLines: 0,
    modifiedLines: 0,
    changes: 0,
    hasContent: true,
  };

  private editor: {
    getOriginalEditor(): { getValue(): string; setValue(value: string): void; layout(dimensions?: { width: number; height: number }): void; getScrollTop(): number; getScrollLeft(): number; setScrollTop(value: number): void; setScrollLeft(value: number): void; onDidChangeModelContent(listener: () => void): { dispose(): void } };
    getModifiedEditor(): { getValue(): string; setValue(value: string): void; layout(dimensions?: { width: number; height: number }): void; getScrollTop(): number; getScrollLeft(): number; setScrollTop(value: number): void; setScrollLeft(value: number): void; onDidChangeModelContent(listener: () => void): { dispose(): void } };
    updateOptions(options: Record<string, unknown>): void;
    getLineChanges?(): unknown[] | null;
  } | null = null;

  private readonly destroy$ = new Subject<void>();
  private resizeObserver?: ResizeObserver;
  private windowResizeListener?: () => void;
  private isMobile = false;
  private contentSyncTimer?: ReturnType<typeof setTimeout>;
  private resizeDebounceTimer?: ReturnType<typeof setTimeout>;
  private originalChangeDisposable?: { dispose(): void };
  private modifiedChangeDisposable?: { dispose(): void };
  private fileInput?: HTMLInputElement;
  private uploadTarget: 'original' | 'modified' = 'original';
  readonly maxUploadBytes = 10 * 1024 * 1024;

  @ViewChild('editorContainer', { static: false }) editorContainer?: ElementRef<HTMLElement>;

  get viewModeLabel(): string {
    if (this.isMobile) return 'Stacked';
    return this.showSideBySide ? 'Split' : 'Unified';
  }

  get isMobileView(): boolean {
    return this.isMobile;
  }

  get languageLabel(): string {
    const lang = this.editorOptions.language;
    return lang === 'plaintext' ? 'Plain Text' : lang;
  }

  ngOnInit(): void {
    this.updateEditorLayoutForScreenSize();
    this.refreshDiffStats();
  }

  ngAfterViewInit(): void {
    if (this.editorContainer && typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        requestAnimationFrame(() => this.refreshEditorLayout());
      });
      this.resizeObserver.observe(this.editorContainer.nativeElement);
    }

    if (typeof window !== 'undefined') {
      this.windowResizeListener = () => {
        this.updateEditorLayoutForScreenSize();
        this.scheduleResizeRefresh();
      };
      window.addEventListener('resize', this.windowResizeListener);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.resizeObserver?.disconnect();
    if (typeof window !== 'undefined' && this.windowResizeListener) {
      window.removeEventListener('resize', this.windowResizeListener);
    }
    if (this.contentSyncTimer) clearTimeout(this.contentSyncTimer);
    if (this.resizeDebounceTimer) clearTimeout(this.resizeDebounceTimer);
    this.originalChangeDisposable?.dispose();
    this.modifiedChangeDisposable?.dispose();
    this.fileInput?.remove();
    this.fileInput = undefined;
  }

  onEditorInit(editor: typeof this.editor): void {
    this.editor = editor;
    if (!editor) return;

    try {
      const modifiedEditor = editor.getModifiedEditor();
      const originalEditor = editor.getOriginalEditor();
      if (!modifiedEditor || !originalEditor) return;

      this.originalChangeDisposable?.dispose();
      this.modifiedChangeDisposable?.dispose();
      this.originalChangeDisposable = originalEditor.onDidChangeModelContent(() => this.scheduleContentSync());
      this.modifiedChangeDisposable = modifiedEditor.onDidChangeModelContent(() => this.scheduleContentSync());

      this.syncContentFromEditor();
      requestAnimationFrame(() => this.refreshEditorLayout());
    } catch (error) {
      console.error('Error initializing editor:', error);
    }
  }

  toggleSidebar(): void {
    this.showSidebar = !this.showSidebar;
    this.toastService.info(this.showSidebar ? 'Properties panel shown' : 'Properties panel hidden');
    this.scheduleLayoutRefresh();
  }

  toggleViewMode(): void {
    if (this.isMobile) return;
    this.setViewMode(!this.showSideBySide);
  }

  setViewMode(split: boolean): void {
    if (this.isMobile || this.showSideBySide === split) return;
    this.showSideBySide = split;
    this.editorOptions = { ...this.editorOptions, renderSideBySide: split };
    this.editor?.updateOptions({ renderSideBySide: split });
    this.toastService.info(split ? 'Split view enabled' : 'Unified view enabled');
    this.scheduleLayoutRefresh();
  }

  onThemeChange(theme: string): void {
    this.editorOptions = { ...this.editorOptions, theme };
    this.editor?.updateOptions({ theme });
  }

  onLanguageChange(language: string): void {
    const normalizedLang = language === 'text/plain' ? 'plaintext' : language;
    this.editorOptions = { ...this.editorOptions, language: normalizedLang };
    this.originalModel = { ...this.originalModel, language: normalizedLang };
    this.modifiedModel = { ...this.modifiedModel, language: normalizedLang };
    this.scheduleLayoutRefresh();
  }

  onFontSizeChange(fontSize: number): void {
    if (fontSize < 8 || fontSize > 32) return;
    this.editorOptions = { ...this.editorOptions, fontSize };
    this.editor?.updateOptions({ fontSize });
  }

  onIgnoreWhitespaceChange(): void {
    this.editorOptions = { ...this.editorOptions, ignoreTrimWhitespace: this.ignoreTrimWhitespace };
    this.editor?.updateOptions({ ignoreTrimWhitespace: this.ignoreTrimWhitespace });
    this.scheduleContentSync();
  }

  copyOriginal(): void {
    this.copyText(this.getOriginalContent(), 'Original');
  }

  copyModified(): void {
    this.copyText(this.getModifiedContent(), 'Modified');
  }

  uploadOriginal(): void {
    this.uploadTarget = 'original';
    this.openFilePicker();
  }

  uploadModified(): void {
    this.uploadTarget = 'modified';
    this.openFilePicker();
  }

  swapSides(): void {
    const original = this.getOriginalContent();
    const modified = this.getModifiedContent();
    this.setOriginalContent(modified);
    this.setModifiedContent(original);
    this.toastService.info('Original and modified swapped');
  }

  downloadOriginal(): void {
    this.downloadText(this.getOriginalContent(), 'original.txt');
  }

  downloadModified(): void {
    this.downloadText(this.getModifiedContent(), 'modified.txt');
  }

  clearOriginal(): void {
    this.setOriginalContent('');
    this.toastService.info('Original cleared');
  }

  clearModified(): void {
    this.setModifiedContent('');
    this.toastService.info('Modified cleared');
  }

  clearAll(): void {
    this.setOriginalContent('');
    this.setModifiedContent('');
    this.toastService.info('Both sides cleared');
  }

  private getOriginalContent(): string {
    try {
      return this.editor?.getOriginalEditor()?.getValue() ?? this.originalModel.code ?? '';
    } catch {
      return this.originalModel.code ?? '';
    }
  }

  private getModifiedContent(): string {
    try {
      return this.editor?.getModifiedEditor()?.getValue() ?? this.modifiedModel.code ?? '';
    } catch {
      return this.modifiedModel.code ?? '';
    }
  }

  private setOriginalContent(content: string): void {
    this.originalModel = { ...this.originalModel, code: content };
    try {
      this.editor?.getOriginalEditor()?.setValue(content);
    } catch {
      // editor not ready
    }
    this.syncContentFromEditor();
  }

  private setModifiedContent(content: string): void {
    this.modifiedModel = { ...this.modifiedModel, code: content };
    try {
      this.editor?.getModifiedEditor()?.setValue(content);
    } catch {
      // editor not ready
    }
    this.syncContentFromEditor();
  }

  private scheduleContentSync(): void {
    if (this.contentSyncTimer) clearTimeout(this.contentSyncTimer);
    this.contentSyncTimer = setTimeout(() => this.syncContentFromEditor(), 200);
  }

  private syncContentFromEditor(): void {
    const original = this.getOriginalContent();
    const modified = this.getModifiedContent();
    if (this.originalModel.code !== original) this.originalModel.code = original;
    if (this.modifiedModel.code !== modified) this.modifiedModel.code = modified;
    this.refreshDiffStats();
    this.cdr.markForCheck();
  }

  private refreshDiffStats(): void {
    const original = this.getOriginalContent();
    const modified = this.getModifiedContent();
    let changes = 0;
    try {
      changes = this.editor?.getLineChanges?.()?.length ?? 0;
    } catch {
      changes = 0;
    }

    this.diffStats = {
      originalChars: original.length,
      modifiedChars: modified.length,
      originalLines: original ? original.split('\n').length : 0,
      modifiedLines: modified ? modified.split('\n').length : 0,
      changes,
      hasContent: original.length > 0 || modified.length > 0,
    };
  }

  private openFilePicker(): void {
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
      '.txt,.text,.md,.markdown,.csv,.json,.xml,.html,.htm,.log,.yaml,.yml,.ts,.js,.css,.py,.java,text/*,application/json,application/xml';
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

    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      if (this.uploadTarget === 'original') {
        this.setOriginalContent(text);
      } else {
        this.setModifiedContent(text);
      }
      this.toastService.info(`Loaded "${file.name}" into ${this.uploadTarget}`);
    };
    reader.onerror = () => {
      this.toastService.error('Could not read the file.');
    };
    reader.readAsText(file);
  }

  private isLikelyTextFile(file: File): boolean {
    const blockedTypes = ['image/', 'video/', 'audio/', 'application/pdf', 'application/zip', 'application/x-zip-compressed'];
    if (file.type && blockedTypes.some((prefix) => file.type.startsWith(prefix) || file.type === prefix)) {
      return false;
    }
    if (!file.type || file.type.startsWith('text/')) return true;
    const allowed = new Set(['application/json', 'application/xml', 'application/javascript', 'application/octet-stream']);
    if (allowed.has(file.type)) return true;
    const ext = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : '';
    return new Set(['txt', 'text', 'md', 'json', 'xml', 'html', 'htm', 'log', 'yaml', 'yml', 'ts', 'js', 'css', 'py', 'java', 'csv']).has(ext);
  }

  private downloadText(text: string, filename: string): void {
    if (!text) return;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
    this.toastService.info(`Downloaded ${filename}`);
  }

  private copyText(text: string, label: string): void {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      this.toastService.info(`${label} copied to clipboard`);
    }).catch(() => {
      this.toastService.error('Failed to copy to clipboard');
    });
  }

  private updateEditorLayoutForScreenSize(): void {
    if (typeof window === 'undefined') return;

    const shouldBeInline = window.innerWidth <= 768;
    if (this.isMobile === shouldBeInline && this.editorOptions.renderSideBySide === !shouldBeInline) return;

    this.isMobile = shouldBeInline;
    this.showSideBySide = !shouldBeInline;
    this.editorOptions = {
      ...this.editorOptions,
      renderSideBySide: !shouldBeInline,
      minimap: { enabled: !shouldBeInline },
    };

    this.editor?.updateOptions({
      renderSideBySide: !shouldBeInline,
      minimap: { enabled: !shouldBeInline },
    });
    this.scheduleLayoutRefresh();
  }

  private scheduleLayoutRefresh(): void {
    setTimeout(() => this.refreshEditorLayout(), 50);
    setTimeout(() => this.refreshEditorLayout(), 300);
  }

  private scheduleResizeRefresh(): void {
    if (this.resizeDebounceTimer) clearTimeout(this.resizeDebounceTimer);
    this.resizeDebounceTimer = setTimeout(() => this.refreshEditorLayout(), 150);
  }

  private refreshEditorLayout(): void {
    if (!this.editor?.getModifiedEditor || !this.editor?.getOriginalEditor) return;

    try {
      const modifiedEditor = this.editor.getModifiedEditor();
      const originalEditor = this.editor.getOriginalEditor();
      if (!modifiedEditor || !originalEditor || !this.editorContainer) return;

      const container = this.editorContainer.nativeElement;
      const rect = container.getBoundingClientRect();
      const width = Math.floor(rect.width || container.clientWidth);
      const height = Math.floor(rect.height || container.clientHeight);
      if (width <= 0 || height <= 0) return;

      const modifiedScrollTop = modifiedEditor.getScrollTop();
      const modifiedScrollLeft = modifiedEditor.getScrollLeft();
      const originalScrollTop = originalEditor.getScrollTop();
      const originalScrollLeft = originalEditor.getScrollLeft();

      if (this.isMobile || !this.showSideBySide) {
        const editorHeight = Math.floor(height / 2);
        modifiedEditor.layout({ width, height: editorHeight });
        originalEditor.layout({ width, height: editorHeight });
      } else {
        const editorWidth = Math.floor(width / 2);
        modifiedEditor.layout({ width: editorWidth, height });
        originalEditor.layout({ width: editorWidth, height });
      }

      requestAnimationFrame(() => {
        modifiedEditor.setScrollTop(modifiedScrollTop);
        modifiedEditor.setScrollLeft(modifiedScrollLeft);
        originalEditor.setScrollTop(originalScrollTop);
        originalEditor.setScrollLeft(originalScrollLeft);
      });
    } catch (e) {
      console.warn('Error refreshing editor layout:', e);
    }
  }
}
