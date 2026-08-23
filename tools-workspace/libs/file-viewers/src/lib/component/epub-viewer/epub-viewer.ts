import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  ViewChild,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AssetService, Navigation, ToastService } from '@tools-workspace/features-home';
import {
  EP_ACCEPT_ATTR,
  EP_FORMATS_HINT,
  EP_FORMATS_LABEL,
  EP_RELATED_TOOLS,
  EP_SUPPORTED_EXTENSIONS
} from '../../constants/epub-viewer.constants';
import type {
  EpChapter,
  EpColumn,
  EpExportFormat,
  EpFontFamily,
  EpLoadedFile,
  EpTocEntry,
  EpViewMode
} from '../../types/epub-viewer.types';
import {
  buildEpChapterMetadata,
  buildEpMetadataRows,
  buildEpTocMetadata,
  canExportEp,
  createEpFileRecord,
  createSampleEpFile,
  downloadBinaryFile,
  downloadTextFile,
  exportEpChapterTxt,
  exportEpRowsCsv,
  exportEpSchemaCsv,
  exportEpSummaryJson,
  filterEpChapters,
  filterEpRows,
  filterEpToc,
  filterValidEpFiles,
  formatEpFileSize,
  readEpFileBytes,
  resolveEpSuggestion
} from '../../utils/epub-viewer.utils';

@Component({
  selector: 'lib-epub-viewer',
  standalone: true,
  templateUrl: './epub-viewer.html',
  styleUrls: ['./epub-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EpubViewerComponent {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  readonly acceptAttr = EP_ACCEPT_ATTR;
  readonly relatedTools = EP_RELATED_TOOLS;
  readonly supportedExtensions = EP_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = EP_FORMATS_LABEL;
  readonly formatsHint = EP_FORMATS_HINT;
  readonly viewModes: Array<{ id: EpViewMode; label: string }> = [
    { id: 'read', label: 'Read' },
    { id: 'chapters', label: 'Chapters' },
    { id: 'toc', label: 'TOC' },
    { id: 'table', label: 'Rows' }
  ];
  readonly fontFamilies: Array<{ id: EpFontFamily; label: string }> = [
    { id: 'serif', label: 'Serif' },
    { id: 'sans', label: 'Sans' }
  ];
  readonly fontScales: Array<{ id: number; label: string }> = [
    { id: 0.9, label: 'S' },
    { id: 1, label: 'M' },
    { id: 1.15, label: 'L' },
    { id: 1.3, label: 'XL' }
  ];

  files: EpLoadedFile[] = [];
  currentIndex = -1;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;
  viewMode: EpViewMode = 'read';
  query = '';
  selectedChapterId = '';
  selectedTocId = '';
  selectedRowIndex = 0;
  fontFamily: EpFontFamily = 'serif';
  fontScale = 1;

  private dragDepth = 0;

  get currentFile(): EpLoadedFile | null {
    return this.currentIndex >= 0 ? this.files[this.currentIndex] ?? null : null;
  }

  get parsed() {
    return this.currentFile?.parsed ?? null;
  }

  get canExport(): boolean {
    return canExportEp(this.currentFile);
  }

  get warnings(): string[] {
    return this.currentFile?.warnings ?? [];
  }

  get filteredChapters(): EpChapter[] {
    return this.parsed ? filterEpChapters(this.parsed.chapters, this.query) : [];
  }

  get filteredToc(): EpTocEntry[] {
    return this.parsed ? filterEpToc(this.parsed.toc, this.query) : [];
  }

  get filteredColumns(): EpColumn[] {
    return this.parsed?.columns ?? [];
  }

  get filteredRows(): Array<Record<string, string>> {
    return this.parsed ? filterEpRows(this.parsed.rows, this.query) : [];
  }

  get selectedChapter(): EpChapter | null {
    return this.filteredChapters.find((c) => c.id === this.selectedChapterId) ?? this.filteredChapters[0] ?? null;
  }

  get selectedToc(): EpTocEntry | null {
    return this.filteredToc.find((t) => t.id === this.selectedTocId) ?? null;
  }

  get metadataRows() {
    return this.parsed ? buildEpMetadataRows(this.parsed) : [];
  }

  get chapterMetadataRows() {
    return this.selectedChapter ? buildEpChapterMetadata(this.selectedChapter) : [];
  }

  get tocMetadataRows() {
    return this.selectedToc ? buildEpTocMetadata(this.selectedToc) : [];
  }

  get primarySuggestion() {
    const s = resolveEpSuggestion({ hasFiles: this.files.length > 0, hasError: !!this.errorMessage });
    return !s || s.id === this.dismissedSuggestionId ? null : s;
  }

  get readFontPx(): number {
    return Math.round(18 * this.fontScale);
  }

  get readFontFamilyCss(): string {
    return this.fontFamily === 'serif' ? 'Georgia, "Times New Roman", serif' : 'system-ui, sans-serif';
  }

  rowValue(row: Record<string, string>, column: string): string {
    return row[column] || '';
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    if (this.showExportMenu) {
      this.showExportMenu = false;
      this.cdr.markForCheck();
    }
  }

  @HostListener('window:dragenter', ['$event'])
  onWindowDragEnter(event: DragEvent): void {
    if (!this.isFileDrag(event)) return;
    event.preventDefault();
    this.dragDepth += 1;
    if (!this.showDropZone) {
      this.showDropZone = true;
      this.cdr.markForCheck();
    }
  }

  @HostListener('window:dragover', ['$event'])
  onWindowDragOver(event: DragEvent): void {
    if (!this.isFileDrag(event)) return;
    event.preventDefault();
  }

  @HostListener('window:dragleave', ['$event'])
  onWindowDragLeave(event: DragEvent): void {
    if (!this.isFileDrag(event)) return;
    event.preventDefault();
    this.dragDepth = Math.max(0, this.dragDepth - 1);
    if (this.dragDepth === 0 && this.showDropZone) {
      this.showDropZone = false;
      this.cdr.markForCheck();
    }
  }

  @HostListener('window:drop', ['$event'])
  async onWindowDrop(event: DragEvent): Promise<void> {
    if (!this.isFileDrag(event)) return;
    event.preventDefault();
    this.dragDepth = 0;
    this.showDropZone = false;
    const files = event.dataTransfer?.files;
    if (files?.length) await this.handleFiles(Array.from(files));
    this.cdr.markForCheck();
  }

  @HostListener('window:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (this.isTypingTarget(event.target)) {
      if (event.key === 'Escape') (event.target as HTMLElement).blur();
      return;
    }
    if (!this.parsed) return;
    if (event.key === '/') {
      event.preventDefault();
      this.searchInput?.nativeElement?.focus();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (this.viewMode === 'table') this.shiftRow(1);
      else if (this.viewMode === 'toc') this.shiftToc(1);
      else this.shiftChapter(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (this.viewMode === 'table') this.shiftRow(-1);
      else if (this.viewMode === 'toc') this.shiftToc(-1);
      else this.shiftChapter(-1);
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      this.query = '';
      this.onFilterChange();
    }
  }

  trackByFileId(_i: number, file: EpLoadedFile): string {
    return file.id;
  }

  trackByWarning(_i: number, warning: string): string {
    return warning;
  }

  trackByChapter(_i: number, chapter: EpChapter): string {
    return chapter.id;
  }

  trackByToc(_i: number, entry: EpTocEntry): string {
    return entry.id;
  }

  trackByColumn(_i: number, column: EpColumn): string {
    return column.id;
  }

  trackByRowIndex(index: number): number {
    return index;
  }

  formatSize(bytes: number): string {
    return formatEpFileSize(bytes);
  }

  openFilePicker(): void {
    this.fileInput?.nativeElement?.click();
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    await this.handleFiles(Array.from(input.files));
    input.value = '';
  }

  async handleFiles(files: File[]): Promise<void> {
    const { accepted, rejected } = filterValidEpFiles(files);
    for (const item of rejected) this.toast.error(`${item.name}: ${item.reason}`);
    if (!accepted.length) {
      this.cdr.markForCheck();
      return;
    }
    this.loading = true;
    this.errorMessage = '';
    this.cdr.markForCheck();
    try {
      for (const file of accepted) {
        try {
          const bytes = await readEpFileBytes(file);
          const record = createEpFileRecord(file, bytes);
          const existing = this.files.findIndex((item) => item.id === record.id);
          if (existing >= 0) {
            this.files[existing] = record;
            this.currentIndex = existing;
          } else {
            this.files = [...this.files, record];
            this.currentIndex = this.files.length - 1;
          }
          this.resetViewForCurrent();
        } catch (error) {
          this.errorMessage = `${file.name}: ${error instanceof Error ? error.message : 'Invalid EPUB dump'}`;
          this.toast.error(this.errorMessage);
        }
      }
      if (this.currentFile) {
        this.toast.success(`Loaded ${this.currentFile.name}`);
        if (this.currentFile.warnings.length) this.toast.info(`${this.currentFile.warnings.length} note(s) about this file`);
      }
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async loadSample(): Promise<void> {
    await this.handleFiles([createSampleEpFile()]);
  }

  selectFile(index: number): void {
    if (index < 0 || index >= this.files.length || index === this.currentIndex) return;
    this.currentIndex = index;
    this.resetViewForCurrent();
    this.cdr.markForCheck();
  }

  selectChapter(id: string): void {
    this.selectedChapterId = id;
    const toc = this.filteredToc.find((t) => t.chapter === id || t.id === id);
    if (toc) this.selectedTocId = toc.id;
    this.cdr.markForCheck();
  }

  selectToc(id: string): void {
    this.selectedTocId = id;
    const entry = this.filteredToc.find((t) => t.id === id);
    if (entry?.chapter && this.filteredChapters.some((c) => c.id === entry.chapter || c.name === entry.chapter)) {
      this.selectedChapterId = entry.chapter;
    }
    this.cdr.markForCheck();
  }

  selectRow(index: number): void {
    this.selectedRowIndex = index;
    const row = this.filteredRows[index];
    if (!row?.name) return;
    if (this.filteredChapters.some((c) => c.id === row.name || c.name === row.name || c.name === row.chapter)) {
      this.selectedChapterId = row.chapter || row.name;
    }
    if (this.filteredToc.some((t) => t.id === row.name || t.label === row.name || t.label === row.toc)) {
      this.selectedTocId = this.filteredToc.find((t) => t.id === row.name || t.label === row.name || t.label === row.toc)?.id ?? '';
    }
    this.cdr.markForCheck();
  }

  onFilterChange(): void {
    if (this.selectedChapterId && !this.filteredChapters.some((c) => c.id === this.selectedChapterId)) {
      this.selectedChapterId = this.filteredChapters[0]?.id ?? '';
    }
    if (this.selectedTocId && !this.filteredToc.some((t) => t.id === this.selectedTocId)) {
      this.selectedTocId = this.filteredToc[0]?.id ?? '';
    }
    if (this.selectedRowIndex >= this.filteredRows.length) this.selectedRowIndex = Math.max(0, this.filteredRows.length - 1);
    this.cdr.markForCheck();
  }

  setFontFamily(family: EpFontFamily): void {
    this.fontFamily = family;
    this.cdr.markForCheck();
  }

  setFontScale(scale: number): void {
    this.fontScale = scale;
    this.cdr.markForCheck();
  }

  removeFile(index: number, event: Event): void {
    event.stopPropagation();
    if (index < 0 || index >= this.files.length) return;
    const next = this.files.filter((_, i) => i !== index);
    this.files = next;
    if (!next.length) {
      this.clearAll();
      return;
    }
    this.currentIndex = Math.min(index, next.length - 1);
    this.resetViewForCurrent();
  }

  clearAll(): void {
    this.files = [];
    this.currentIndex = -1;
    this.selectedChapterId = '';
    this.selectedTocId = '';
    this.selectedRowIndex = 0;
    this.errorMessage = '';
    this.query = '';
    this.cdr.markForCheck();
  }

  dismissSuggestion(id: string): void {
    this.dismissedSuggestionId = id;
    this.cdr.markForCheck();
  }

  applySuggestion(suggestion: { action: string }): void {
    if (suggestion.action === 'sample') void this.loadSample();
    else this.openFilePicker();
  }

  setViewMode(mode: EpViewMode): void {
    this.viewMode = mode;
    this.cdr.markForCheck();
  }

  toggleSidebar(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;
    this.cdr.markForCheck();
  }

  toggleExportMenu(event: Event): void {
    event.stopPropagation();
    this.showExportMenu = !this.showExportMenu;
    this.cdr.markForCheck();
  }

  exportAs(format: EpExportFormat, event: Event): void {
    event.stopPropagation();
    this.showExportMenu = false;
    const file = this.currentFile;
    if (!file?.parsed) return;
    try {
      if (format === 'original') downloadBinaryFile(file.bytes, file.name, 'application/octet-stream');
      else if (format === 'summary-json') downloadTextFile(exportEpSummaryJson(file), `${file.name}.summary.json`, 'application/json');
      else if (format === 'schema-csv') downloadTextFile(exportEpSchemaCsv(file.parsed), `${file.name}.schema.csv`, 'text/csv');
      else if (format === 'rows-csv') downloadTextFile(exportEpRowsCsv(file.parsed), `${file.name}.rows.csv`, 'text/csv');
      else if (format === 'chapter-txt') {
        downloadTextFile(exportEpChapterTxt(this.selectedChapter), `${file.name}.${this.selectedChapter?.name || 'chapter'}.txt`, 'text/plain');
      }
      this.toast.success('Export started');
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'Export failed');
    }
    this.cdr.markForCheck();
  }

  private shiftChapter(delta: number): void {
    const list = this.filteredChapters;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((c) => c.id === this.selectedChapterId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectChapter(next.id);
  }

  private shiftToc(delta: number): void {
    const list = this.filteredToc;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((t) => t.id === this.selectedTocId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectToc(next.id);
  }

  private shiftRow(delta: number): void {
    const list = this.filteredRows;
    if (!list.length) return;
    this.selectRow(Math.min(list.length - 1, Math.max(0, this.selectedRowIndex + delta)));
  }

  private resetViewForCurrent(): void {
    this.query = '';
    this.selectedChapterId = this.parsed?.chapters[0]?.id ?? '';
    this.selectedTocId = this.parsed?.toc[0]?.id ?? '';
    this.selectedRowIndex = 0;
  }

  private isFileDrag(event: DragEvent): boolean {
    return !!event.dataTransfer?.types?.includes('Files');
  }

  private isTypingTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName.toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
  }
}
