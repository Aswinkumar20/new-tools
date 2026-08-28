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
  GML_ACCEPT_ATTR,
  GML_FORMATS_HINT,
  GML_FORMATS_LABEL,
  GML_RELATED_TOOLS,
  GML_SUPPORTED_EXTENSIONS
} from '../../constants/graphml-viewer.constants';
import type {
  GmlCommunity,
  GmlEdge,
  GmlExportFormat,
  GmlLoadedFile,
  GmlNode,
  GmlViewMode
} from '../../types/graphml-viewer.types';
import {
  buildGmlCommunityMetadata,
  buildGmlEdgeMetadata,
  buildGmlMetadataRows,
  buildGmlNodeMetadata,
  canExportGml,
  canvasToPngDataUrl,
  createGmlFileRecord,
  createSampleGmlFile,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  exportGmlEdgesCsv,
  exportGmlNodesCsv,
  exportGmlSummaryJson,
  filterGmlEdges,
  filterGmlNodes,
  filterValidGmlFiles,
  formatGmlFileSize,
  gmlCommunityColor,
  gmlNodeColor,
  readGmlFileBytes,
  relayoutGml,
  renderGmlCommunities,
  renderGmlDiagram,
  renderGmlEdges,
  renderGmlLayout,
  resolveGmlSuggestion
} from '../../utils/graphml-viewer.utils';

@Component({
  selector: 'lib-graphml-viewer',
  standalone: true,
  templateUrl: './graphml-viewer.html',
  styleUrls: ['./graphml-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation, TooltipDirective, StatValueTooltipHostDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GraphmlViewerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('canvasHost') canvasHost?: ElementRef<HTMLCanvasElement>;
  @ViewChild('mapWrap') mapWrap?: ElementRef<HTMLElement>;
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  readonly acceptAttr = GML_ACCEPT_ATTR;
  readonly relatedTools = GML_RELATED_TOOLS;
  readonly supportedExtensions = GML_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = GML_FORMATS_LABEL;
  readonly formatsHint = GML_FORMATS_HINT;
  readonly viewModes: Array<{ id: GmlViewMode; label: string }> = [
    { id: 'diagram', label: 'Diagram' },
    { id: 'layout', label: 'Layout' },
    { id: 'communities', label: 'Communities' },
    { id: 'table', label: 'Table' }
  ];

  files: GmlLoadedFile[] = [];
  currentIndex = -1;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;
  viewMode: GmlViewMode = 'diagram';
  layoutMode: 'rank' | 'community' = 'rank';
  query = '';
  selectedNodeId = '';
  selectedEdgeId = '';
  selectedCommunityId = '';

  private dragDepth = 0;
  private resizeObserver: ResizeObserver | null = null;

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  get currentFile(): GmlLoadedFile | null {
    return this.currentIndex >= 0 ? this.files[this.currentIndex] ?? null : null;
  }

  get parsed() {
    return this.currentFile?.parsed ?? null;
  }

  get canExport(): boolean {
    return canExportGml(this.currentFile);
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

  get selectedNode(): GmlNode | null {
    return this.parsed?.nodes.find((n) => n.id === this.selectedNodeId) ?? null;
  }

  get selectedEdge(): GmlEdge | null {
    return this.parsed?.edges.find((e) => e.id === this.selectedEdgeId) ?? null;
  }

  get selectedCommunity(): GmlCommunity | null {
    return this.parsed?.communities.find((c) => c.id === this.selectedCommunityId || c.name === this.selectedCommunityId) ?? null;
  }

  get filteredNodes(): GmlNode[] {
    const comm = this.viewMode === 'communities' ? this.selectedCommunity?.name || '' : '';
    return this.parsed ? filterGmlNodes(this.parsed.nodes, this.query, comm) : [];
  }

  get filteredEdges(): GmlEdge[] {
    return this.parsed ? filterGmlEdges(this.parsed.edges, this.query) : [];
  }

  get communities() {
    return this.parsed?.communities ?? [];
  }

  get metadataRows() {
    return this.parsed ? buildGmlMetadataRows(this.parsed) : [];
  }

  get nodeMetadataRows() {
    return this.selectedNode ? buildGmlNodeMetadata(this.selectedNode) : [];
  }

  get edgeMetadataRows() {
    return this.selectedEdge ? buildGmlEdgeMetadata(this.selectedEdge) : [];
  }

  get communityMetadataRows() {
    return this.selectedCommunity ? buildGmlCommunityMetadata(this.selectedCommunity) : [];
  }

  get primarySuggestion() {
    const s = resolveGmlSuggestion({ hasFiles: this.files.length > 0, hasError: !!this.errorMessage });
    return !s || s.id === this.dismissedSuggestionId ? null : s;
  }

  nodeTint(node: GmlNode): string {
    return this.parsed ? gmlNodeColor(node, this.parsed.communities) : '#c4b5fd';
  }

  communityTint(index: number): string {
    return gmlCommunityColor(index);
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
      else if (this.viewMode === 'communities') this.shiftCommunity(1);
      else this.shiftNode(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (this.viewMode === 'table') this.shiftEdge(-1);
      else if (this.viewMode === 'communities') this.shiftCommunity(-1);
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

  trackByFileId(_i: number, file: GmlLoadedFile): string {
    return file.id;
  }

  trackByWarning(_i: number, warning: string): string {
    return warning;
  }

  trackByNode(_i: number, node: GmlNode): string {
    return node.id;
  }

  trackByEdge(_i: number, edge: GmlEdge): string {
    return edge.id;
  }

  trackByCommunity(_i: number, community: GmlCommunity): string {
    return community.id;
  }

  formatSize(bytes: number): string {
    return formatGmlFileSize(bytes);
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
    const { accepted, rejected } = filterValidGmlFiles(files);
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
          const bytes = await readGmlFileBytes(file);
          const record = createGmlFileRecord(file, bytes);
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
          this.errorMessage = `${file.name}: ${error instanceof Error ? error.message : 'Invalid GraphML network'}`;
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
    await this.handleFiles([createSampleGmlFile()]);
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
    this.selectedCommunityId = '';
    this.errorMessage = '';
    this.query = '';
    this.layoutMode = 'rank';
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

  selectCommunity(id: string): void {
    this.selectedCommunityId = id;
    const comm = this.parsed?.communities.find((c) => c.id === id || c.name === id);
    if (comm?.nodeIds[0]) this.selectedNodeId = comm.nodeIds[0];
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  setLayoutMode(mode: 'rank' | 'community'): void {
    if (this.layoutMode === mode) return;
    const file = this.currentFile;
    if (!file?.parsed) return;
    this.layoutMode = mode;
    file.parsed = relayoutGml(file.parsed, mode);
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
    if (
      this.viewMode === 'communities' &&
      this.selectedCommunityId &&
      !this.communities.some((c) => c.id === this.selectedCommunityId || c.name === this.selectedCommunityId)
    ) {
      this.selectedCommunityId = this.communities[0]?.id ?? '';
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

  setViewMode(mode: GmlViewMode): void {
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

  exportAs(format: GmlExportFormat, event: Event): void {
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
      else if (format === 'summary-json') downloadTextFile(exportGmlSummaryJson(file), `${file.name}.summary.json`, 'application/json');
      else if (format === 'nodes-csv') downloadTextFile(exportGmlNodesCsv(file.parsed), `${file.name}.nodes.csv`, 'text/csv');
      else if (format === 'edges-csv') downloadTextFile(exportGmlEdgesCsv(file.parsed), `${file.name}.edges.csv`, 'text/csv');
      else if (format === 'png') {
        const canvas = this.canvasHost?.nativeElement;
        if (!canvas || this.viewMode === 'table') {
          this.toast.info('Open Diagram, Layout, or Communities to export a PNG snapshot');
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

  private shiftCommunity(delta: number): void {
    const list = this.communities;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((c) => c.id === this.selectedCommunityId || c.name === this.selectedCommunityId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectCommunity(next.id);
  }

  private resetViewForCurrent(): void {
    this.query = '';
    this.layoutMode = 'rank';
    this.selectedNodeId = this.parsed?.nodes[0]?.id ?? '';
    this.selectedEdgeId = this.parsed?.edges[0]?.id ?? '';
    this.selectedCommunityId = this.parsed?.communities[0]?.id ?? '';
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
      renderGmlDiagram(canvas, this.parsed.nodes, this.parsed.edges, this.parsed.communities, this.selectedNodeId || null);
    } else if (this.viewMode === 'layout') {
      renderGmlLayout(canvas, this.filteredNodes, this.selectedNodeId || null);
    } else if (this.viewMode === 'communities') {
      renderGmlCommunities(canvas, this.communities, this.selectedCommunityId || null);
    } else renderGmlEdges(canvas, this.filteredEdges, this.selectedEdgeId || null);
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
