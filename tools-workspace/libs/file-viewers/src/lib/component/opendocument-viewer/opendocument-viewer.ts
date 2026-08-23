import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, HostListener, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AssetService, Navigation, ToastService } from '@tools-workspace/features-home';
import { OD_ACCEPT_ATTR, OD_FORMATS_HINT, OD_FORMATS_LABEL, OD_RELATED_TOOLS, OD_SUPPORTED_EXTENSIONS } from '../../constants/opendocument-viewer.constants';
import type { OdCell, OdColumn, OdSheet, OdBlock, OdExportFormat, OdLoadedFile, OdPage, OdViewMode } from '../../types/opendocument-viewer.types';
import {
  buildOdSheetMetadata,
  buildOdBlockMetadata,
  buildOdMetadataRows,
  buildOdPageMetadata,
  canExportOd,
  createOdFileRecord,
  createSampleOdFile,
  downloadBinaryFile,
  downloadTextFile,
  exportOdRowsCsv,
  exportOdSchemaCsv,
  exportOdSummaryJson,
  filterOdSheets,
  filterOdBlocks,
  filterOdCells,
  filterOdRows,
  filterOdPages,
  filterValidOdFiles,
  formatOdFileSize,
  readOdFileBytes,
  resolveOdSuggestion
} from '../../utils/opendocument-viewer.utils';

@Component({
  selector: 'lib-opendocument-viewer',
  standalone: true,
  templateUrl: './opendocument-viewer.html',
  styleUrls: ['./opendocument-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OpendocumentViewerComponent {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  readonly acceptAttr = OD_ACCEPT_ATTR;
  readonly relatedTools = OD_RELATED_TOOLS;
  readonly supportedExtensions = OD_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = OD_FORMATS_LABEL;
  readonly formatsHint = OD_FORMATS_HINT;
  readonly viewModes: Array<{ id: OdViewMode; label: string }> = [
    { id: 'preview', label: 'Preview' },
    { id: 'pages', label: 'Pages' },
    { id: 'sheets', label: 'Sheets' },
    { id: 'table', label: 'Rows' }
  ];

  files: OdLoadedFile[] = [];
  currentIndex = -1;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;
  viewMode: OdViewMode = 'preview';
  query = '';
  selectedPageId = '';
  selectedSheetId = '';
  selectedBlockId = '';
  selectedRowIndex = 0;

  private dragDepth = 0;

  get currentFile(): OdLoadedFile | null {
    return this.currentIndex >= 0 ? this.files[this.currentIndex] ?? null : null;
  }

  get parsed() {
    return this.currentFile?.parsed ?? null;
  }

  get canExport(): boolean {
    return canExportOd(this.currentFile);
  }

  get warnings(): string[] {
    return this.currentFile?.warnings ?? [];
  }

  get filteredPages(): OdPage[] {
    return this.parsed ? filterOdPages(this.parsed.pages, this.query) : [];
  }

  get filteredSheets(): OdSheet[] {
    return this.parsed ? filterOdSheets(this.parsed.sheets, this.query) : [];
  }

  get filteredBlocks(): OdBlock[] {
    return this.parsed ? filterOdBlocks(this.parsed.blocks, this.query) : [];
  }

  get pageBlocks(): OdBlock[] {
    return this.parsed ? filterOdBlocks(this.parsed.blocks, this.query, this.selectedPage?.name || '') : [];
  }

  get sheetCells() {
    return this.parsed ? filterOdCells(this.parsed.cells, this.query, this.selectedSheet?.name || '') : [];
  }

  get pageLabel(): string {
    const page = this.selectedPage;
    if (!page || !this.parsed) return '—';
    return `${page.index + 1} / ${this.parsed.pages.length} · ${page.name}`;
  }

  get sheetLabel(): string {
    const sheet = this.selectedSheet;
    if (!sheet || !this.parsed) return '—';
    return `${sheet.index + 1} / ${this.parsed.sheets.length} · ${sheet.name}`;
  }

  get filteredColumns(): OdColumn[] {
    return this.parsed?.columns ?? [];
  }

  get filteredRows(): Array<Record<string, string>> {
    return this.parsed ? filterOdRows(this.parsed.rows, this.query) : [];
  }

  get selectedPage(): OdPage | null {
    return this.filteredPages.find((s) => s.id === this.selectedPageId) ?? this.filteredPages[0] ?? null;
  }

  get selectedSheet(): OdSheet | null {
    return this.filteredSheets.find((c) => c.id === this.selectedSheetId) ?? this.filteredSheets[0] ?? null;
  }

  get selectedBlock(): OdBlock | null {
    return this.filteredBlocks.find((e) => e.id === this.selectedBlockId) ?? null;
  }

  get metadataRows() {
    return this.parsed ? buildOdMetadataRows(this.parsed) : [];
  }

  get pageMetadataRows() {
    return this.selectedPage ? buildOdPageMetadata(this.selectedPage) : [];
  }

  get sheetMetadataRows() {
    return this.selectedSheet ? buildOdSheetMetadata(this.selectedSheet) : [];
  }

  get blockMetadataRows() {
    return this.selectedBlock ? buildOdBlockMetadata(this.selectedBlock) : [];
  }

  get primarySuggestion() {
    const s = resolveOdSuggestion({ hasFiles: this.files.length > 0, hasError: !!this.errorMessage });
    return !s || s.id === this.dismissedSuggestionId ? null : s;
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
      else if (this.viewMode === 'sheets') this.shiftSheet(1);
      else this.shiftPage(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (this.viewMode === 'table') this.shiftRow(-1);
      else if (this.viewMode === 'sheets') this.shiftSheet(-1);
      else this.shiftPage(-1);
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      this.query = '';
      this.onFilterChange();
    }
  }

  trackByFileId(_i: number, file: OdLoadedFile): string {
    return file.id;
  }

  trackByWarning(_i: number, warning: string): string {
    return warning;
  }

  trackByPage(_i: number, section: OdPage): string {
    return section.id;
  }

  trackBySheet(_i: number, command: OdSheet): string {
    return command.id;
  }

  trackByBlock(_i: number, env: OdBlock): string {
    return env.id;
  }

  trackByCell(_i: number, cell: OdCell): string {
    return cell.id;
  }

  trackByColumn(_i: number, column: OdColumn): string {
    return column.id;
  }

  trackByRowIndex(index: number): number {
    return index;
  }

  formatSize(bytes: number): string {
    return formatOdFileSize(bytes);
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
    const { accepted, rejected } = filterValidOdFiles(files);
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
          const bytes = await readOdFileBytes(file);
          const record = createOdFileRecord(file, bytes);
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
          this.errorMessage = `${file.name}: ${error instanceof Error ? error.message : 'Invalid ODF dump'}`;
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
    await this.handleFiles([createSampleOdFile()]);
  }

  selectFile(index: number): void {
    if (index < 0 || index >= this.files.length || index === this.currentIndex) return;
    this.currentIndex = index;
    this.resetViewForCurrent();
    this.cdr.markForCheck();
  }

  selectPage(id: string): void {
    this.selectedPageId = id;
    this.cdr.markForCheck();
  }

  prevPage(): void {
    this.shiftPage(-1);
  }

  nextPage(): void {
    this.shiftPage(1);
  }

  prevSheet(): void {
    this.shiftSheet(-1);
  }

  nextSheet(): void {
    this.shiftSheet(1);
  }

  selectSheet(id: string): void {
    this.selectedSheetId = id;
    this.cdr.markForCheck();
  }

  selectBlock(id: string): void {
    this.selectedBlockId = id;
    this.cdr.markForCheck();
  }

  selectRow(index: number): void {
    this.selectedRowIndex = index;
    const row = this.filteredRows[index];
    if (!row?.name) return;
    if (this.filteredPages.some((s) => s.id === row.name || s.name === row.name)) this.selectedPageId = row.name;
    if (this.filteredSheets.some((c) => c.name === row.name || c.id === row.name)) {
      this.selectedSheetId = this.filteredSheets.find((c) => c.name === row.name || c.id === row.name)?.id ?? '';
    }
    if (this.filteredBlocks.some((e) => e.id === row.name || e.name === row.name)) this.selectedBlockId = row.name;
    this.cdr.markForCheck();
  }

  onFilterChange(): void {
    if (this.selectedPageId && !this.filteredPages.some((s) => s.id === this.selectedPageId)) {
      this.selectedPageId = this.filteredPages[0]?.id ?? '';
    }
    if (this.selectedSheetId && !this.filteredSheets.some((c) => c.id === this.selectedSheetId)) {
      this.selectedSheetId = this.filteredSheets[0]?.id ?? '';
    }
    if (this.selectedBlockId && !this.filteredBlocks.some((e) => e.id === this.selectedBlockId)) {
      this.selectedBlockId = this.filteredBlocks[0]?.id ?? '';
    }
    if (this.selectedRowIndex >= this.filteredRows.length) this.selectedRowIndex = Math.max(0, this.filteredRows.length - 1);
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
    this.selectedPageId = '';
    this.selectedSheetId = '';
    this.selectedBlockId = '';
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

  setViewMode(mode: OdViewMode): void {
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

  exportAs(format: OdExportFormat, event: Event): void {
    event.stopPropagation();
    this.showExportMenu = false;
    const file = this.currentFile;
    if (!file?.parsed) return;
    try {
      if (format === 'original') downloadBinaryFile(file.bytes, file.name, 'application/octet-stream');
      else if (format === 'summary-json') downloadTextFile(exportOdSummaryJson(file), `${file.name}.summary.json`, 'application/json');
      else if (format === 'schema-csv') downloadTextFile(exportOdSchemaCsv(file.parsed), `${file.name}.schema.csv`, 'text/csv');
      else if (format === 'rows-csv') downloadTextFile(exportOdRowsCsv(file.parsed), `${file.name}.rows.csv`, 'text/csv');
      this.toast.success('Export started');
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'Export failed');
    }
    this.cdr.markForCheck();
  }

  private shiftPage(delta: number): void {
    const list = this.filteredPages;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((s) => s.id === this.selectedPageId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectPage(next.id);
  }

  private shiftSheet(delta: number): void {
    const list = this.filteredSheets;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((s) => s.id === this.selectedSheetId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectSheet(next.id);
  }

  private shiftRow(delta: number): void {
    const list = this.filteredRows;
    if (!list.length) return;
    this.selectRow(Math.min(list.length - 1, Math.max(0, this.selectedRowIndex + delta)));
  }

  private resetViewForCurrent(): void {
    this.query = '';
    this.selectedPageId = this.parsed?.pages[0]?.id ?? '';
    this.selectedSheetId = this.parsed?.sheets[0]?.id ?? '';
    this.selectedBlockId = this.parsed?.blocks[0]?.id ?? '';
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
