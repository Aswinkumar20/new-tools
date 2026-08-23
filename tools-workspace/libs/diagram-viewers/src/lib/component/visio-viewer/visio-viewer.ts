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
  VSD_ACCEPT_ATTR,
  VSD_FORMATS_HINT,
  VSD_FORMATS_LABEL,
  VSD_RELATED_TOOLS,
  VSD_SUPPORTED_EXTENSIONS
} from '../../constants/visio-viewer.constants';
import type {
  VsdConnector,
  VsdExportFormat,
  VsdLoadedFile,
  VsdPage,
  VsdShape,
  VsdViewMode
} from '../../types/visio-viewer.types';
import {
  buildVsdConnectorMetadata,
  buildVsdMetadataRows,
  buildVsdPageMetadata,
  buildVsdShapeMetadata,
  canExportVsd,
  canvasToPngDataUrl,
  createVsdFileRecord,
  createSampleVsdFile,
  vsdShapeColor,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  exportVsdConnectorsCsv,
  exportVsdShapesCsv,
  exportVsdSummaryJson,
  filterVsdConnectors,
  filterVsdPages,
  filterVsdShapes,
  filterValidVsdFiles,
  formatVsdFileSize,
  readVsdFileBytes,
  renderVsdConnectors,
  renderVsdDiagram,
  renderVsdPages,
  renderVsdShapes,
  resolveVsdSuggestion
} from '../../utils/visio-viewer.utils';

@Component({
  selector: 'lib-visio-viewer',
  standalone: true,
  templateUrl: './visio-viewer.html',
  styleUrls: ['./visio-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation, TooltipDirective, StatValueTooltipHostDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VisioViewerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('canvasHost') canvasHost?: ElementRef<HTMLCanvasElement>;
  @ViewChild('mapWrap') mapWrap?: ElementRef<HTMLElement>;
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  readonly acceptAttr = VSD_ACCEPT_ATTR;
  readonly relatedTools = VSD_RELATED_TOOLS;
  readonly supportedExtensions = VSD_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = VSD_FORMATS_LABEL;
  readonly formatsHint = VSD_FORMATS_HINT;
  readonly viewModes: Array<{ id: VsdViewMode; label: string }> = [
    { id: 'diagram', label: 'Diagram' },
    { id: 'pages', label: 'Pages' },
    { id: 'shapes', label: 'Shapes' },
    { id: 'table', label: 'Table' }
  ];

  files: VsdLoadedFile[] = [];
  currentIndex = -1;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;
  viewMode: VsdViewMode = 'diagram';
  query = '';
  selectedPageId = '';
  selectedShapeId = '';
  selectedConnectorId = '';
  private dragDepth = 0;
  private resizeObserver: ResizeObserver | null = null;

  get currentFile(): VsdLoadedFile | null {
    return this.currentIndex >= 0 ? this.files[this.currentIndex] ?? null : null;
  }

  get parsed() {
    return this.currentFile?.parsed ?? null;
  }

  get canExport(): boolean {
    return canExportVsd(this.currentFile);
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

  get selectedPage(): VsdPage | null {
    return this.parsed?.pages.find((p) => p.id === this.selectedPageId) ?? null;
  }

  get selectedShape(): VsdShape | null {
    return this.parsed?.shapes.find((s) => s.id === this.selectedShapeId) ?? null;
  }

  get selectedConnector(): VsdConnector | null {
    return this.parsed?.connectors.find((c) => c.id === this.selectedConnectorId) ?? null;
  }

  get filteredPages(): VsdPage[] {
    return this.parsed ? filterVsdPages(this.parsed.pages, this.query) : [];
  }

  get pageFilterId(): string {
    return this.viewMode === 'pages' ? '' : this.selectedPageId;
  }

  get filteredShapes(): VsdShape[] {
    return this.parsed ? filterVsdShapes(this.parsed.shapes, this.query, this.pageFilterId) : [];
  }

  get filteredConnectors(): VsdConnector[] {
    return this.parsed ? filterVsdConnectors(this.parsed.connectors, this.query, this.pageFilterId) : [];
  }

  get diagramShapes(): VsdShape[] {
    return this.parsed ? filterVsdShapes(this.parsed.shapes, '', this.selectedPageId) : [];
  }

  get diagramConnectors(): VsdConnector[] {
    return this.parsed ? filterVsdConnectors(this.parsed.connectors, '', this.selectedPageId) : [];
  }

  get metadataRows() {
    return this.parsed ? buildVsdMetadataRows(this.parsed) : [];
  }

  get pageMetadataRows() {
    return this.selectedPage ? buildVsdPageMetadata(this.selectedPage) : [];
  }

  get shapeMetadataRows() {
    return this.selectedShape ? buildVsdShapeMetadata(this.selectedShape) : [];
  }

  get connectorMetadataRows() {
    return this.selectedConnector ? buildVsdConnectorMetadata(this.selectedConnector) : [];
  }

  get primarySuggestion() {
    const s = resolveVsdSuggestion({ hasFiles: this.files.length > 0, hasError: !!this.errorMessage });
    return !s || s.id === this.dismissedSuggestionId ? null : s;
  }

  tint(_kind: string, index: number): string {
    return vsdShapeColor(index);
  }

  roundSize(value: number): number {
    return Math.round(value);
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
      if (this.viewMode === 'pages') this.shiftPage(1);
      else if (this.viewMode === 'table') this.shiftConnector(1);
      else this.shiftShape(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (this.viewMode === 'pages') this.shiftPage(-1);
      else if (this.viewMode === 'table') this.shiftConnector(-1);
      else this.shiftShape(-1);
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      this.query = '';
      this.onFilterChange();
    }
  }

  trackByFileId(_i: number, file: VsdLoadedFile): string {
    return file.id;
  }

  trackByWarning(_i: number, warning: string): string {
    return warning;
  }

  trackByPage(_i: number, page: VsdPage): string {
    return page.id;
  }

  trackByShape(_i: number, shape: VsdShape): string {
    return shape.id;
  }

  trackByConnector(_i: number, connector: VsdConnector): string {
    return connector.id;
  }

  formatSize(bytes: number): string {
    return formatVsdFileSize(bytes);
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
    const { accepted, rejected } = filterValidVsdFiles(files);
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
          const bytes = await readVsdFileBytes(file);
          const record = createVsdFileRecord(file, bytes);
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
          this.errorMessage = `${file.name}: ${error instanceof Error ? error.message : 'Invalid Visio diagram'}`;
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
    await this.handleFiles([createSampleVsdFile()]);
  }

  selectFile(index: number): void {
    if (index < 0 || index >= this.files.length || index === this.currentIndex) return;
    this.currentIndex = index;
    this.resetViewForCurrent();
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectPage(id: string): void {
    this.selectedPageId = id;
    const shapes = this.parsed ? filterVsdShapes(this.parsed.shapes, this.query, id) : [];
    const connectors = this.parsed ? filterVsdConnectors(this.parsed.connectors, this.query, id) : [];
    if (!shapes.some((s) => s.id === this.selectedShapeId)) this.selectedShapeId = shapes[0]?.id ?? '';
    if (!connectors.some((c) => c.id === this.selectedConnectorId)) this.selectedConnectorId = connectors[0]?.id ?? '';
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectShape(id: string): void {
    this.selectedShapeId = id;
    const shape = this.parsed?.shapes.find((s) => s.id === id);
    if (shape) this.selectedPageId = shape.pageId;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectConnector(id: string): void {
    this.selectedConnectorId = id;
    const connector = this.parsed?.connectors.find((c) => c.id === id);
    if (connector) this.selectedPageId = connector.pageId;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  onPageChange(): void {
    this.selectPage(this.selectedPageId);
  }

  onFilterChange(): void {
    const page = this.filteredPages[0];
    if (page && !this.filteredPages.some((p) => p.id === this.selectedPageId)) this.selectedPageId = page.id;
    const shape = this.filteredShapes[0];
    if (shape && !this.filteredShapes.some((s) => s.id === this.selectedShapeId)) this.selectedShapeId = shape.id;
    const connector = this.filteredConnectors[0];
    if (connector && !this.filteredConnectors.some((c) => c.id === this.selectedConnectorId)) {
      this.selectedConnectorId = connector.id;
    }
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
    this.selectedPageId = '';
    this.selectedShapeId = '';
    this.selectedConnectorId = '';
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

  setViewMode(mode: VsdViewMode): void {
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

  exportAs(format: VsdExportFormat, event: Event): void {
    event.stopPropagation();
    this.showExportMenu = false;
    const file = this.currentFile;
    if (!file?.parsed) return;
    try {
      if (format === 'original') downloadBinaryFile(file.bytes, file.name, 'application/octet-stream');
      else if (format === 'summary-json') downloadTextFile(exportVsdSummaryJson(file), `${file.name}.summary.json`, 'application/json');
      else if (format === 'shapes-csv') downloadTextFile(exportVsdShapesCsv(file.parsed), `${file.name}.shapes.csv`, 'text/csv');
      else if (format === 'connectors-csv') downloadTextFile(exportVsdConnectorsCsv(file.parsed), `${file.name}.connectors.csv`, 'text/csv');
      else if (format === 'png') {
        const canvas = this.canvasHost?.nativeElement;
        if (!canvas || this.viewMode === 'table') {
          this.toast.info('Open Diagram, Pages, or Shapes to export a PNG snapshot');
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

  private shiftPage(delta: number): void {
    const list = this.filteredPages;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((p) => p.id === this.selectedPageId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectPage(next.id);
  }

  private shiftShape(delta: number): void {
    const list = this.filteredShapes;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((s) => s.id === this.selectedShapeId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectShape(next.id);
  }

  private shiftConnector(delta: number): void {
    const list = this.filteredConnectors;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((c) => c.id === this.selectedConnectorId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectConnector(next.id);
  }

  private resetViewForCurrent(): void {
    this.query = '';
    this.selectedPageId = this.parsed?.pages[0]?.id ?? '';
    const shapes = this.parsed ? filterVsdShapes(this.parsed.shapes, '', this.selectedPageId) : [];
    const connectors = this.parsed ? filterVsdConnectors(this.parsed.connectors, '', this.selectedPageId) : [];
    this.selectedShapeId = shapes[0]?.id ?? '';
    this.selectedConnectorId = connectors[0]?.id ?? '';
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
      renderVsdDiagram(canvas, this.diagramShapes, this.diagramConnectors, this.selectedShapeId || null);
    } else if (this.viewMode === 'pages') {
      renderVsdPages(canvas, this.filteredPages, this.selectedPageId || null);
    } else if (this.viewMode === 'shapes') {
      renderVsdShapes(canvas, this.filteredShapes, this.selectedShapeId || null);
    } else renderVsdConnectors(canvas, this.filteredConnectors, this.selectedConnectorId || null);
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
