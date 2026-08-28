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
  FM_ACCEPT_ATTR,
  FM_FORMATS_HINT,
  FM_FORMATS_LABEL,
  FM_RELATED_TOOLS,
  FM_SUPPORTED_EXTENSIONS
} from '../../constants/freemind-viewer.constants';
import type { FmExportFormat, FmLoadedFile, FmNode, FmViewMode } from '../../types/freemind-viewer.types';
import {
  buildFmMetadataRows,
  buildFmNodeMetadata,
  canExportFm,
  canvasToPngDataUrl,
  createFmFileRecord,
  createSampleFmFile,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  expandFmMatches,
  exportFmNodesCsv,
  exportFmNotesTxt,
  exportFmSummaryJson,
  filterFmNodes,
  filterValidFmFiles,
  fmDepthColor,
  formatFmFileSize,
  readFmFileBytes,
  renderFmDiagram,
  resolveFmSuggestion,
  setFmCollapsedAll,
  toggleFmCollapsed,
  visibleFmNodes
} from '../../utils/freemind-viewer.utils';

@Component({
  selector: 'lib-freemind-viewer',
  standalone: true,
  templateUrl: './freemind-viewer.html',
  styleUrls: ['./freemind-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation, TooltipDirective, StatValueTooltipHostDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FreemindViewerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('canvasHost') canvasHost?: ElementRef<HTMLCanvasElement>;
  @ViewChild('mapWrap') mapWrap?: ElementRef<HTMLElement>;
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  readonly acceptAttr = FM_ACCEPT_ATTR;
  readonly relatedTools = FM_RELATED_TOOLS;
  readonly supportedExtensions = FM_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = FM_FORMATS_LABEL;
  readonly formatsHint = FM_FORMATS_HINT;
  readonly viewModes: Array<{ id: FmViewMode; label: string }> = [
    { id: 'diagram', label: 'Diagram' },
    { id: 'tree', label: 'Tree' },
    { id: 'notes', label: 'Notes' },
    { id: 'table', label: 'Table' }
  ];

  files: FmLoadedFile[] = [];
  currentIndex = -1;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;
  viewMode: FmViewMode = 'diagram';
  query = '';
  selectedNodeId = '';

  private dragDepth = 0;
  private resizeObserver: ResizeObserver | null = null;

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  get currentFile(): FmLoadedFile | null {
    return this.currentIndex >= 0 ? this.files[this.currentIndex] ?? null : null;
  }

  get parsed() {
    return this.currentFile?.parsed ?? null;
  }

  get canExport(): boolean {
    return canExportFm(this.currentFile);
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

  get selectedNode(): FmNode | null {
    return this.parsed?.nodes.find((n) => n.id === this.selectedNodeId) ?? null;
  }

  get visibleNodes(): FmNode[] {
    return this.parsed ? visibleFmNodes(this.parsed.nodes, this.query, this.viewMode === 'notes') : [];
  }

  get tableNodes(): FmNode[] {
    return this.parsed ? filterFmNodes(this.parsed.nodes, this.query) : [];
  }

  get noteNodes(): FmNode[] {
    return this.parsed ? filterFmNodes(this.parsed.nodes, this.query, true) : [];
  }

  get metadataRows() {
    return this.parsed ? buildFmMetadataRows(this.parsed) : [];
  }

  get nodeMetadataRows() {
    return this.selectedNode ? buildFmNodeMetadata(this.selectedNode) : [];
  }

  get primarySuggestion() {
    const s = resolveFmSuggestion({ hasFiles: this.files.length > 0, hasError: !!this.errorMessage });
    return !s || s.id === this.dismissedSuggestionId ? null : s;
  }

  tint(node: FmNode): string {
    return fmDepthColor(node.depth);
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
      this.shiftNode(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.shiftNode(-1);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (this.selectedNodeId) this.toggleCollapse(this.selectedNodeId, event);
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      this.query = '';
      this.onFilterChange();
    }
  }

  // ---------------------------------------------------------------------------
  // TrackBy / formatters
  // ---------------------------------------------------------------------------

  trackByFileId(_i: number, file: FmLoadedFile): string {
    return file.id;
  }

  trackByWarning(_i: number, warning: string): string {
    return warning;
  }

  trackByNode(_i: number, node: FmNode): string {
    return node.id;
  }

  formatSize(bytes: number): string {
    return formatFmFileSize(bytes);
  }

  indentRem(depth: number): number {
    return Math.max(0, depth) * 0.85;
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
    const { accepted, rejected } = filterValidFmFiles(files);
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
          const bytes = await readFmFileBytes(file);
          const record = createFmFileRecord(file, bytes);
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
          this.errorMessage = `${file.name}: ${error instanceof Error ? error.message : 'Invalid FreeMind map'}`;
          this.toast.error(this.errorMessage);
        }
      }
      this.renderCanvas();
      if (this.currentFile) {
        this.toast.success(`Loaded ${this.currentFile.name}`);
        if (this.currentFile.softFail) {
          this.toast.warning('Parsed with little or no topics — metadata may still be available');
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
    await this.handleFiles([createSampleFmFile()]);
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
  // Selection / filter / tree controls
  // ---------------------------------------------------------------------------

  selectNode(id: string): void {
    this.selectedNodeId = id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  toggleCollapse(id: string, event?: Event): void {
    event?.stopPropagation();
    const file = this.currentFile;
    if (!file?.parsed) return;
    file.parsed = toggleFmCollapsed(file.parsed, id);
    this.files = [...this.files];
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  expandAll(): void {
    const file = this.currentFile;
    if (!file?.parsed) return;
    file.parsed = setFmCollapsedAll(file.parsed, false);
    this.files = [...this.files];
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  collapseAll(): void {
    const file = this.currentFile;
    if (!file?.parsed) return;
    file.parsed = setFmCollapsedAll(file.parsed, true);
    this.files = [...this.files];
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  onFilterChange(): void {
    const file = this.currentFile;
    if (file?.parsed && this.query.trim()) {
      file.parsed = expandFmMatches(file.parsed, this.query);
      this.files = [...this.files];
    }
    const list = this.viewMode === 'table' ? this.tableNodes : this.viewMode === 'notes' ? this.noteNodes : this.visibleNodes;
    if (this.selectedNodeId && !list.some((n) => n.id === this.selectedNodeId)) {
      this.selectedNodeId = list[0]?.id ?? '';
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

  setViewMode(mode: FmViewMode): void {
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

  exportAs(format: FmExportFormat, event: Event): void {
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
      else if (format === 'summary-json') downloadTextFile(exportFmSummaryJson(file), `${file.name}.summary.json`, 'application/json');
      else if (format === 'nodes-csv') downloadTextFile(exportFmNodesCsv(file.parsed), `${file.name}.nodes.csv`, 'text/csv');
      else if (format === 'notes-txt') downloadTextFile(exportFmNotesTxt(file.parsed), `${file.name}.notes.txt`, 'text/plain');
      else if (format === 'png') {
        const canvas = this.canvasHost?.nativeElement;
        if (!canvas || this.viewMode !== 'diagram') {
          this.toast.info('Open Diagram to export a PNG snapshot');
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
    const list = this.viewMode === 'table' ? this.tableNodes : this.viewMode === 'notes' ? this.noteNodes : this.visibleNodes;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((n) => n.id === this.selectedNodeId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectNode(next.id);
  }

  private resetViewForCurrent(): void {
    this.query = '';
    this.selectedNodeId = this.parsed?.rootId || this.parsed?.nodes[0]?.id || '';
  }

  private renderCanvas(): void {
    if (!this.isBrowser || this.viewMode !== 'diagram') return;
    const canvas = this.canvasHost?.nativeElement;
    if (!canvas || !this.parsed) return;
    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = Math.max(320, parent.clientWidth);
      canvas.height = Math.max(220, Math.min(320, parent.clientHeight || 280));
    }
    renderFmDiagram(canvas, this.visibleNodes, this.selectedNodeId || null);
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
