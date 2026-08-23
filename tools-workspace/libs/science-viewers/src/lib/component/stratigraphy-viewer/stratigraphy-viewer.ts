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
import { AssetService, Navigation, ToastService } from '@tools-workspace/features-home';
import {
  STRAT_ACCEPT_ATTR,
  STRAT_FORMATS_HINT,
  STRAT_FORMATS_LABEL,
  STRAT_RELATED_TOOLS,
  STRAT_SUPPORTED_EXTENSIONS
} from '../../constants/stratigraphy-viewer.constants';
import type {
  StratigraphyColumn,
  StratigraphyExportFormat,
  StratigraphyLoadedFile,
  StratigraphyUnit,
  StratigraphyViewMode
} from '../../types/stratigraphy-viewer.types';
import { canvasToPngDataUrl } from '../../utils/science-image-render.utils';
import {
  allStratUnits,
  buildStratMetadataRows,
  buildUnitMetadata,
  canExportStrat,
  createSampleStratFile,
  createStratFileRecord,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  exportStratChronoCsv,
  exportStratSummaryJson,
  exportStratUnitsCsv,
  filterStratUnits,
  filterValidStratFiles,
  formatStratFileSize,
  readStratFileBytes,
  renderStratColumn,
  renderStratCorrelation,
  resolveStratSuggestion
} from '../../utils/stratigraphy-viewer.utils';

@Component({
  selector: 'lib-stratigraphy-viewer',
  standalone: true,
  templateUrl: './stratigraphy-viewer.html',
  styleUrls: ['./stratigraphy-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StratigraphyViewerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('canvasHost') canvasHost?: ElementRef<HTMLCanvasElement>;
  @ViewChild('mapWrap') mapWrap?: ElementRef<HTMLElement>;
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  readonly acceptAttr = STRAT_ACCEPT_ATTR;
  readonly relatedTools = STRAT_RELATED_TOOLS;
  readonly supportedExtensions = STRAT_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = STRAT_FORMATS_LABEL;
  readonly formatsHint = STRAT_FORMATS_HINT;
  readonly viewModes: Array<{ id: StratigraphyViewMode; label: string }> = [
    { id: 'column', label: 'Column' },
    { id: 'chrono', label: 'Chrono' },
    { id: 'correlation', label: 'Correlation' },
    { id: 'table', label: 'Table' }
  ];

  files: StratigraphyLoadedFile[] = [];
  currentIndex = -1;
  selectedUnitId = '';
  selectedColumnIndex = 0;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;

  viewMode: StratigraphyViewMode = 'column';
  query = '';
  visibleIds = new Set<string>();

  private dragDepth = 0;
  private resizeObserver: ResizeObserver | null = null;

  get currentFile(): StratigraphyLoadedFile | null {
    return this.currentIndex >= 0 ? this.files[this.currentIndex] ?? null : null;
  }

  get parsed() {
    return this.currentFile?.parsed ?? null;
  }

  get canExport(): boolean {
    return canExportStrat(this.currentFile);
  }

  get warnings(): string[] {
    return this.currentFile?.warnings ?? [];
  }

  get metadataRows() {
    return this.parsed ? buildStratMetadataRows(this.parsed) : [];
  }

  get columns(): StratigraphyColumn[] {
    return this.parsed?.columns ?? [];
  }

  get currentColumn(): StratigraphyColumn | null {
    return this.columns[this.selectedColumnIndex] ?? this.columns[0] ?? null;
  }

  get filteredUnits(): StratigraphyUnit[] {
    const units = this.viewMode === 'correlation' && this.parsed ? allStratUnits(this.parsed) : this.currentColumn?.units ?? [];
    return filterStratUnits(units, this.query);
  }

  get selectedUnit(): StratigraphyUnit | null {
    return this.filteredUnits.find((u) => u.id === this.selectedUnitId) ?? this.filteredUnits[0] ?? null;
  }

  get unitMetadataRows() {
    return this.selectedUnit ? buildUnitMetadata(this.selectedUnit) : [];
  }

  get markers() {
    return this.parsed?.markers ?? [];
  }

  get primarySuggestion() {
    const s = resolveStratSuggestion({ hasFiles: this.files.length > 0, hasError: !!this.errorMessage });
    return !s || s.id === this.dismissedSuggestionId ? null : s;
  }

  ngAfterViewInit(): void {
    if (this.isBrowser) this.observeCanvasResize();
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
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
      this.shiftUnit(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.shiftUnit(-1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.selectColumn(Math.min(this.columns.length - 1, this.selectedColumnIndex + 1));
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.selectColumn(Math.max(0, this.selectedColumnIndex - 1));
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      this.visibleIds = new Set(allStratUnits(this.parsed).map((u) => u.id));
      this.renderCanvas();
      this.cdr.markForCheck();
    }
  }

  trackByFileId(_i: number, file: StratigraphyLoadedFile): string {
    return file.id;
  }

  trackByWarning(_i: number, warning: string): string {
    return warning;
  }

  trackByUnit(_i: number, unit: StratigraphyUnit): string {
    return unit.id;
  }

  trackByColumn(_i: number, column: StratigraphyColumn): string {
    return column.id;
  }

  formatSize(bytes: number): string {
    return formatStratFileSize(bytes);
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
    const { accepted, rejected } = filterValidStratFiles(files);
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
          const bytes = await readStratFileBytes(file);
          const record = createStratFileRecord(file, bytes);
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
          this.errorMessage = `${file.name}: ${error instanceof Error ? error.message : 'Invalid stratigraphy'}`;
          this.toast.error(this.errorMessage);
        }
      }
      this.renderCanvas();
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
    await this.handleFiles([createSampleStratFile()]);
  }

  selectFile(index: number): void {
    if (index < 0 || index >= this.files.length || index === this.currentIndex) return;
    this.currentIndex = index;
    this.resetViewForCurrent();
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  prevColumn(): void {
    this.selectColumn(Math.max(0, this.selectedColumnIndex - 1));
  }

  nextColumn(): void {
    this.selectColumn(Math.min(this.columns.length - 1, this.selectedColumnIndex + 1));
  }

  selectColumn(index: number): void {
    if (index < 0 || index >= this.columns.length) return;
    this.selectedColumnIndex = index;
    const first = this.columns[index]?.units[0];
    if (first) this.selectedUnitId = first.id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectUnit(id: string): void {
    this.selectedUnitId = id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  toggleUnit(id: string): void {
    if (this.visibleIds.has(id)) {
      if (this.visibleIds.size === 1) return;
      this.visibleIds.delete(id);
    } else this.visibleIds.add(id);
    this.visibleIds = new Set(this.visibleIds);
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  onFilterChange(): void {
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
  }

  clearAll(): void {
    this.files = [];
    this.currentIndex = -1;
    this.selectedUnitId = '';
    this.selectedColumnIndex = 0;
    this.errorMessage = '';
    this.query = '';
    this.visibleIds = new Set();
    this.clearCanvas();
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

  setViewMode(mode: StratigraphyViewMode): void {
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
    this.showExportMenu = !this.showExportMenu;
    this.cdr.markForCheck();
  }

  exportAs(format: StratigraphyExportFormat, event: Event): void {
    event.stopPropagation();
    this.showExportMenu = false;
    const file = this.currentFile;
    if (!file?.parsed) return;
    try {
      if (format === 'original') downloadBinaryFile(new TextEncoder().encode(file.text), file.name, 'application/json');
      else if (format === 'summary-json') downloadTextFile(exportStratSummaryJson(file), `${file.name}.summary.json`, 'application/json');
      else if (format === 'units-csv') downloadTextFile(exportStratUnitsCsv(file.parsed), `${file.name}.units.csv`, 'text/csv');
      else if (format === 'chrono-csv') downloadTextFile(exportStratChronoCsv(file.parsed), `${file.name}.chrono.csv`, 'text/csv');
      else if (format === 'png') {
        const canvas = this.canvasHost?.nativeElement;
        if (!canvas) {
          this.toast.info('Open Column, Chrono, or Correlation to export a PNG snapshot');
          return;
        }
        const url = canvasToPngDataUrl(canvas);
        if (url) downloadDataUrl(url, `${file.name}.png`);
      }
      this.toast.success('Export started');
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'Export failed');
    }
    this.cdr.markForCheck();
  }

  private shiftUnit(delta: number): void {
    const units = this.filteredUnits;
    if (!units.length) return;
    const idx = Math.max(0, units.findIndex((u) => u.id === this.selectedUnitId));
    const next = units[Math.min(units.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectUnit(next.id);
  }

  private resetViewForCurrent(): void {
    const parsed = this.parsed;
    this.query = '';
    this.selectedColumnIndex = 0;
    if (!parsed) {
      this.visibleIds = new Set();
      this.selectedUnitId = '';
      return;
    }
    const units = allStratUnits(parsed);
    this.visibleIds = new Set(units.map((u) => u.id));
    this.selectedUnitId = units[0]?.id ?? '';
  }

  private renderCanvas(): void {
    if (!this.isBrowser || this.viewMode === 'table') return;
    const canvas = this.canvasHost?.nativeElement;
    const parsed = this.parsed;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = Math.max(320, parent.clientWidth);
      canvas.height = Math.max(280, parent.clientHeight || 420);
    }
    if (!parsed?.columns.length) {
      this.clearCanvas();
      return;
    }
    if (this.viewMode === 'correlation') {
      renderStratCorrelation(canvas, parsed, {
        query: this.query,
        visibleIds: this.visibleIds,
        selectedId: this.selectedUnitId || null,
        scale: 'thickness'
      });
      return;
    }
    renderStratColumn(canvas, parsed, {
      columnIndex: this.selectedColumnIndex,
      query: this.query,
      visibleIds: this.visibleIds,
      selectedId: this.selectedUnitId || null,
      scale: this.viewMode === 'chrono' ? 'time' : 'thickness'
    });
  }

  private clearCanvas(): void {
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
