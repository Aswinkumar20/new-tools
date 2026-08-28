import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  PLATFORM_ID,
  ViewChild,
  inject
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AssetService, Navigation, StatValueTooltipHostDirective, ToastService, TooltipDirective } from '@tools-workspace/features-home';
import { buildDiagramInsightStats } from '../../utils/diagram-file.utils';
import {
  CDG_ACCEPT_ATTR,
  CDG_FORMATS_HINT,
  CDG_FORMATS_LABEL,
  CDG_RELATED_TOOLS,
  CDG_SUPPORTED_EXTENSIONS
} from '../../constants/class-diagram-viewer.constants';
import type {
  CdgExportFormat,
  CdgLoadedFile,
  CdgRelation,
  CdgType,
  CdgViewMode
} from '../../types/class-diagram-viewer.types';
import {
  buildCdgMetadataRows,
  buildCdgRelationMetadata,
  buildCdgTypeMetadata,
  canExportCdg,
  canvasToPngDataUrl,
  cdgTypeColor,
  createCdgFileRecord,
  createSampleCdgFile,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  exportCdgRelationsCsv,
  exportCdgSummaryJson,
  exportCdgTypesCsv,
  filterCdgRelations,
  filterCdgTypes,
  filterValidCdgFiles,
  formatCdgFileSize,
  readCdgFileBytes,
  renderCdgDiagram,
  renderCdgRelations,
  renderCdgTypes,
  resolveCdgSuggestion
} from '../../utils/class-diagram-viewer.utils';

@Component({
  selector: 'lib-class-diagram-viewer',
  standalone: true,
  templateUrl: './class-diagram-viewer.html',
  styleUrls: ['./class-diagram-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation, TooltipDirective, StatValueTooltipHostDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClassDiagramViewerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('canvasHost') canvasHost?: ElementRef<HTMLCanvasElement>;
  @ViewChild('mapWrap') mapWrap?: ElementRef<HTMLElement>;
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  readonly acceptAttr = CDG_ACCEPT_ATTR;
  readonly relatedTools = CDG_RELATED_TOOLS;
  readonly supportedExtensions = CDG_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = CDG_FORMATS_LABEL;
  readonly formatsHint = CDG_FORMATS_HINT;
  readonly viewModes: Array<{ id: CdgViewMode; label: string }> = [
    { id: 'diagram', label: 'Diagram' },
    { id: 'types', label: 'Types' },
    { id: 'relations', label: 'Relations' },
    { id: 'table', label: 'Table' }
  ];

  files: CdgLoadedFile[] = [];
  currentIndex = -1;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;
  viewMode: CdgViewMode = 'diagram';
  query = '';
  selectedTypeId = '';
  selectedRelationId = '';

  private dragDepth = 0;
  private resizeObserver: ResizeObserver | null = null;

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  get currentFile(): CdgLoadedFile | null {
    return this.currentIndex >= 0 ? this.files[this.currentIndex] ?? null : null;
  }

  get parsed() {
    return this.currentFile?.parsed ?? null;
  }

  get canExport(): boolean {
    return canExportCdg(this.currentFile);
  }

  get insights() {
    return buildDiagramInsightStats(
      this.parsed as Record<string, unknown> | null,
      this.files.length,
      this.currentFile?.size ?? null,
      this.warnings,
      (n) => this.formatSize(n)
    );
  }

  get warnings(): string[] {
    return this.currentFile?.warnings ?? [];
  }

  get selectedType(): CdgType | null {
    return this.parsed?.types.find((t) => t.id === this.selectedTypeId) ?? null;
  }

  get selectedRelation(): CdgRelation | null {
    return this.parsed?.relations.find((r) => r.id === this.selectedRelationId) ?? null;
  }

  get filteredTypes(): CdgType[] {
    return this.parsed ? filterCdgTypes(this.parsed.types, this.query) : [];
  }

  get filteredRelations(): CdgRelation[] {
    return this.parsed ? filterCdgRelations(this.parsed.relations, this.query) : [];
  }

  get metadataRows() {
    return this.parsed ? buildCdgMetadataRows(this.parsed) : [];
  }

  get typeMetadataRows() {
    return this.selectedType ? buildCdgTypeMetadata(this.selectedType) : [];
  }

  get relationMetadataRows() {
    return this.selectedRelation ? buildCdgRelationMetadata(this.selectedRelation) : [];
  }

  get primarySuggestion() {
    const s = resolveCdgSuggestion({ hasFiles: this.files.length > 0, hasError: !!this.errorMessage });
    return !s || s.id === this.dismissedSuggestionId ? null : s;
  }

  // ---------------------------------------------------------------------------
  // Display helpers
  // ---------------------------------------------------------------------------

  tint(kind: string, index: number): string {
    return cdgTypeColor(kind, index);
  }

  memberLabel(type: CdgType): string {
    const attrs = type.attributes.map((m) => m.name);
    const ops = type.operations.map((m) => `${m.name}()`);
    const parts = [...attrs, ...ops];
    return parts.length ? parts.join(', ') : type.stereotype || type.id;
  }

  formatSize(bytes: number): string {
    return formatCdgFileSize(bytes);
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  ngAfterViewInit(): void {
    if (this.isBrowser) this.observeCanvasResize();
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }

  // ---------------------------------------------------------------------------
  // Host listeners
  // ---------------------------------------------------------------------------

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
    if (event.key === 'Escape' && this.showExportMenu) {
      event.preventDefault();
      this.showExportMenu = false;
      this.cdr.markForCheck();
      return;
    }
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
      if (this.viewMode === 'table' || this.viewMode === 'relations') this.shiftRelation(1);
      else this.shiftType(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (this.viewMode === 'table' || this.viewMode === 'relations') this.shiftRelation(-1);
      else this.shiftType(-1);
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      this.query = '';
      this.onFilterChange();
    }
  }

  // ---------------------------------------------------------------------------
  // TrackBy
  // ---------------------------------------------------------------------------

  trackByFileId(_i: number, file: CdgLoadedFile): string {
    return file.id;
  }

  trackByWarning(_i: number, warning: string): string {
    return warning;
  }

  trackByType(_i: number, type: CdgType): string {
    return type.id;
  }

  trackByRelation(_i: number, relation: CdgRelation): string {
    return relation.id;
  }

  // ---------------------------------------------------------------------------
  // File load / clear
  // ---------------------------------------------------------------------------

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
    const { accepted, rejected } = filterValidCdgFiles(files);
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
          const bytes = await readCdgFileBytes(file);
          const record = createCdgFileRecord(file, bytes);
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
          this.errorMessage = `${file.name}: ${error instanceof Error ? error.message : 'Invalid class diagram'}`;
          this.toast.error(this.errorMessage);
        }
      }
      this.renderCanvas();
      if (this.currentFile) {
        this.toast.success(`Loaded ${this.currentFile.name}`);
        if (this.currentFile.softFail) {
          this.toast.warning('Parsed with little or no types — metadata may still be available');
        } else if (this.currentFile.warnings.length) {
          this.toast.info(`${this.currentFile.warnings.length} note(s) about this file`);
        }
      }
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async loadSample(): Promise<void> {
    await this.handleFiles([createSampleCdgFile()]);
  }

  selectFile(index: number): void {
    if (index < 0 || index >= this.files.length || index === this.currentIndex) return;
    this.currentIndex = index;
    this.resetViewForCurrent();
    this.renderCanvas();
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
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  clearAll(): void {
    this.files = [];
    this.currentIndex = -1;
    this.selectedTypeId = '';
    this.selectedRelationId = '';
    this.errorMessage = '';
    this.query = '';
    this.showExportMenu = false;
    this.showDropZone = false;
    this.dragDepth = 0;
    this.dismissedSuggestionId = null;
    this.clearCanvas();
    this.cdr.markForCheck();
  }

  // ---------------------------------------------------------------------------
  // Selection / filter
  // ---------------------------------------------------------------------------

  selectType(id: string): void {
    this.selectedTypeId = id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectRelation(id: string): void {
    this.selectedRelationId = id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  onFilterChange(): void {
    if (this.selectedTypeId && !this.filteredTypes.some((t) => t.id === this.selectedTypeId)) {
      this.selectedTypeId = this.filteredTypes[0]?.id ?? '';
    }
    if (this.selectedRelationId && !this.filteredRelations.some((r) => r.id === this.selectedRelationId)) {
      this.selectedRelationId = this.filteredRelations[0]?.id ?? '';
    }
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  // ---------------------------------------------------------------------------
  // Suggestions / view mode / chrome / export
  // ---------------------------------------------------------------------------

  dismissSuggestion(id: string): void {
    this.dismissedSuggestionId = id;
    this.cdr.markForCheck();
  }

  applySuggestion(suggestion: { action: string }): void {
    if (suggestion.action === 'sample') void this.loadSample();
    else this.openFilePicker();
  }

  setViewMode(mode: CdgViewMode): void {
    if (this.viewMode === mode) return;
    this.viewMode = mode;
    this.cdr.markForCheck();
    setTimeout(() => this.renderCanvas(), 0);
  }

  toggleSidebar(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;
    this.cdr.markForCheck();
    setTimeout(() => this.renderCanvas(), 0);
  }

  toggleExportMenu(event: Event): void {
    event.stopPropagation();
    if (!this.canExport) {
      this.showExportMenu = false;
      this.cdr.markForCheck();
      return;
    }
    this.showExportMenu = !this.showExportMenu;
    this.cdr.markForCheck();
  }

  exportAs(format: CdgExportFormat, event: Event): void {
    event.stopPropagation();
    this.showExportMenu = false;
    const file = this.currentFile;
    if (!this.canExport || !file?.parsed) {
      this.toast.info('Nothing to export');
      this.cdr.markForCheck();
      return;
    }
    try {
      if (format === 'original') downloadBinaryFile(file.bytes, file.name, 'application/octet-stream');
      else if (format === 'summary-json') downloadTextFile(exportCdgSummaryJson(file), `${file.name}.summary.json`, 'application/json');
      else if (format === 'types-csv') downloadTextFile(exportCdgTypesCsv(file.parsed), `${file.name}.types.csv`, 'text/csv');
      else if (format === 'relations-csv') downloadTextFile(exportCdgRelationsCsv(file.parsed), `${file.name}.relations.csv`, 'text/csv');
      else if (format === 'png') {
        const canvas = this.canvasHost?.nativeElement;
        if (!canvas || this.viewMode === 'table') {
          this.toast.info('Open Diagram, Types, or Relations to export a PNG snapshot');
          this.cdr.markForCheck();
          return;
        }
        const url = canvasToPngDataUrl(canvas);
        if (!url) {
          this.toast.error('Could not capture PNG snapshot');
          this.cdr.markForCheck();
          return;
        }
        downloadDataUrl(url, `${file.name}.png`);
      }
      this.toast.success('Export started');
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'Export failed');
    }
    this.cdr.markForCheck();
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private shiftType(delta: number): void {
    const list = this.filteredTypes;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((t) => t.id === this.selectedTypeId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectType(next.id);
  }

  private shiftRelation(delta: number): void {
    const list = this.filteredRelations;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((r) => r.id === this.selectedRelationId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectRelation(next.id);
  }

  private resetViewForCurrent(): void {
    this.query = '';
    this.selectedTypeId = this.parsed?.types[0]?.id ?? '';
    this.selectedRelationId = this.parsed?.relations[0]?.id ?? '';
  }

  private renderCanvas(): void {
    if (!this.isBrowser || this.viewMode === 'table') return;
    const canvas = this.canvasHost?.nativeElement;
    if (!canvas || !this.parsed) return;
    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = Math.max(320, parent.clientWidth);
      canvas.height = Math.max(180, Math.min(this.viewMode === 'diagram' ? 280 : 220, parent.clientHeight || 240));
    }
    if (this.viewMode === 'diagram') {
      renderCdgDiagram(canvas, this.parsed.types, this.parsed.relations, this.selectedTypeId || null);
    } else if (this.viewMode === 'types') {
      renderCdgTypes(canvas, this.filteredTypes, this.selectedTypeId || null);
    } else renderCdgRelations(canvas, this.filteredRelations, this.selectedRelationId || null);
  }

  private clearCanvas(): void {
    if (!this.isBrowser) return;
    const canvas = this.canvasHost?.nativeElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  private observeCanvasResize(): void {
    const host = this.mapWrap?.nativeElement;
    if (!host || typeof ResizeObserver === 'undefined') return;
    this.resizeObserver = new ResizeObserver(() => this.renderCanvas());
    this.resizeObserver.observe(host);
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
