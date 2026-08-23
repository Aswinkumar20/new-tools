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
  DT_ACCEPT_ATTR,
  DT_FORMATS_HINT,
  DT_FORMATS_LABEL,
  DT_RELATED_TOOLS,
  DT_SUPPORTED_EXTENSIONS
} from '../../constants/decision-tree-viewer.constants';
import type { DtEdge, DtExportFormat, DtLoadedFile, DtNode, DtViewMode } from '../../types/decision-tree-viewer.types';
import {
  buildDtBranchMetadata,
  buildDtEdgeMetadata,
  buildDtLeafMetadata,
  buildDtMetadataRows,
  canExportDt,
  canvasToPngDataUrl,
  createDtFileRecord,
  createSampleDtFile,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  dtNodeColor,
  exportDtBranchesCsv,
  exportDtLeavesCsv,
  exportDtSummaryJson,
  filterDtBranches,
  filterDtEdges,
  filterDtLeaves,
  filterValidDtFiles,
  formatDtFileSize,
  readDtFileBytes,
  renderDtBranches,
  renderDtDiagram,
  renderDtLeaves,
  resolveDtSuggestion
} from '../../utils/decision-tree-viewer.utils';

@Component({
  selector: 'lib-decision-tree-viewer',
  standalone: true,
  templateUrl: './decision-tree-viewer.html',
  styleUrls: ['./decision-tree-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation, TooltipDirective, StatValueTooltipHostDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DecisionTreeViewerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('canvasHost') canvasHost?: ElementRef<HTMLCanvasElement>;
  @ViewChild('mapWrap') mapWrap?: ElementRef<HTMLElement>;
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  readonly acceptAttr = DT_ACCEPT_ATTR;
  readonly relatedTools = DT_RELATED_TOOLS;
  readonly supportedExtensions = DT_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = DT_FORMATS_LABEL;
  readonly formatsHint = DT_FORMATS_HINT;
  readonly viewModes: Array<{ id: DtViewMode; label: string }> = [
    { id: 'diagram', label: 'Diagram' },
    { id: 'branches', label: 'Branches' },
    { id: 'leaves', label: 'Leaves' },
    { id: 'table', label: 'Table' }
  ];

  files: DtLoadedFile[] = [];
  currentIndex = -1;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;
  viewMode: DtViewMode = 'diagram';
  query = '';
  selectedBranchId = '';
  selectedLeafId = '';
  selectedEdgeId = '';

  private dragDepth = 0;
  private resizeObserver: ResizeObserver | null = null;

  get currentFile(): DtLoadedFile | null {
    return this.currentIndex >= 0 ? this.files[this.currentIndex] ?? null : null;
  }

  get parsed() {
    return this.currentFile?.parsed ?? null;
  }

  get canExport(): boolean {
    return canExportDt(this.currentFile);
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

  get selectedBranch(): DtNode | null {
    return this.parsed?.branches.find((n) => n.id === this.selectedBranchId) ?? null;
  }

  get selectedLeaf(): DtNode | null {
    return this.parsed?.leaves.find((n) => n.id === this.selectedLeafId) ?? null;
  }

  get selectedEdge(): DtEdge | null {
    return this.parsed?.edges.find((e) => e.id === this.selectedEdgeId) ?? null;
  }

  get filteredBranches(): DtNode[] {
    return this.parsed ? filterDtBranches(this.parsed.branches, this.query) : [];
  }

  get filteredLeaves(): DtNode[] {
    return this.parsed ? filterDtLeaves(this.parsed.leaves, this.query) : [];
  }

  get filteredEdges(): DtEdge[] {
    return this.parsed ? filterDtEdges(this.parsed.edges, this.query) : [];
  }

  get metadataRows() {
    return this.parsed ? buildDtMetadataRows(this.parsed) : [];
  }

  get branchMetadataRows() {
    return this.selectedBranch ? buildDtBranchMetadata(this.selectedBranch) : [];
  }

  get leafMetadataRows() {
    return this.selectedLeaf ? buildDtLeafMetadata(this.selectedLeaf) : [];
  }

  get edgeMetadataRows() {
    return this.selectedEdge ? buildDtEdgeMetadata(this.selectedEdge) : [];
  }

  get primarySuggestion() {
    const s = resolveDtSuggestion({ hasFiles: this.files.length > 0, hasError: !!this.errorMessage });
    return !s || s.id === this.dismissedSuggestionId ? null : s;
  }

  tint(kind: string, index: number): string {
    return dtNodeColor(kind, index);
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
      if (this.viewMode === 'leaves') this.shiftLeaf(1);
      else if (this.viewMode === 'table') this.shiftEdge(1);
      else this.shiftBranch(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (this.viewMode === 'leaves') this.shiftLeaf(-1);
      else if (this.viewMode === 'table') this.shiftEdge(-1);
      else this.shiftBranch(-1);
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      this.query = '';
      this.onFilterChange();
    }
  }

  trackByFileId(_i: number, file: DtLoadedFile): string {
    return file.id;
  }

  trackByWarning(_i: number, warning: string): string {
    return warning;
  }

  trackByNode(_i: number, node: DtNode): string {
    return node.id;
  }

  trackByEdge(_i: number, edge: DtEdge): string {
    return edge.id;
  }

  formatSize(bytes: number): string {
    return formatDtFileSize(bytes);
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
    const { accepted, rejected } = filterValidDtFiles(files);
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
          const bytes = await readDtFileBytes(file);
          const record = createDtFileRecord(file, bytes);
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
          this.errorMessage = `${file.name}: ${error instanceof Error ? error.message : 'Invalid decision tree'}`;
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
    await this.handleFiles([createSampleDtFile()]);
  }

  selectFile(index: number): void {
    if (index < 0 || index >= this.files.length || index === this.currentIndex) return;
    this.currentIndex = index;
    this.resetViewForCurrent();
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectBranch(id: string): void {
    this.selectedBranchId = id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectLeaf(id: string): void {
    this.selectedLeafId = id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectEdge(id: string): void {
    this.selectedEdgeId = id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  onFilterChange(): void {
    const branch = this.filteredBranches[0];
    if (branch && !this.filteredBranches.some((n) => n.id === this.selectedBranchId)) this.selectedBranchId = branch.id;
    const leaf = this.filteredLeaves[0];
    if (leaf && !this.filteredLeaves.some((n) => n.id === this.selectedLeafId)) this.selectedLeafId = leaf.id;
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
    this.selectedBranchId = '';
    this.selectedLeafId = '';
    this.selectedEdgeId = '';
    this.errorMessage = '';
    this.query = '';
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

  setViewMode(mode: DtViewMode): void {
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

  exportAs(format: DtExportFormat, event: Event): void {
    event.stopPropagation();
    this.showExportMenu = false;
    const file = this.currentFile;
    if (!file?.parsed) return;
    try {
      if (format === 'original') downloadBinaryFile(file.bytes, file.name, 'application/octet-stream');
      else if (format === 'summary-json') downloadTextFile(exportDtSummaryJson(file), `${file.name}.summary.json`, 'application/json');
      else if (format === 'leaves-csv') downloadTextFile(exportDtLeavesCsv(file.parsed), `${file.name}.leaves.csv`, 'text/csv');
      else if (format === 'branches-csv') downloadTextFile(exportDtBranchesCsv(file.parsed), `${file.name}.branches.csv`, 'text/csv');
      else if (format === 'png') {
        const canvas = this.canvasHost?.nativeElement;
        if (!canvas || this.viewMode === 'table') {
          this.toast.info('Open Diagram, Branches, or Leaves to export a PNG snapshot');
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

  private shiftBranch(delta: number): void {
    const list = this.filteredBranches;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((n) => n.id === this.selectedBranchId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectBranch(next.id);
  }

  private shiftLeaf(delta: number): void {
    const list = this.filteredLeaves;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((n) => n.id === this.selectedLeafId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectLeaf(next.id);
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
    this.selectedBranchId = this.parsed?.branches[0]?.id ?? '';
    this.selectedLeafId = this.parsed?.leaves[0]?.id ?? '';
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
      renderDtDiagram(canvas, this.parsed.nodes, this.parsed.edges, this.selectedBranchId || this.selectedLeafId || null);
    } else if (this.viewMode === 'branches') {
      renderDtBranches(canvas, this.filteredBranches, this.selectedBranchId || null);
    } else renderDtLeaves(canvas, this.filteredLeaves, this.selectedLeafId || null);
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
