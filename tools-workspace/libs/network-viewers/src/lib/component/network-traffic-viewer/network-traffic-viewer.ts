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
import { AssetService, Navigation, ToastService } from '@tools-workspace/features-home';
import {
  TRAFFIC_ACCEPT_ATTR,
  TRAFFIC_FORMATS_HINT,
  TRAFFIC_FORMATS_LABEL,
  TRAFFIC_RELATED_TOOLS,
  TRAFFIC_SUPPORTED_EXTENSIONS
} from '../../constants/network-traffic-viewer.constants';
import type {
  TrafficExportFormat,
  TrafficFlow,
  TrafficLoadedFile,
  TrafficViewMode
} from '../../types/network-traffic-viewer.types';
import {
  buildFlowMetadata,
  buildTrafficMetadataRows,
  canExportTraffic,
  canvasToPngDataUrl,
  createSampleTrafficFile,
  createTrafficFileRecord,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  exportTrafficFlowsCsv,
  exportTrafficSummaryJson,
  exportTrafficTalkersCsv,
  filterTrafficFlows,
  filterValidTrafficFiles,
  formatTrafficFileSize,
  protocolBarRows,
  readTrafficFileBytes,
  renderTrafficBars,
  resolveTrafficSuggestion,
  talkerBarRows
} from '../../utils/network-traffic-viewer.utils';

@Component({
  selector: 'lib-network-traffic-viewer',
  standalone: true,
  templateUrl: './network-traffic-viewer.html',
  styleUrls: ['./network-traffic-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NetworkTrafficViewerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('canvasHost') canvasHost?: ElementRef<HTMLCanvasElement>;
  @ViewChild('mapWrap') mapWrap?: ElementRef<HTMLElement>;
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  readonly acceptAttr = TRAFFIC_ACCEPT_ATTR;
  readonly relatedTools = TRAFFIC_RELATED_TOOLS;
  readonly supportedExtensions = TRAFFIC_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = TRAFFIC_FORMATS_LABEL;
  readonly formatsHint = TRAFFIC_FORMATS_HINT;
  readonly viewModes: Array<{ id: TrafficViewMode; label: string }> = [
    { id: 'flows', label: 'Flows' },
    { id: 'protocols', label: 'Protocols' },
    { id: 'talkers', label: 'Talkers' },
    { id: 'table', label: 'Table' }
  ];

  files: TrafficLoadedFile[] = [];
  currentIndex = -1;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;
  viewMode: TrafficViewMode = 'flows';
  query = '';
  selectedFlowId = '';

  private dragDepth = 0;
  private resizeObserver: ResizeObserver | null = null;

  get currentFile(): TrafficLoadedFile | null {
    return this.currentIndex >= 0 ? this.files[this.currentIndex] ?? null : null;
  }

  get parsed() {
    return this.currentFile?.parsed ?? null;
  }

  get canExport(): boolean {
    return canExportTraffic(this.currentFile);
  }

  get warnings(): string[] {
    return this.currentFile?.warnings ?? [];
  }

  get metadataRows() {
    return this.parsed ? buildTrafficMetadataRows(this.parsed) : [];
  }

  get filteredFlows(): TrafficFlow[] {
    return this.parsed ? filterTrafficFlows(this.parsed.flows, this.query) : [];
  }

  get selectedFlow(): TrafficFlow | null {
    return this.filteredFlows.find((f) => f.id === this.selectedFlowId) ?? this.filteredFlows[0] ?? null;
  }

  get flowMetadataRows() {
    return this.selectedFlow ? buildFlowMetadata(this.selectedFlow) : [];
  }

  get primarySuggestion() {
    const s = resolveTrafficSuggestion({ hasFiles: this.files.length > 0, hasError: !!this.errorMessage });
    return !s || s.id === this.dismissedSuggestionId ? null : s;
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
      this.shiftFlow(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.shiftFlow(-1);
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      this.query = '';
      this.onFilterChange();
    }
  }

  trackByFileId(_i: number, file: TrafficLoadedFile): string {
    return file.id;
  }

  trackByWarning(_i: number, warning: string): string {
    return warning;
  }

  trackByFlow(_i: number, flow: TrafficFlow): string {
    return flow.id;
  }

  formatSize(bytes: number): string {
    return formatTrafficFileSize(bytes);
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
    const { accepted, rejected } = filterValidTrafficFiles(files);
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
          const bytes = await readTrafficFileBytes(file);
          const record = createTrafficFileRecord(file, bytes);
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
          this.errorMessage = `${file.name}: ${error instanceof Error ? error.message : 'Invalid traffic data'}`;
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
    await this.handleFiles([createSampleTrafficFile()]);
  }

  selectFile(index: number): void {
    if (index < 0 || index >= this.files.length || index === this.currentIndex) return;
    this.currentIndex = index;
    this.resetViewForCurrent();
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectFlow(id: string): void {
    this.selectedFlowId = id;
    this.cdr.markForCheck();
  }

  onFilterChange(): void {
    const first = this.filteredFlows[0];
    if (first && !this.filteredFlows.some((f) => f.id === this.selectedFlowId)) this.selectedFlowId = first.id;
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
    this.selectedFlowId = '';
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

  setViewMode(mode: TrafficViewMode): void {
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

  exportAs(format: TrafficExportFormat, event: Event): void {
    event.stopPropagation();
    this.showExportMenu = false;
    const file = this.currentFile;
    if (!file?.parsed) return;
    try {
      if (format === 'original') downloadBinaryFile(file.bytes, file.name, 'application/octet-stream');
      else if (format === 'summary-json') downloadTextFile(exportTrafficSummaryJson(file), `${file.name}.summary.json`, 'application/json');
      else if (format === 'flows-csv') downloadTextFile(exportTrafficFlowsCsv(file.parsed), `${file.name}.flows.csv`, 'text/csv');
      else if (format === 'talkers-csv') downloadTextFile(exportTrafficTalkersCsv(file.parsed), `${file.name}.talkers.csv`, 'text/csv');
      else if (format === 'png') {
        const canvas = this.canvasHost?.nativeElement;
        if (!canvas || (this.viewMode !== 'protocols' && this.viewMode !== 'talkers')) {
          this.toast.info('Open Protocols or Talkers to export a PNG snapshot');
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

  private shiftFlow(delta: number): void {
    const flows = this.filteredFlows;
    if (!flows.length) return;
    const idx = Math.max(0, flows.findIndex((f) => f.id === this.selectedFlowId));
    const next = flows[Math.min(flows.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectFlow(next.id);
  }

  private resetViewForCurrent(): void {
    this.query = '';
    this.selectedFlowId = this.parsed?.flows[0]?.id ?? '';
  }

  private renderCanvas(): void {
    if (!this.isBrowser || (this.viewMode !== 'protocols' && this.viewMode !== 'talkers')) return;
    const canvas = this.canvasHost?.nativeElement;
    const parsed = this.parsed;
    if (!canvas || !parsed) return;
    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = Math.max(320, parent.clientWidth);
      canvas.height = Math.max(280, parent.clientHeight || 420);
    }
    if (this.viewMode === 'protocols') {
      renderTrafficBars(canvas, protocolBarRows(parsed.protocols));
      return;
    }
    renderTrafficBars(canvas, talkerBarRows(parsed.talkers));
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
