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
  ARCH_ACCEPT_ATTR,
  ARCH_FORMATS_HINT,
  ARCH_FORMATS_LABEL,
  ARCH_RELATED_TOOLS,
  ARCH_SUPPORTED_EXTENSIONS
} from '../../constants/architecture-diagram-viewer.constants';
import type {
  ArchBox,
  ArchConnector,
  ArchExportFormat,
  ArchLoadedFile,
  ArchViewMode
} from '../../types/architecture-diagram-viewer.types';
import {
  archBoxColor,
  buildArchBoxMetadata,
  buildArchConnectorMetadata,
  buildArchMetadataRows,
  canExportArch,
  canvasToPngDataUrl,
  createArchFileRecord,
  createSampleArchFile,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  exportArchBoxesCsv,
  exportArchConnectorsCsv,
  exportArchSummaryJson,
  filterArchBoxes,
  filterArchConnectors,
  filterValidArchFiles,
  formatArchFileSize,
  readArchFileBytes,
  renderArchBoxes,
  renderArchConnectors,
  renderArchDiagram,
  resolveArchSuggestion
} from '../../utils/architecture-diagram-viewer.utils';

@Component({
  selector: 'lib-architecture-diagram-viewer',
  standalone: true,
  templateUrl: './architecture-diagram-viewer.html',
  styleUrls: ['./architecture-diagram-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation, TooltipDirective, StatValueTooltipHostDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ArchitectureDiagramViewerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('canvasHost') canvasHost?: ElementRef<HTMLCanvasElement>;
  @ViewChild('mapWrap') mapWrap?: ElementRef<HTMLElement>;
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  readonly acceptAttr = ARCH_ACCEPT_ATTR;
  readonly relatedTools = ARCH_RELATED_TOOLS;
  readonly supportedExtensions = ARCH_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = ARCH_FORMATS_LABEL;
  readonly formatsHint = ARCH_FORMATS_HINT;
  readonly viewModes: Array<{ id: ArchViewMode; label: string }> = [
    { id: 'diagram', label: 'Diagram' },
    { id: 'boxes', label: 'Boxes' },
    { id: 'connectors', label: 'Connectors' },
    { id: 'table', label: 'Table' }
  ];

  files: ArchLoadedFile[] = [];
  currentIndex = -1;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;
  viewMode: ArchViewMode = 'diagram';
  query = '';
  selectedBoxId = '';
  selectedConnectorId = '';

  private dragDepth = 0;
  private resizeObserver: ResizeObserver | null = null;

  get currentFile(): ArchLoadedFile | null {
    return this.currentIndex >= 0 ? this.files[this.currentIndex] ?? null : null;
  }

  get parsed() {
    return this.currentFile?.parsed ?? null;
  }

  get canExport(): boolean {
    return canExportArch(this.currentFile);
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

  get selectedBox(): ArchBox | null {
    return this.parsed?.boxes.find((b) => b.id === this.selectedBoxId) ?? null;
  }

  get selectedConnector(): ArchConnector | null {
    return this.parsed?.connectors.find((c) => c.id === this.selectedConnectorId) ?? null;
  }

  get filteredBoxes(): ArchBox[] {
    return this.parsed ? filterArchBoxes(this.parsed.boxes, this.query) : [];
  }

  get filteredConnectors(): ArchConnector[] {
    return this.parsed ? filterArchConnectors(this.parsed.connectors, this.query) : [];
  }

  get metadataRows() {
    return this.parsed ? buildArchMetadataRows(this.parsed) : [];
  }

  get boxMetadataRows() {
    return this.selectedBox ? buildArchBoxMetadata(this.selectedBox) : [];
  }

  get connectorMetadataRows() {
    return this.selectedConnector ? buildArchConnectorMetadata(this.selectedConnector) : [];
  }

  get primarySuggestion() {
    const s = resolveArchSuggestion({ hasFiles: this.files.length > 0, hasError: !!this.errorMessage });
    return !s || s.id === this.dismissedSuggestionId ? null : s;
  }

  tint(kind: string, index: number): string {
    return archBoxColor(kind, index);
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
      if (this.viewMode === 'table' || this.viewMode === 'connectors') this.shiftConnector(1);
      else this.shiftBox(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (this.viewMode === 'table' || this.viewMode === 'connectors') this.shiftConnector(-1);
      else this.shiftBox(-1);
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      this.query = '';
      this.onFilterChange();
    }
  }

  trackByFileId(_i: number, file: ArchLoadedFile): string {
    return file.id;
  }

  trackByWarning(_i: number, warning: string): string {
    return warning;
  }

  trackByBox(_i: number, box: ArchBox): string {
    return box.id;
  }

  trackByConnector(_i: number, connector: ArchConnector): string {
    return connector.id;
  }

  formatSize(bytes: number): string {
    return formatArchFileSize(bytes);
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
    const { accepted, rejected } = filterValidArchFiles(files);
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
          const bytes = await readArchFileBytes(file);
          const record = createArchFileRecord(file, bytes);
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
          this.errorMessage = `${file.name}: ${error instanceof Error ? error.message : 'Invalid architecture diagram'}`;
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
    await this.handleFiles([createSampleArchFile()]);
  }

  selectFile(index: number): void {
    if (index < 0 || index >= this.files.length || index === this.currentIndex) return;
    this.currentIndex = index;
    this.resetViewForCurrent();
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectBox(id: string): void {
    this.selectedBoxId = id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectConnector(id: string): void {
    this.selectedConnectorId = id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  onFilterChange(): void {
    const box = this.filteredBoxes[0];
    if (box && !this.filteredBoxes.some((b) => b.id === this.selectedBoxId)) this.selectedBoxId = box.id;
    const conn = this.filteredConnectors[0];
    if (conn && !this.filteredConnectors.some((c) => c.id === this.selectedConnectorId)) this.selectedConnectorId = conn.id;
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
    this.selectedBoxId = '';
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

  setViewMode(mode: ArchViewMode): void {
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

  exportAs(format: ArchExportFormat, event: Event): void {
    event.stopPropagation();
    this.showExportMenu = false;
    const file = this.currentFile;
    if (!file?.parsed) return;
    try {
      if (format === 'original') downloadBinaryFile(file.bytes, file.name, 'application/octet-stream');
      else if (format === 'summary-json') downloadTextFile(exportArchSummaryJson(file), `${file.name}.summary.json`, 'application/json');
      else if (format === 'boxes-csv') downloadTextFile(exportArchBoxesCsv(file.parsed), `${file.name}.boxes.csv`, 'text/csv');
      else if (format === 'connectors-csv') downloadTextFile(exportArchConnectorsCsv(file.parsed), `${file.name}.connectors.csv`, 'text/csv');
      else if (format === 'png') {
        const canvas = this.canvasHost?.nativeElement;
        if (!canvas || this.viewMode === 'table') {
          this.toast.info('Open Diagram, Boxes, or Connectors to export a PNG snapshot');
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

  private shiftBox(delta: number): void {
    const list = this.filteredBoxes;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((b) => b.id === this.selectedBoxId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectBox(next.id);
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
    this.selectedBoxId = this.parsed?.boxes[0]?.id ?? '';
    this.selectedConnectorId = this.parsed?.connectors[0]?.id ?? '';
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
      renderArchDiagram(canvas, this.parsed.boxes, this.parsed.connectors, this.selectedBoxId || null);
    } else if (this.viewMode === 'boxes') {
      renderArchBoxes(canvas, this.filteredBoxes, this.selectedBoxId || null);
    } else renderArchConnectors(canvas, this.filteredConnectors, this.selectedConnectorId || null);
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
