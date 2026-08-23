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
  GXF_ACCEPT_ATTR,
  GXF_FORMATS_HINT,
  GXF_FORMATS_LABEL,
  GXF_RELATED_TOOLS,
  GXF_SUPPORTED_EXTENSIONS
} from '../../constants/gexf-viewer.constants';
import type {
  GxfCommunity,
  GxfEdge,
  GxfExportFormat,
  GxfLoadedFile,
  GxfNode,
  GxfViewMode
} from '../../types/gexf-viewer.types';
import {
  buildGxfCommunityMetadata,
  buildGxfEdgeMetadata,
  buildGxfMetadataRows,
  buildGxfNodeMetadata,
  canExportGxf,
  canvasToPngDataUrl,
  createGxfFileRecord,
  createSampleGxfFile,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  exportGxfEdgesCsv,
  exportGxfNodesCsv,
  exportGxfSummaryJson,
  filterGxfEdges,
  filterGxfNodes,
  filterValidGxfFiles,
  formatGxfFileSize,
  gxfCommunityColor,
  gxfNodeColor,
  readGxfFileBytes,
  renderGxfCommunities,
  renderGxfDiagram,
  renderGxfEdges,
  renderGxfTimeline,
  resolveGxfSuggestion
} from '../../utils/gexf-viewer.utils';

@Component({
  selector: 'lib-gexf-viewer',
  standalone: true,
  templateUrl: './gexf-viewer.html',
  styleUrls: ['./gexf-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation, TooltipDirective, StatValueTooltipHostDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GexfViewerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('canvasHost') canvasHost?: ElementRef<HTMLCanvasElement>;
  @ViewChild('mapWrap') mapWrap?: ElementRef<HTMLElement>;
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  readonly acceptAttr = GXF_ACCEPT_ATTR;
  readonly relatedTools = GXF_RELATED_TOOLS;
  readonly supportedExtensions = GXF_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = GXF_FORMATS_LABEL;
  readonly formatsHint = GXF_FORMATS_HINT;
  readonly viewModes: Array<{ id: GxfViewMode; label: string }> = [
    { id: 'diagram', label: 'Diagram' },
    { id: 'timeline', label: 'Timeline' },
    { id: 'communities', label: 'Communities' },
    { id: 'table', label: 'Table' }
  ];

  files: GxfLoadedFile[] = [];
  currentIndex = -1;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;
  viewMode: GxfViewMode = 'diagram';
  query = '';
  selectedNodeId = '';
  selectedEdgeId = '';
  selectedCommunityId = '';
  timeValue = 0;

  private dragDepth = 0;
  private resizeObserver: ResizeObserver | null = null;

  get currentFile(): GxfLoadedFile | null {
    return this.currentIndex >= 0 ? this.files[this.currentIndex] ?? null : null;
  }

  get parsed() {
    return this.currentFile?.parsed ?? null;
  }

  get canExport(): boolean {
    return canExportGxf(this.currentFile);
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

  get selectedNode(): GxfNode | null {
    return this.parsed?.nodes.find((n) => n.id === this.selectedNodeId) ?? null;
  }

  get selectedEdge(): GxfEdge | null {
    return this.parsed?.edges.find((e) => e.id === this.selectedEdgeId) ?? null;
  }

  get selectedCommunity(): GxfCommunity | null {
    return this.parsed?.communities.find((c) => c.id === this.selectedCommunityId || c.name === this.selectedCommunityId) ?? null;
  }

  get activeTime(): number | null {
    return this.viewMode === 'timeline' ? this.timeValue : null;
  }

  get filteredNodes(): GxfNode[] {
    const comm = this.viewMode === 'communities' ? this.selectedCommunity?.name || '' : '';
    return this.parsed ? filterGxfNodes(this.parsed.nodes, this.query, comm, this.activeTime) : [];
  }

  get filteredEdges(): GxfEdge[] {
    return this.parsed ? filterGxfEdges(this.parsed.edges, this.query, this.activeTime) : [];
  }

  get communities() {
    return this.parsed?.communities ?? [];
  }

  get metadataRows() {
    return this.parsed ? buildGxfMetadataRows(this.parsed) : [];
  }

  get nodeMetadataRows() {
    return this.selectedNode ? buildGxfNodeMetadata(this.selectedNode) : [];
  }

  get edgeMetadataRows() {
    return this.selectedEdge ? buildGxfEdgeMetadata(this.selectedEdge) : [];
  }

  get communityMetadataRows() {
    return this.selectedCommunity ? buildGxfCommunityMetadata(this.selectedCommunity) : [];
  }

  get primarySuggestion() {
    const s = resolveGxfSuggestion({ hasFiles: this.files.length > 0, hasError: !!this.errorMessage });
    return !s || s.id === this.dismissedSuggestionId ? null : s;
  }

  nodeTint(node: GxfNode): string {
    return this.parsed ? gxfNodeColor(node, this.parsed.communities) : '#fdba74';
  }

  communityTint(index: number): string {
    return gxfCommunityColor(index);
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
      if (this.viewMode === 'table') this.shiftEdge(1);
      else if (this.viewMode === 'communities') this.shiftCommunity(1);
      else this.shiftNode(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (this.viewMode === 'table') this.shiftEdge(-1);
      else if (this.viewMode === 'communities') this.shiftCommunity(-1);
      else this.shiftNode(-1);
    } else if (event.key === 'ArrowLeft' && this.viewMode === 'timeline') {
      event.preventDefault();
      this.nudgeTime(-1);
    } else if (event.key === 'ArrowRight' && this.viewMode === 'timeline') {
      event.preventDefault();
      this.nudgeTime(1);
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      this.query = '';
      this.onFilterChange();
    }
  }

  trackByFileId(_i: number, file: GxfLoadedFile): string {
    return file.id;
  }

  trackByWarning(_i: number, warning: string): string {
    return warning;
  }

  trackByNode(_i: number, node: GxfNode): string {
    return node.id;
  }

  trackByEdge(_i: number, edge: GxfEdge): string {
    return edge.id;
  }

  trackByCommunity(_i: number, community: GxfCommunity): string {
    return community.id;
  }

  formatSize(bytes: number): string {
    return formatGxfFileSize(bytes);
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
    const { accepted, rejected } = filterValidGxfFiles(files);
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
          const bytes = await readGxfFileBytes(file);
          const record = createGxfFileRecord(file, bytes);
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
          this.errorMessage = `${file.name}: ${error instanceof Error ? error.message : 'Invalid GEXF network'}`;
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
    await this.handleFiles([createSampleGxfFile()]);
  }

  selectFile(index: number): void {
    if (index < 0 || index >= this.files.length || index === this.currentIndex) return;
    this.currentIndex = index;
    this.resetViewForCurrent();
    this.renderCanvas();
    this.cdr.markForCheck();
  }

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

  setTime(value: number | string): void {
    this.timeValue = Number(value);
    this.onFilterChange();
  }

  onFilterChange(): void {
    const node = this.filteredNodes[0];
    if (node && !this.filteredNodes.some((n) => n.id === this.selectedNodeId)) this.selectedNodeId = node.id;
    const edge = this.filteredEdges[0];
    if (edge && !this.filteredEdges.some((e) => e.id === this.selectedEdgeId)) this.selectedEdgeId = edge.id;
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
    this.selectedNodeId = '';
    this.selectedEdgeId = '';
    this.selectedCommunityId = '';
    this.errorMessage = '';
    this.query = '';
    this.timeValue = 0;
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

  setViewMode(mode: GxfViewMode): void {
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

  exportAs(format: GxfExportFormat, event: Event): void {
    event.stopPropagation();
    this.showExportMenu = false;
    const file = this.currentFile;
    if (!file?.parsed) return;
    try {
      if (format === 'original') downloadBinaryFile(file.bytes, file.name, 'application/octet-stream');
      else if (format === 'summary-json') downloadTextFile(exportGxfSummaryJson(file), `${file.name}.summary.json`, 'application/json');
      else if (format === 'nodes-csv') downloadTextFile(exportGxfNodesCsv(file.parsed), `${file.name}.nodes.csv`, 'text/csv');
      else if (format === 'edges-csv') downloadTextFile(exportGxfEdgesCsv(file.parsed), `${file.name}.edges.csv`, 'text/csv');
      else if (format === 'png') {
        const canvas = this.canvasHost?.nativeElement;
        if (!canvas || this.viewMode === 'table') {
          this.toast.info('Open Diagram, Timeline, or Communities to export a PNG snapshot');
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

  private nudgeTime(deltaIndex: number): void {
    const ticks = this.parsed?.ticks ?? [];
    if (!ticks.length) {
      this.setTime(this.timeValue + deltaIndex);
      return;
    }
    const idx = ticks.findIndex((t) => t >= this.timeValue);
    const cur = idx < 0 ? ticks.length - 1 : idx;
    const next = ticks[Math.min(ticks.length - 1, Math.max(0, cur + deltaIndex))];
    this.setTime(next);
  }

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
    this.timeValue = this.parsed?.timeMin ?? 0;
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
      renderGxfDiagram(canvas, this.parsed.nodes, this.parsed.edges, this.parsed.communities, this.selectedNodeId || null);
    } else if (this.viewMode === 'timeline') {
      renderGxfTimeline(canvas, this.filteredNodes, this.filteredEdges, this.parsed.communities, this.selectedNodeId || null, this.timeValue);
    } else if (this.viewMode === 'communities') {
      renderGxfCommunities(canvas, this.communities, this.selectedCommunityId || null);
    } else renderGxfEdges(canvas, this.filteredEdges, this.selectedEdgeId || null);
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
