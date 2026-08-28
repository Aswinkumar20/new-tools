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
import {
  BC_ACCEPT_ATTR,
  BC_FORMATS_HINT,
  BC_FORMATS_LABEL,
  BC_RELATED_TOOLS,
  BC_SUPPORTED_EXTENSIONS
} from '../../constants/bim-clash-viewer.constants';
import type { BcTest, BcColumn, BcExportFormat, BcClash, BcLoadedFile, BcItem, BcViewMode } from '../../types/bim-clash-viewer.types';
import type { Cad3dView } from '../../utils/cad-3d.utils';
import { buildCadInsightStats, clampCadZoom, observeCadDocumentTheme } from '../../utils/cad-file.utils';
import {
  buildBcTestMetadata,
  buildBcMetadataRows,
  buildBcClashMetadata,
  buildBcItemMetadata,
  canExportBc,
  canvasToPngDataUrl,
  createBcFileRecord,
  createSampleBcFile,
  defaultCad3dView,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  exportBcRowsCsv,
  exportBcSchemaCsv,
  exportBcSummaryJson,
  filterBcTests,
  filterBcClashes,
  filterBcItems,
  filterBcRows,
  filterValidBcFiles,
  fitCad3dView,
  pickCad3dSolidAtScreen,
  sizeCadCanvas,
  formatBcFileSize,
  bcTypeColor,
  readBcFileBytes,
  renderBcTests,
  renderBcFocus,
  resolveBcSuggestion,
  toBcCad3d
} from '../../utils/bim-clash-viewer.utils';

@Component({
  selector: 'lib-bim-clash-viewer',
  standalone: true,
  templateUrl: './bim-clash-viewer.html',
  styleUrls: ['./bim-clash-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation, TooltipDirective, StatValueTooltipHostDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BimClashViewerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('canvasHost') canvasHost?: ElementRef<HTMLCanvasElement>;
  @ViewChild('mapWrap') mapWrap?: ElementRef<HTMLElement>;
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;
  @ViewChild('viewerPanel') viewerPanel?: ElementRef<HTMLElement>;

  readonly acceptAttr = BC_ACCEPT_ATTR;
  readonly relatedTools = BC_RELATED_TOOLS;
  readonly supportedExtensions = BC_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = BC_FORMATS_LABEL;
  readonly formatsHint = BC_FORMATS_HINT;
  readonly viewModes: Array<{ id: BcViewMode; label: string }> = [
    { id: 'clashes', label: 'Clashes' },
    { id: 'focus', label: 'Focus' },
    { id: 'tests', label: 'Tests' },
    { id: 'table', label: 'Rows' }
  ];

  files: BcLoadedFile[] = [];
  currentIndex = -1;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;
  viewMode: BcViewMode = 'clashes';
  query = '';
  selectedItemId = '';
  selectedTestId = '';
  selectedClashId = '';
  selectedRowIndex = 0;
  hiddenTestIds = new Set<string>();
  view: Cad3dView = defaultCad3dView();
  rotating = false;
  isFullscreen = false;

  private dragDepth = 0;
  private lastX = 0;
  private lastY = 0;
  private pointerMoved = 0;
  private resizeObserver: ResizeObserver | null = null;
  private stopThemeWatch: (() => void) | null = null;

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  get currentFile(): BcLoadedFile | null {
    return this.currentIndex >= 0 ? this.files[this.currentIndex] ?? null : null;
  }

  get parsed() {
    return this.currentFile?.parsed ?? null;
  }

  get canExport(): boolean {
    return canExportBc(this.currentFile);
  }

  get insights() {
    return buildCadInsightStats(
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

  get filteredItems(): BcItem[] {
    return this.parsed ? filterBcItems(this.parsed.items, this.query) : [];
  }

  get filteredTests(): BcTest[] {
    return this.parsed ? filterBcTests(this.parsed.tests, this.query) : [];
  }

  get filteredClashes(): BcClash[] {
    return this.parsed ? filterBcClashes(this.parsed.clashes, this.query) : [];
  }

  get filteredColumns(): BcColumn[] {
    return this.parsed?.columns ?? [];
  }

  get filteredRows(): Array<Record<string, string>> {
    return this.parsed ? filterBcRows(this.parsed.rows, this.query) : [];
  }

  get visibleItems(): BcItem[] {
    let items = this.hiddenTestIds.size
      ? this.filteredItems.filter((s) => !this.isTestKeyHidden(s.test))
      : this.filteredItems;
    if (this.viewMode === 'focus' && this.selectedClash) {
      const a = this.selectedClash.itemA;
      const b = this.selectedClash.itemB;
      items = items.filter((e) => e.name === a || e.id === a || e.name === b || e.id === b);
    }
    return items;
  }

  get visibleClashes(): BcClash[] {
    if (!this.hiddenTestIds.size) return this.filteredClashes;
    return this.filteredClashes.filter((c) => !this.isTestKeyHidden(c.test));
  }

  get selectedItem(): BcItem | null {
    return this.filteredItems.find((s) => s.id === this.selectedItemId) ?? null;
  }

  get selectedTest(): BcTest | null {
    return this.filteredTests.find((e) => e.id === this.selectedTestId) ?? null;
  }

  get selectedClash(): BcClash | null {
    return this.filteredClashes.find((inst) => inst.id === this.selectedClashId) ?? null;
  }

  get metadataRows() {
    return this.parsed ? buildBcMetadataRows(this.parsed) : [];
  }

  get itemMetadataRows() {
    return this.selectedItem ? buildBcItemMetadata(this.selectedItem) : [];
  }

  get testMetadataRows() {
    return this.selectedTest ? buildBcTestMetadata(this.selectedTest) : [];
  }

  get clashMetadataRows() {
    return this.selectedClash ? buildBcClashMetadata(this.selectedClash) : [];
  }

  get hasSelection(): boolean {
    return !!(this.selectedClashId || this.selectedItemId || this.selectedTestId);
  }

  get primarySuggestion() {
    const s = resolveBcSuggestion({ hasFiles: this.files.length > 0, hasError: !!this.errorMessage });
    return !s || s.id === this.dismissedSuggestionId ? null : s;
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;
    this.observeCanvasResize();
    this.stopThemeWatch = observeCadDocumentTheme(() => {
      this.renderCanvas();
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.stopThemeWatch?.();
    this.stopThemeWatch = null;
  }

  // ---------------------------------------------------------------------------
  // Host listeners
  // ---------------------------------------------------------------------------

  @HostListener('document:fullscreenchange')
  onFullscreenChange(): void {
    if (!this.isBrowser) return;
    this.isFullscreen = !!document.fullscreenElement;
    this.cdr.markForCheck();
    setTimeout(() => this.renderCanvas(), 0);
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    if (!this.showExportMenu) return;
    this.showExportMenu = false;
    this.cdr.markForCheck();
  }

  @HostListener('window:dragenter', ['$event'])
  onWindowDragEnter(event: DragEvent): void {
    if (!this.isBrowser || !this.isFileDrag(event)) return;
    event.preventDefault();
    this.dragDepth += 1;
    if (!this.showDropZone) {
      this.showDropZone = true;
      this.cdr.markForCheck();
    }
  }

  @HostListener('window:dragover', ['$event'])
  onWindowDragOver(event: DragEvent): void {
    if (!this.isBrowser || !this.isFileDrag(event)) return;
    event.preventDefault();
  }

  @HostListener('window:dragleave', ['$event'])
  onWindowDragLeave(event: DragEvent): void {
    if (!this.isBrowser || !this.isFileDrag(event)) return;
    event.preventDefault();
    this.dragDepth = Math.max(0, this.dragDepth - 1);
    if (this.dragDepth === 0 && this.showDropZone) {
      this.showDropZone = false;
      this.cdr.markForCheck();
    }
  }

  @HostListener('window:drop', ['$event'])
  async onWindowDrop(event: DragEvent): Promise<void> {
    if (!this.isBrowser || !this.isFileDrag(event)) return;
    event.preventDefault();
    this.dragDepth = 0;
    this.showDropZone = false;
    const files = event.dataTransfer?.files;
    if (files?.length) await this.handleFiles(Array.from(files));
    this.cdr.markForCheck();
  }

  @HostListener('window:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (!this.isBrowser) return;
    if (this.isTypingTarget(event.target)) {
      if (event.key === 'Escape') (event.target as HTMLElement).blur();
      return;
    }
    if (!this.parsed) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      if (this.isFullscreen) void document.exitFullscreen?.();
      else this.clearSelection();
    } else if (event.key === '0') {
      event.preventDefault();
      this.fitView();
    } else if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      this.zoomBy(1.2);
    } else if (event.key === '-') {
      event.preventDefault();
      this.zoomBy(1 / 1.2);
    } else if (event.key === '/') {
      event.preventDefault();
      this.searchInput?.nativeElement?.focus();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (this.viewMode === 'table') this.shiftRow(1);
      else if (this.viewMode === 'clashes') this.shiftClash(1);
      else if (this.viewMode === 'tests') this.shiftTest(1);
      else this.shiftItem(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (this.viewMode === 'table') this.shiftRow(-1);
      else if (this.viewMode === 'clashes') this.shiftClash(-1);
      else if (this.viewMode === 'tests') this.shiftTest(-1);
      else this.shiftItem(-1);
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      this.clearSearch();
    }
  }

  // ---------------------------------------------------------------------------
  // TrackBy / formatting
  // ---------------------------------------------------------------------------

  trackByFileId(_i: number, file: BcLoadedFile): string {
    return file.id;
  }

  trackByWarning(_i: number, warning: string): string {
    return warning;
  }

  trackByItem(_i: number, part: BcItem): string {
    return part.id;
  }

  trackByTest(_i: number, assembly: BcTest): string {
    return assembly.id;
  }

  trackByClash(_i: number, instance: BcClash): string {
    return instance.id;
  }

  trackByColumn(_i: number, column: BcColumn): string {
    return column.id;
  }

  trackByRowIndex(index: number): number {
    return index;
  }

  tint(type: string, index: number): string {
    return bcTypeColor(type, index);
  }

  rowValue(row: Record<string, string>, column: string): string {
    return row[column] || '';
  }

  isTestHidden(id: string): boolean {
    return this.hiddenTestIds.has(id);
  }

  formatSize(bytes: number): string {
    return formatBcFileSize(bytes);
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
    const { accepted, rejected } = filterValidBcFiles(files);
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
          const bytes = await readBcFileBytes(file);
          const record = createBcFileRecord(file, bytes);
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
          this.errorMessage = `${file.name}: ${error instanceof Error ? error.message : 'Invalid BIM clash dump'}`;
          this.toast.error(this.errorMessage);
        }
      }
      this.fitView();
      this.renderCanvas();
      if (this.currentFile) {
        this.toast.success(`Loaded ${this.currentFile.name}`);
        if (this.currentFile.softFail) {
          this.toast.warning('Parsed with little or no drawable geometry — metadata may still be available');
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
    await this.handleFiles([createSampleBcFile()]);
  }

  selectFile(index: number): void {
    if (index < 0 || index >= this.files.length || index === this.currentIndex) return;
    this.currentIndex = index;
    this.resetViewForCurrent();
    this.fitView();
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  removeFile(index: number, event: Event): void {
    event.stopPropagation();
    if (index < 0 || index >= this.files.length) return;
    const next = this.files.filter((_, i) => i !== index);
    this.files = next;
    this.showExportMenu = false;
    if (!next.length) {
      this.clearAll();
      return;
    }
    this.currentIndex = Math.min(index, next.length - 1);
    this.resetViewForCurrent();
    this.fitView();
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  clearAll(): void {
    this.files = [];
    this.currentIndex = -1;
    this.selectedItemId = '';
    this.selectedTestId = '';
    this.selectedClashId = '';
    this.selectedRowIndex = 0;
    this.hiddenTestIds = new Set();
    this.errorMessage = '';
    this.query = '';
    this.showExportMenu = false;
    this.showDropZone = false;
    this.dragDepth = 0;
    this.dismissedSuggestionId = null;
    this.viewMode = 'clashes';
    this.view = defaultCad3dView();
    this.clearCanvas();
    this.cdr.markForCheck();
  }

  // ---------------------------------------------------------------------------
  // Suggestions / view mode / sidebar / export
  // ---------------------------------------------------------------------------

  dismissSuggestion(id: string): void {
    this.dismissedSuggestionId = id;
    this.cdr.markForCheck();
  }

  applySuggestion(suggestion: { action: string }): void {
    if (suggestion.action === 'sample') void this.loadSample();
    else this.openFilePicker();
  }

  setViewMode(mode: BcViewMode): void {
    if (this.viewMode === mode) return;
    this.viewMode = mode;
    this.cdr.markForCheck();
    setTimeout(() => {
      if (mode !== 'table' && mode !== 'tests') this.fitView();
      this.renderCanvas();
    }, 0);
  }

  toggleSidebar(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;
    this.cdr.markForCheck();
    setTimeout(() => {
      this.fitView();
      this.renderCanvas();
    }, 0);
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

  exportAs(format: BcExportFormat, event: Event): void {
    event.stopPropagation();
    this.showExportMenu = false;
    const file = this.currentFile;
    if (!this.canExport || !file?.parsed) {
      this.toast.info('Nothing to export');
      this.cdr.markForCheck();
      return;
    }
    try {
      if (format === 'original') {
        downloadBinaryFile(file.bytes, file.name, 'application/octet-stream');
      } else if (format === 'summary-json') {
        downloadTextFile(exportBcSummaryJson(file), `${file.name}.summary.json`, 'application/json');
      } else if (format === 'schema-csv') {
        downloadTextFile(exportBcSchemaCsv(file.parsed), `${file.name}.schema.csv`, 'text/csv');
      } else if (format === 'rows-csv') {
        downloadTextFile(exportBcRowsCsv(file.parsed), `${file.name}.rows.csv`, 'text/csv');
      } else if (format === 'png') {
        const canvas = this.canvasHost?.nativeElement;
        if (!canvas || this.viewMode === 'table') {
          this.toast.info('Open Clashes, Focus, or Tests to export a PNG snapshot');
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
  // Selection / filter / tests
  // ---------------------------------------------------------------------------

  selectItem(id: string): void {
    this.selectedItemId = id;
    const item = this.filteredItems.find((e) => e.id === id);
    if (item?.test) {
      const test = this.parsed?.tests.find((t) => t.id === item.test || t.name === item.test);
      this.selectedTestId = test?.id ?? this.selectedTestId;
    }
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectTest(id: string): void {
    this.selectedTestId = id;
    const test = this.filteredTests.find((t) => t.id === id);
    const hit = this.visibleClashes.find(
      (c) => c.test === id || (!!test && (c.test === test.name || c.test === test.id))
    );
    if (hit) this.selectClash(hit.id);
    else {
      this.renderCanvas();
      this.cdr.markForCheck();
    }
  }

  selectClash(id: string): void {
    this.selectedClashId = id;
    const clash = this.filteredClashes.find((c) => c.id === id);
    if (clash) {
      const hit = this.filteredItems.find((e) => e.name === clash.itemA || e.id === clash.itemA);
      if (hit) this.selectedItemId = hit.id;
      if (clash.test) {
        const test = this.parsed?.tests.find((t) => t.id === clash.test || t.name === clash.test);
        this.selectedTestId = test?.id ?? this.selectedTestId;
      }
    }
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectRow(index: number): void {
    this.selectedRowIndex = index;
    const row = this.filteredRows[index];
    if (!row || !this.parsed) {
      this.renderCanvas();
      this.cdr.markForCheck();
      return;
    }
    const name = row['name'] || row['Name'] || '';
    const kind = (row['kind'] || row['type'] || row['Type'] || '').toLowerCase();
    if (
      kind === 'clash' ||
      kind === 'hard' ||
      kind === 'clearance' ||
      kind === 'duplicate' ||
      this.parsed.clashes.some((c) => c.name === name || c.id === name)
    ) {
      const clash = this.parsed.clashes.find((c) => c.name === name || c.id === name);
      if (clash) this.selectClash(clash.id);
    } else if (kind === 'test' || this.parsed.tests.some((t) => t.name === name || t.id === name)) {
      const test = this.parsed.tests.find((t) => t.name === name || t.id === name);
      if (test) this.selectTest(test.id);
    } else if (name) {
      const item = this.parsed.items.find((e) => e.name === name || e.id === name);
      if (item) this.selectItem(item.id);
      else this.selectedItemId = name;
    }
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  toggleTestVisible(id: string, event: Event): void {
    event.stopPropagation();
    if (this.hiddenTestIds.has(id)) this.hiddenTestIds.delete(id);
    else this.hiddenTestIds.add(id);
    this.hiddenTestIds = new Set(this.hiddenTestIds);
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  showAllTests(): void {
    if (!this.hiddenTestIds.size) return;
    this.hiddenTestIds = new Set();
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  onFilterChange(): void {
    if (this.selectedItemId && !this.filteredItems.some((s) => s.id === this.selectedItemId)) {
      this.selectedItemId = this.filteredItems[0]?.id ?? '';
    }
    if (this.selectedTestId && !this.filteredTests.some((e) => e.id === this.selectedTestId)) {
      this.selectedTestId = this.filteredTests[0]?.id ?? '';
    }
    if (this.selectedClashId && !this.filteredClashes.some((inst) => inst.id === this.selectedClashId)) {
      this.selectedClashId = this.filteredClashes[0]?.id ?? '';
    }
    if (this.selectedRowIndex >= this.filteredRows.length) {
      this.selectedRowIndex = Math.max(0, this.filteredRows.length - 1);
    }
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  clearSearch(): void {
    this.query = '';
    this.onFilterChange();
  }

  clearSelection(): void {
    this.selectedClashId = '';
    this.selectedItemId = '';
    this.selectedTestId = '';
    this.selectedRowIndex = -1;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  // ---------------------------------------------------------------------------
  // View / canvas interaction
  // ---------------------------------------------------------------------------

  zoomBy(factor: number): void {
    if (!this.parsed || this.viewMode === 'table' || this.viewMode === 'tests') return;
    this.view = { ...this.view, zoom: clampCadZoom(this.view.zoom * factor, 0.08, 12) };
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  resetView(): void {
    this.view = defaultCad3dView();
    this.fitView();
  }

  fitView(): void {
    if (!this.isBrowser || this.viewMode === 'table' || this.viewMode === 'tests') return;
    const canvas = this.canvasHost?.nativeElement;
    if (!canvas || !this.parsed) return;
    const { width, height } = sizeCadCanvas(canvas);
    const solids = toBcCad3d(this.visibleItems);
    this.view = fitCad3dView(solids, width, height);
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  async toggleFullscreen(): Promise<void> {
    if (!this.isBrowser) return;
    const host = this.viewerPanel?.nativeElement;
    if (!host) return;
    const requestFs = host.requestFullscreen?.bind(host);
    if (!requestFs) {
      this.toast.info('Fullscreen is not available in this browser');
      return;
    }
    try {
      if (!document.fullscreenElement) await requestFs();
      else await document.exitFullscreen();
    } catch {
      this.toast.info('Fullscreen is not available in this browser');
    }
  }

  onCanvasPointerDown(event: PointerEvent): void {
    this.rotating = true;
    this.pointerMoved = 0;
    this.lastX = event.clientX;
    this.lastY = event.clientY;
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
  }

  onCanvasPointerMove(event: PointerEvent): void {
    if (!this.rotating) return;
    const dx = event.clientX - this.lastX;
    const dy = event.clientY - this.lastY;
    this.pointerMoved += Math.abs(dx) + Math.abs(dy);
    this.lastX = event.clientX;
    this.lastY = event.clientY;
    if (this.viewMode === 'tests') return;
    this.view = {
      ...this.view,
      rotY: this.view.rotY + dx * 0.01,
      rotX: Math.max(-1.4, Math.min(1.4, this.view.rotX + dy * 0.01))
    };
    this.renderCanvas();
  }

  onCanvasPointerUp(event?: PointerEvent): void {
    const wasClick = this.rotating && this.pointerMoved <= 8;
    this.rotating = false;
    if (!wasClick || !event || !this.parsed || this.viewMode === 'table' || this.viewMode === 'tests') return;
    const canvas = this.canvasHost?.nativeElement;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const sx = ((event.clientX - rect.left) * canvas.width) / rect.width;
    const sy = ((event.clientY - rect.top) * canvas.height) / rect.height;
    const id = pickCad3dSolidAtScreen(toBcCad3d(this.visibleItems), this.view, canvas.width, canvas.height, sx, sy);
    if (id) this.selectItem(id);
    else this.clearSelection();
  }

  onCanvasWheel(event: WheelEvent): void {
    if (!this.parsed || this.viewMode === 'table' || this.viewMode === 'tests') return;
    event.preventDefault();
    const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
    this.view = { ...this.view, zoom: clampCadZoom(this.view.zoom * factor, 0.08, 12) };
    this.renderCanvas();
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private shiftItem(delta: number): void {
    const list = this.visibleItems;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((s) => s.id === this.selectedItemId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectItem(next.id);
  }

  private shiftTest(delta: number): void {
    const list = this.filteredTests;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((e) => e.id === this.selectedTestId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectTest(next.id);
  }

  private shiftClash(delta: number): void {
    const list = this.visibleClashes;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((inst) => inst.id === this.selectedClashId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectClash(next.id);
  }

  private shiftRow(delta: number): void {
    const list = this.filteredRows;
    if (!list.length) return;
    const base = this.selectedRowIndex < 0 ? 0 : this.selectedRowIndex;
    this.selectRow(Math.min(list.length - 1, Math.max(0, base + delta)));
  }

  private isTestKeyHidden(testKey: string): boolean {
    if (!testKey) return false;
    if (this.hiddenTestIds.has(testKey)) return true;
    const test = this.parsed?.tests.find((t) => t.id === testKey || t.name === testKey);
    return !!test && this.hiddenTestIds.has(test.id);
  }

  private resetViewForCurrent(): void {
    this.query = '';
    this.hiddenTestIds = new Set();
    this.selectedItemId = this.parsed?.items[0]?.id ?? '';
    this.selectedTestId = this.parsed?.tests[0]?.id ?? '';
    this.selectedClashId = this.parsed?.clashes[0]?.id ?? '';
    this.selectedRowIndex = 0;
    this.view = defaultCad3dView();
  }

  private renderCanvas(): void {
    if (!this.isBrowser || this.viewMode === 'table') return;
    const canvas = this.canvasHost?.nativeElement;
    if (!canvas || !this.parsed) return;
    sizeCadCanvas(canvas);
    if (this.viewMode === 'tests') {
      renderBcTests(canvas, this.filteredTests, this.selectedTestId || null);
      return;
    }
    let selectedId = this.selectedItemId || null;
    if (this.viewMode === 'clashes' && this.selectedClash) {
      selectedId =
        this.visibleItems.find((e) => e.name === this.selectedClash?.itemA || e.id === this.selectedClash?.itemA)?.id ??
        selectedId;
    }
    renderBcFocus(canvas, this.visibleItems, selectedId, this.view);
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
