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
  GVZ_ACCEPT_ATTR,
  GVZ_FORMATS_HINT,
  GVZ_FORMATS_LABEL,
  GVZ_LAYOUTS,
  GVZ_RELATED_TOOLS,
  GVZ_SUPPORTED_EXTENSIONS
} from '../../constants/graphviz-dot-viewer.constants';
import type {
  GvzEdge,
  GvzExportFormat,
  GvzLayout,
  GvzLoadedFile,
  GvzNode,
  GvzViewMode
} from '../../types/graphviz-dot-viewer.types';
import {
  buildGvzEdgeMetadata,
  buildGvzMetadataRows,
  buildGvzNodeMetadata,
  canExportGvz,
  canvasToPngDataUrl,
  createGvzFileRecord,
  createSampleGvzFile,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  exportGvzEdgesCsv,
  exportGvzNodesCsv,
  exportGvzSummaryJson,
  exportGvzSvg,
  filterGvzEdges,
  filterGvzNodes,
  filterValidGvzFiles,
  formatGvzFileSize,
  gvzNodeColor,
  readGvzFileBytes,
  relayoutGvz,
  renderGvzGraph,
  renderGvzNodes,
  resolveGvzSuggestion
} from '../../utils/graphviz-dot-viewer.utils';

@Component({
  selector: 'lib-graphviz-dot-viewer',
  standalone: true,
  templateUrl: './graphviz-dot-viewer.html',
  styleUrls: ['./graphviz-dot-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation, TooltipDirective, StatValueTooltipHostDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GraphvizDotViewerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('canvasHost') canvasHost?: ElementRef<HTMLCanvasElement>;
  @ViewChild('mapWrap') mapWrap?: ElementRef<HTMLElement>;
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  readonly acceptAttr = GVZ_ACCEPT_ATTR;
  readonly relatedTools = GVZ_RELATED_TOOLS;
  readonly supportedExtensions = GVZ_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = GVZ_FORMATS_LABEL;
  readonly formatsHint = GVZ_FORMATS_HINT;
  readonly layouts = GVZ_LAYOUTS;
  readonly viewModes: Array<{ id: GvzViewMode; label: string }> = [
    { id: 'layout', label: 'Layout' },
    { id: 'graph', label: 'Graph' },
    { id: 'nodes', label: 'Nodes' },
    { id: 'table', label: 'Table' }
  ];

  files: GvzLoadedFile[] = [];
  currentIndex = -1;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;
  viewMode: GvzViewMode = 'layout';
  query = '';
  selectedNodeId = '';
  selectedEdgeId = '';
  selectedLayout: GvzLayout = 'dot';

  private dragDepth = 0;
  private resizeObserver: ResizeObserver | null = null;

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  get currentFile(): GvzLoadedFile | null {
    return this.currentIndex >= 0 ? this.files[this.currentIndex] ?? null : null;
  }

  get parsed() {
    return this.currentFile?.parsed ?? null;
  }

  get canExport(): boolean {
    return canExportGvz(this.currentFile);
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

  get selectedNode(): GvzNode | null {
    return this.parsed?.nodes.find((n) => n.id === this.selectedNodeId) ?? null;
  }

  get selectedEdge(): GvzEdge | null {
    return this.parsed?.edges.find((e) => e.id === this.selectedEdgeId) ?? null;
  }

  get filteredNodes(): GvzNode[] {
    return this.parsed ? filterGvzNodes(this.parsed.nodes, this.query) : [];
  }

  get filteredEdges(): GvzEdge[] {
    return this.parsed ? filterGvzEdges(this.parsed.edges, this.query) : [];
  }

  get metadataRows() {
    return this.parsed ? buildGvzMetadataRows(this.parsed) : [];
  }

  get nodeMetadataRows() {
    return this.selectedNode ? buildGvzNodeMetadata(this.selectedNode) : [];
  }

  get edgeMetadataRows() {
    return this.selectedEdge ? buildGvzEdgeMetadata(this.selectedEdge) : [];
  }

  get primarySuggestion() {
    const s = resolveGvzSuggestion({ hasFiles: this.files.length > 0, hasError: !!this.errorMessage });
    return !s || s.id === this.dismissedSuggestionId ? null : s;
  }

  tint(shape: string, index: number): string {
    return gvzNodeColor(shape, index);
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
      else this.shiftNode(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (this.viewMode === 'table') this.shiftEdge(-1);
      else this.shiftNode(-1);
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      this.query = '';
      this.onFilterChange();
    }
  }

  // ---------------------------------------------------------------------------
  // TrackBy / formatters
  // ---------------------------------------------------------------------------

  trackByFileId(_i: number, file: GvzLoadedFile): string {
    return file.id;
  }

  trackByWarning(_i: number, warning: string): string {
    return warning;
  }

  trackByNode(_i: number, node: GvzNode): string {
    return node.id;
  }

  trackByEdge(_i: number, edge: GvzEdge): string {
    return edge.id;
  }

  formatSize(bytes: number): string {
    return formatGvzFileSize(bytes);
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
    const { accepted, rejected } = filterValidGvzFiles(files);
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
          const bytes = await readGvzFileBytes(file);
          const record = createGvzFileRecord(file, bytes);
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
          this.errorMessage = `${file.name}: ${error instanceof Error ? error.message : 'Invalid DOT graph'}`;
          this.toast.error(this.errorMessage);
        }
      }
      this.renderCanvas();
      if (this.currentFile) {
        this.toast.success(`Loaded ${this.currentFile.name}`);
        if (this.currentFile.softFail) {
          this.toast.warning('Parsed with little or no nodes — metadata may still be available');
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
    await this.handleFiles([createSampleGvzFile()]);
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
    this.selectedNodeId = '';
    this.selectedEdgeId = '';
    this.selectedLayout = 'dot';
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
  // Selection / filter / layout
  // ---------------------------------------------------------------------------

  selectNode(id: string): void {
    this.selectedNodeId = id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectEdge(id: string): void {
    this.selectedEdgeId = id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  setLayout(layout: GvzLayout): void {
    if (this.selectedLayout === layout) return;
    const file = this.currentFile;
    if (!file?.parsed) return;
    this.selectedLayout = layout;
    relayoutGvz(file.parsed, layout);
    this.files = [...this.files];
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  onFilterChange(): void {
    if (this.selectedNodeId && !this.filteredNodes.some((n) => n.id === this.selectedNodeId)) {
      this.selectedNodeId = this.filteredNodes[0]?.id ?? '';
    }
    if (this.selectedEdgeId && !this.filteredEdges.some((e) => e.id === this.selectedEdgeId)) {
      this.selectedEdgeId = this.filteredEdges[0]?.id ?? '';
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

  setViewMode(mode: GvzViewMode): void {
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

  exportAs(format: GvzExportFormat, event: Event): void {
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
      else if (format === 'summary-json') downloadTextFile(exportGvzSummaryJson(file), `${file.name}.summary.json`, 'application/json');
      else if (format === 'nodes-csv') downloadTextFile(exportGvzNodesCsv(file.parsed), `${file.name}.nodes.csv`, 'text/csv');
      else if (format === 'edges-csv') downloadTextFile(exportGvzEdgesCsv(file.parsed), `${file.name}.edges.csv`, 'text/csv');
      else if (format === 'svg') downloadTextFile(exportGvzSvg(file.parsed.nodes, file.parsed.edges), `${file.name}.svg`, 'image/svg+xml');
      else if (format === 'png') {
        const canvas = this.canvasHost?.nativeElement;
        if (!canvas || this.viewMode === 'table') {
          this.toast.info('Open Layout, Graph, or Nodes to export a PNG snapshot');
          return;
        }
        const url = canvasToPngDataUrl(canvas);
        if (!url) {
          this.toast.error('Could not capture PNG snapshot');
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

  private shiftNode(delta: number): void {
    const list = this.filteredNodes;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((n) => n.id === this.selectedNodeId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectNode(next.id);
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
    this.selectedLayout = this.parsed?.layout ?? 'dot';
    this.selectedNodeId = this.parsed?.nodes[0]?.id ?? '';
    this.selectedEdgeId = this.parsed?.edges[0]?.id ?? '';
  }

  private renderCanvas(): void {
    if (!this.isBrowser || this.viewMode === 'table') return;
    const canvas = this.canvasHost?.nativeElement;
    if (!canvas || !this.parsed) return;
    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = Math.max(320, parent.clientWidth);
      canvas.height = Math.max(180, Math.min(this.viewMode === 'layout' || this.viewMode === 'graph' ? 280 : 220, parent.clientHeight || 240));
    }
    if (this.viewMode === 'nodes') {
      renderGvzNodes(canvas, this.filteredNodes, this.selectedNodeId || null);
    } else {
      renderGvzGraph(canvas, this.parsed.nodes, this.parsed.edges, this.selectedNodeId || this.selectedEdgeId || null);
    }
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
