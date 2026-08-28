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
  CMAP_ACCEPT_ATTR,
  CMAP_FORMATS_HINT,
  CMAP_FORMATS_LABEL,
  CMAP_RELATED_TOOLS,
  CMAP_SUPPORTED_EXTENSIONS
} from '../../constants/concept-map-viewer.constants';
import type {
  CmapExportFormat,
  CmapLink,
  CmapLoadedFile,
  CmapNode,
  CmapViewMode
} from '../../types/concept-map-viewer.types';
import {
  buildCmapLinkMetadata,
  buildCmapMetadataRows,
  buildCmapNodeMetadata,
  canExportCmap,
  canvasToPngDataUrl,
  cmapNodeColor,
  createCmapFileRecord,
  createSampleCmapFile,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  exportCmapLinksCsv,
  exportCmapNodesCsv,
  exportCmapSummaryJson,
  filterCmapLinks,
  filterCmapNodes,
  filterValidCmapFiles,
  formatCmapFileSize,
  readCmapFileBytes,
  renderCmapDiagram,
  renderCmapLinks,
  renderCmapNodes,
  resolveCmapSuggestion
} from '../../utils/concept-map-viewer.utils';

@Component({
  selector: 'lib-concept-map-viewer',
  standalone: true,
  templateUrl: './concept-map-viewer.html',
  styleUrls: ['./concept-map-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation, TooltipDirective, StatValueTooltipHostDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ConceptMapViewerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('canvasHost') canvasHost?: ElementRef<HTMLCanvasElement>;
  @ViewChild('mapWrap') mapWrap?: ElementRef<HTMLElement>;
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  readonly acceptAttr = CMAP_ACCEPT_ATTR;
  readonly relatedTools = CMAP_RELATED_TOOLS;
  readonly supportedExtensions = CMAP_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = CMAP_FORMATS_LABEL;
  readonly formatsHint = CMAP_FORMATS_HINT;
  readonly viewModes: Array<{ id: CmapViewMode; label: string }> = [
    { id: 'diagram', label: 'Diagram' },
    { id: 'nodes', label: 'Nodes' },
    { id: 'links', label: 'Links' },
    { id: 'table', label: 'Table' }
  ];

  files: CmapLoadedFile[] = [];
  currentIndex = -1;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;
  viewMode: CmapViewMode = 'diagram';
  query = '';
  selectedNodeId = '';
  selectedLinkId = '';

  private dragDepth = 0;
  private resizeObserver: ResizeObserver | null = null;

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  get currentFile(): CmapLoadedFile | null {
    return this.currentIndex >= 0 ? this.files[this.currentIndex] ?? null : null;
  }

  get parsed() {
    return this.currentFile?.parsed ?? null;
  }

  get canExport(): boolean {
    return canExportCmap(this.currentFile);
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

  get selectedNode(): CmapNode | null {
    return this.parsed?.nodes.find((n) => n.id === this.selectedNodeId) ?? null;
  }

  get selectedLink(): CmapLink | null {
    return this.parsed?.links.find((l) => l.id === this.selectedLinkId) ?? null;
  }

  get filteredNodes(): CmapNode[] {
    return this.parsed ? filterCmapNodes(this.parsed.nodes, this.query) : [];
  }

  get filteredLinks(): CmapLink[] {
    return this.parsed ? filterCmapLinks(this.parsed.links, this.query) : [];
  }

  get metadataRows() {
    return this.parsed ? buildCmapMetadataRows(this.parsed) : [];
  }

  get nodeMetadataRows() {
    return this.selectedNode ? buildCmapNodeMetadata(this.selectedNode) : [];
  }

  get linkMetadataRows() {
    return this.selectedLink ? buildCmapLinkMetadata(this.selectedLink) : [];
  }

  get primarySuggestion() {
    const s = resolveCmapSuggestion({ hasFiles: this.files.length > 0, hasError: !!this.errorMessage });
    return !s || s.id === this.dismissedSuggestionId ? null : s;
  }

  // ---------------------------------------------------------------------------
  // Display helpers
  // ---------------------------------------------------------------------------

  tint(_kind: string, index: number): string {
    return cmapNodeColor(index);
  }

  formatSize(bytes: number): string {
    return formatCmapFileSize(bytes);
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
      if (this.viewMode === 'table' || this.viewMode === 'links') this.shiftLink(1);
      else this.shiftNode(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (this.viewMode === 'table' || this.viewMode === 'links') this.shiftLink(-1);
      else this.shiftNode(-1);
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      this.query = '';
      this.onFilterChange();
    }
  }

  // ---------------------------------------------------------------------------
  // TrackBy
  // ---------------------------------------------------------------------------

  trackByFileId(_i: number, file: CmapLoadedFile): string {
    return file.id;
  }

  trackByWarning(_i: number, warning: string): string {
    return warning;
  }

  trackByNode(_i: number, node: CmapNode): string {
    return node.id;
  }

  trackByLink(_i: number, link: CmapLink): string {
    return link.id;
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
    const { accepted, rejected } = filterValidCmapFiles(files);
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
          const bytes = await readCmapFileBytes(file);
          const record = createCmapFileRecord(file, bytes);
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
          this.errorMessage = `${file.name}: ${error instanceof Error ? error.message : 'Invalid concept map'}`;
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
    await this.handleFiles([createSampleCmapFile()]);
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
    this.selectedLinkId = '';
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

  selectNode(id: string): void {
    this.selectedNodeId = id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectLink(id: string): void {
    this.selectedLinkId = id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  onFilterChange(): void {
    if (this.selectedNodeId && !this.filteredNodes.some((n) => n.id === this.selectedNodeId)) {
      this.selectedNodeId = this.filteredNodes[0]?.id ?? '';
    }
    if (this.selectedLinkId && !this.filteredLinks.some((l) => l.id === this.selectedLinkId)) {
      this.selectedLinkId = this.filteredLinks[0]?.id ?? '';
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

  setViewMode(mode: CmapViewMode): void {
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

  exportAs(format: CmapExportFormat, event: Event): void {
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
      else if (format === 'summary-json') downloadTextFile(exportCmapSummaryJson(file), `${file.name}.summary.json`, 'application/json');
      else if (format === 'nodes-csv') downloadTextFile(exportCmapNodesCsv(file.parsed), `${file.name}.nodes.csv`, 'text/csv');
      else if (format === 'links-csv') downloadTextFile(exportCmapLinksCsv(file.parsed), `${file.name}.links.csv`, 'text/csv');
      else if (format === 'png') {
        const canvas = this.canvasHost?.nativeElement;
        if (!canvas || this.viewMode === 'table') {
          this.toast.info('Open Diagram, Nodes, or Links to export a PNG snapshot');
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

  private shiftNode(delta: number): void {
    const list = this.filteredNodes;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((n) => n.id === this.selectedNodeId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectNode(next.id);
  }

  private shiftLink(delta: number): void {
    const list = this.filteredLinks;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((l) => l.id === this.selectedLinkId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectLink(next.id);
  }

  private resetViewForCurrent(): void {
    this.query = '';
    this.selectedNodeId = this.parsed?.nodes[0]?.id ?? '';
    this.selectedLinkId = this.parsed?.links[0]?.id ?? '';
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
      renderCmapDiagram(canvas, this.parsed.nodes, this.parsed.links, this.selectedNodeId || null);
    } else if (this.viewMode === 'nodes') {
      renderCmapNodes(canvas, this.filteredNodes, this.selectedNodeId || null);
    } else renderCmapLinks(canvas, this.filteredLinks, this.selectedLinkId || null);
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
