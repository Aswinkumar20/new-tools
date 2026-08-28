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
  DEP_ACCEPT_ATTR,
  DEP_FORMATS_HINT,
  DEP_FORMATS_LABEL,
  DEP_RELATED_TOOLS,
  DEP_SUPPORTED_EXTENSIONS
} from '../../constants/dependency-graph-viewer.constants';
import type {
  DepCycle,
  DepEdge,
  DepExportFormat,
  DepLoadedFile,
  DepPackage,
  DepTreeRow,
  DepViewMode
} from '../../types/dependency-graph-viewer.types';
import {
  buildDepCycleMetadata,
  buildDepEdgeMetadata,
  buildDepMetadataRows,
  buildDepPackageMetadata,
  canExportDep,
  canvasToPngDataUrl,
  createDepFileRecord,
  createSampleDepFile,
  depPackageColor,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  exportDepEdgesCsv,
  exportDepPackagesCsv,
  exportDepSummaryJson,
  filterDepCycles,
  filterDepEdges,
  filterDepPackages,
  filterDepTree,
  filterValidDepFiles,
  formatDepFileSize,
  readDepFileBytes,
  renderDepCycles,
  renderDepDiagram,
  renderDepEdges,
  renderDepTree,
  resolveDepSuggestion
} from '../../utils/dependency-graph-viewer.utils';

@Component({
  selector: 'lib-dependency-graph-viewer',
  standalone: true,
  templateUrl: './dependency-graph-viewer.html',
  styleUrls: ['./dependency-graph-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation, TooltipDirective, StatValueTooltipHostDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DependencyGraphViewerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('canvasHost') canvasHost?: ElementRef<HTMLCanvasElement>;
  @ViewChild('mapWrap') mapWrap?: ElementRef<HTMLElement>;
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  readonly acceptAttr = DEP_ACCEPT_ATTR;
  readonly relatedTools = DEP_RELATED_TOOLS;
  readonly supportedExtensions = DEP_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = DEP_FORMATS_LABEL;
  readonly formatsHint = DEP_FORMATS_HINT;
  readonly viewModes: Array<{ id: DepViewMode; label: string }> = [
    { id: 'diagram', label: 'Diagram' },
    { id: 'tree', label: 'Tree' },
    { id: 'cycles', label: 'Cycles' },
    { id: 'table', label: 'Table' }
  ];

  files: DepLoadedFile[] = [];
  currentIndex = -1;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;
  viewMode: DepViewMode = 'diagram';
  query = '';
  selectedPackageId = '';
  selectedCycleId = '';
  selectedEdgeId = '';

  private dragDepth = 0;
  private resizeObserver: ResizeObserver | null = null;

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  get currentFile(): DepLoadedFile | null {
    return this.currentIndex >= 0 ? this.files[this.currentIndex] ?? null : null;
  }

  get parsed() {
    return this.currentFile?.parsed ?? null;
  }

  get canExport(): boolean {
    return canExportDep(this.currentFile);
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

  get selectedPackage(): DepPackage | null {
    return this.parsed?.packages.find((p) => p.id === this.selectedPackageId) ?? null;
  }

  get selectedCycle(): DepCycle | null {
    return this.parsed?.cycles.find((c) => c.id === this.selectedCycleId) ?? null;
  }

  get selectedEdge(): DepEdge | null {
    return this.parsed?.edges.find((e) => e.id === this.selectedEdgeId) ?? null;
  }

  get filteredPackages(): DepPackage[] {
    return this.parsed ? filterDepPackages(this.parsed.packages, this.query) : [];
  }

  get filteredEdges(): DepEdge[] {
    return this.parsed ? filterDepEdges(this.parsed.edges, this.query) : [];
  }

  get filteredCycles(): DepCycle[] {
    return this.parsed ? filterDepCycles(this.parsed.cycles, this.query) : [];
  }

  get filteredTree(): DepTreeRow[] {
    return this.parsed ? filterDepTree(this.parsed.tree, this.query) : [];
  }

  get cyclicIds(): Set<string> {
    const ids = new Set<string>();
    for (const cycle of this.parsed?.cycles ?? []) {
      for (const node of cycle.nodes) ids.add(node);
    }
    return ids;
  }

  get metadataRows() {
    return this.parsed ? buildDepMetadataRows(this.parsed) : [];
  }

  get packageMetadataRows() {
    return this.selectedPackage ? buildDepPackageMetadata(this.selectedPackage) : [];
  }

  get cycleMetadataRows() {
    return this.selectedCycle ? buildDepCycleMetadata(this.selectedCycle) : [];
  }

  get edgeMetadataRows() {
    return this.selectedEdge ? buildDepEdgeMetadata(this.selectedEdge) : [];
  }

  get primarySuggestion() {
    const s = resolveDepSuggestion({ hasFiles: this.files.length > 0, hasError: !!this.errorMessage });
    return !s || s.id === this.dismissedSuggestionId ? null : s;
  }

  // ---------------------------------------------------------------------------
  // Display helpers
  // ---------------------------------------------------------------------------

  tint(kind: string, index: number): string {
    return depPackageColor(kind, index);
  }

  formatSize(bytes: number): string {
    return formatDepFileSize(bytes);
  }

  isCyclicPackage(id: string): boolean {
    return this.cyclicIds.has(id);
  }

  treeIndent(depth: number): string {
    return `${Math.max(0, depth) * 12}px`;
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
      if (this.viewMode === 'table') this.shiftEdge(1);
      else if (this.viewMode === 'cycles') this.shiftCycle(1);
      else if (this.viewMode === 'tree') this.shiftTree(1);
      else this.shiftPackage(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (this.viewMode === 'table') this.shiftEdge(-1);
      else if (this.viewMode === 'cycles') this.shiftCycle(-1);
      else if (this.viewMode === 'tree') this.shiftTree(-1);
      else this.shiftPackage(-1);
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      this.query = '';
      this.onFilterChange();
    }
  }

  // ---------------------------------------------------------------------------
  // TrackBy
  // ---------------------------------------------------------------------------

  trackByFileId(_i: number, file: DepLoadedFile): string {
    return file.id;
  }

  trackByWarning(_i: number, warning: string): string {
    return warning;
  }

  trackByPackage(_i: number, pkg: DepPackage): string {
    return pkg.id;
  }

  trackByTree(_i: number, row: DepTreeRow): string {
    return row.id;
  }

  trackByCycle(_i: number, cycle: DepCycle): string {
    return cycle.id;
  }

  trackByEdge(_i: number, edge: DepEdge): string {
    return edge.id;
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
    const { accepted, rejected } = filterValidDepFiles(files);
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
          const bytes = await readDepFileBytes(file);
          const record = createDepFileRecord(file, bytes);
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
          this.errorMessage = `${file.name}: ${error instanceof Error ? error.message : 'Invalid dependency graph'}`;
          this.toast.error(this.errorMessage);
        }
      }
      this.renderCanvas();
      if (this.currentFile) {
        this.toast.success(`Loaded ${this.currentFile.name}`);
        if (this.currentFile.softFail) {
          this.toast.warning('Parsed with little or no packages — metadata may still be available');
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
    await this.handleFiles([createSampleDepFile()]);
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
    this.selectedPackageId = '';
    this.selectedCycleId = '';
    this.selectedEdgeId = '';
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

  selectPackage(id: string): void {
    this.selectedPackageId = id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectCycle(id: string): void {
    this.selectedCycleId = id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectEdge(id: string): void {
    this.selectedEdgeId = id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  onFilterChange(): void {
    if (this.selectedPackageId && !this.filteredPackages.some((p) => p.id === this.selectedPackageId)) {
      this.selectedPackageId = this.filteredPackages[0]?.id ?? '';
    }
    if (this.selectedEdgeId && !this.filteredEdges.some((e) => e.id === this.selectedEdgeId)) {
      this.selectedEdgeId = this.filteredEdges[0]?.id ?? '';
    }
    if (this.selectedCycleId && !this.filteredCycles.some((c) => c.id === this.selectedCycleId)) {
      this.selectedCycleId = this.filteredCycles[0]?.id ?? '';
    }
    if (this.viewMode === 'tree' && this.selectedPackageId && !this.filteredTree.some((r) => r.id === this.selectedPackageId)) {
      this.selectedPackageId = this.filteredTree[0]?.id ?? '';
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

  setViewMode(mode: DepViewMode): void {
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

  exportAs(format: DepExportFormat, event: Event): void {
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
      else if (format === 'summary-json') downloadTextFile(exportDepSummaryJson(file), `${file.name}.summary.json`, 'application/json');
      else if (format === 'packages-csv') downloadTextFile(exportDepPackagesCsv(file.parsed), `${file.name}.packages.csv`, 'text/csv');
      else if (format === 'edges-csv') downloadTextFile(exportDepEdgesCsv(file.parsed), `${file.name}.edges.csv`, 'text/csv');
      else if (format === 'png') {
        const canvas = this.canvasHost?.nativeElement;
        if (!canvas || this.viewMode === 'table') {
          this.toast.info('Open Diagram, Tree, or Cycles to export a PNG snapshot');
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

  private shiftPackage(delta: number): void {
    const list = this.filteredPackages;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((p) => p.id === this.selectedPackageId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectPackage(next.id);
  }

  private shiftTree(delta: number): void {
    const list = this.filteredTree;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((r) => r.id === this.selectedPackageId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectPackage(next.id);
  }

  private shiftCycle(delta: number): void {
    const list = this.filteredCycles;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((c) => c.id === this.selectedCycleId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectCycle(next.id);
  }

  private shiftEdge(delta: number): void {
    const list = this.filteredEdges;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((e) => e.id === this.selectedEdgeId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectEdge(next.id);
  }

  private resetViewForCurrent(): void {
    this.query = '';
    this.selectedPackageId = this.parsed?.packages[0]?.id ?? '';
    this.selectedCycleId = this.parsed?.cycles[0]?.id ?? '';
    this.selectedEdgeId = this.parsed?.edges[0]?.id ?? '';
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
      renderDepDiagram(canvas, this.parsed.packages, this.parsed.edges, this.selectedPackageId || null, this.cyclicIds);
    } else if (this.viewMode === 'tree') {
      renderDepTree(canvas, this.filteredTree, this.selectedPackageId || null);
    } else if (this.viewMode === 'cycles') {
      renderDepCycles(canvas, this.filteredCycles, this.selectedCycleId || null);
    } else renderDepEdges(canvas, this.filteredEdges, this.selectedEdgeId || null);
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
