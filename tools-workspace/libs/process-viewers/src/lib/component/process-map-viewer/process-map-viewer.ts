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
  PROCESS_MAP_ACCEPT_ATTR,
  PROCESS_MAP_FORMATS_HINT,
  PROCESS_MAP_FORMATS_LABEL,
  PROCESS_MAP_RELATED_TOOLS,
  PROCESS_MAP_SUPPORTED_EXTENSIONS
} from '../../constants/process-map-viewer.constants';
import type {
  ProcessMapActivity,
  ProcessMapExportFormat,
  ProcessMapFlow,
  ProcessMapLoadedFile,
  ProcessMapVariant,
  ProcessMapViewMode
} from '../../types/process-map-viewer.types';
import {
  buildProcessMapActivityMetadata,
  buildProcessMapFlowMetadata,
  buildProcessMapMetadataRows,
  buildProcessMapVariantMetadata,
  canExportProcessMap,
  canvasToPngDataUrl,
  createProcessMapFileRecord,
  createSampleProcessMapFile,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  exportProcessMapFlowsCsv,
  exportProcessMapSummaryJson,
  exportProcessMapVariantsCsv,
  filterProcessMapActivities,
  filterProcessMapFlows,
  filterProcessMapVariants,
  filterValidProcessMapFiles,
  formatProcessMapDuration,
  formatProcessMapFileSize,
  processMapFrequencyColor,
  processMapVariantColor,
  readProcessMapFileBytes,
  renderProcessMapFlows,
  renderProcessMapFrequencies,
  renderProcessMapVariants,
  resolveProcessMapSuggestion
} from '../../utils/process-map-viewer.utils';

@Component({
  selector: 'lib-process-map-viewer',
  standalone: true,
  templateUrl: './process-map-viewer.html',
  styleUrls: ['./process-map-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProcessMapViewerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('canvasHost') canvasHost?: ElementRef<HTMLCanvasElement>;
  @ViewChild('mapWrap') mapWrap?: ElementRef<HTMLElement>;
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  readonly acceptAttr = PROCESS_MAP_ACCEPT_ATTR;
  readonly relatedTools = PROCESS_MAP_RELATED_TOOLS;
  readonly supportedExtensions = PROCESS_MAP_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = PROCESS_MAP_FORMATS_LABEL;
  readonly formatsHint = PROCESS_MAP_FORMATS_HINT;
  readonly viewModes: Array<{ id: ProcessMapViewMode; label: string }> = [
    { id: 'variants', label: 'Variants' },
    { id: 'frequencies', label: 'Frequencies' },
    { id: 'map', label: 'Map' },
    { id: 'table', label: 'Table' }
  ];

  files: ProcessMapLoadedFile[] = [];
  currentIndex = -1;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;
  viewMode: ProcessMapViewMode = 'variants';
  query = '';
  selectedVariantId = '';
  selectedActivityId = '';
  selectedFlowId = '';

  private dragDepth = 0;
  private resizeObserver: ResizeObserver | null = null;

  get currentFile(): ProcessMapLoadedFile | null {
    return this.currentIndex >= 0 ? this.files[this.currentIndex] ?? null : null;
  }

  get parsed() {
    return this.currentFile?.parsed ?? null;
  }

  get canExport(): boolean {
    return canExportProcessMap(this.currentFile);
  }

  get warnings(): string[] {
    return this.currentFile?.warnings ?? [];
  }

  get metadataRows() {
    return this.parsed ? buildProcessMapMetadataRows(this.parsed) : [];
  }

  get filteredVariants(): ProcessMapVariant[] {
    return this.parsed ? filterProcessMapVariants(this.parsed.variants, this.query) : [];
  }

  get filteredActivities(): ProcessMapActivity[] {
    return this.parsed ? filterProcessMapActivities(this.parsed.activities, this.query) : [];
  }

  get filteredFlows(): ProcessMapFlow[] {
    return this.parsed ? filterProcessMapFlows(this.parsed.flows, this.query) : [];
  }

  get selectedVariant(): ProcessMapVariant | null {
    return this.filteredVariants.find((v) => v.id === this.selectedVariantId) ?? this.filteredVariants[0] ?? null;
  }

  get selectedActivity(): ProcessMapActivity | null {
    return this.filteredActivities.find((a) => a.id === this.selectedActivityId) ?? this.filteredActivities[0] ?? null;
  }

  get selectedFlow(): ProcessMapFlow | null {
    return this.filteredFlows.find((f) => f.id === this.selectedFlowId) ?? this.filteredFlows[0] ?? null;
  }

  get variantMetadataRows() {
    return this.selectedVariant ? buildProcessMapVariantMetadata(this.selectedVariant) : [];
  }

  get activityMetadataRows() {
    return this.selectedActivity ? buildProcessMapActivityMetadata(this.selectedActivity) : [];
  }

  get flowMetadataRows() {
    return this.selectedFlow ? buildProcessMapFlowMetadata(this.selectedFlow) : [];
  }

  get primarySuggestion() {
    const s = resolveProcessMapSuggestion({ hasFiles: this.files.length > 0, hasError: !!this.errorMessage });
    return !s || s.id === this.dismissedSuggestionId ? null : s;
  }

  frequencyTint(pct: number): string {
    return processMapFrequencyColor(pct);
  }

  variantTint(index: number): string {
    return processMapVariantColor(index);
  }

  formatDuration(ms: number): string {
    return formatProcessMapDuration(ms);
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
      if (this.viewMode === 'frequencies') this.shiftActivity(1);
      else if (this.viewMode === 'map') this.shiftFlow(1);
      else this.shiftVariant(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (this.viewMode === 'frequencies') this.shiftActivity(-1);
      else if (this.viewMode === 'map') this.shiftFlow(-1);
      else this.shiftVariant(-1);
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      this.query = '';
      this.onFilterChange();
    }
  }

  trackByFileId(_i: number, file: ProcessMapLoadedFile): string {
    return file.id;
  }

  trackByWarning(_i: number, warning: string): string {
    return warning;
  }

  trackByVariant(_i: number, variant: ProcessMapVariant): string {
    return variant.id;
  }

  trackByActivity(_i: number, activity: ProcessMapActivity): string {
    return activity.id;
  }

  trackByFlow(_i: number, flow: ProcessMapFlow): string {
    return flow.id;
  }

  formatSize(bytes: number): string {
    return formatProcessMapFileSize(bytes);
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
    const { accepted, rejected } = filterValidProcessMapFiles(files);
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
          const bytes = await readProcessMapFileBytes(file);
          const record = createProcessMapFileRecord(file, bytes);
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
          this.errorMessage = `${file.name}: ${error instanceof Error ? error.message : 'Invalid process map'}`;
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
    await this.handleFiles([createSampleProcessMapFile()]);
  }

  selectFile(index: number): void {
    if (index < 0 || index >= this.files.length || index === this.currentIndex) return;
    this.currentIndex = index;
    this.resetViewForCurrent();
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectVariant(id: string): void {
    this.selectedVariantId = id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectActivity(id: string): void {
    this.selectedActivityId = id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectFlow(id: string): void {
    this.selectedFlowId = id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  onFilterChange(): void {
    const variant = this.filteredVariants[0];
    if (variant && !this.filteredVariants.some((v) => v.id === this.selectedVariantId)) this.selectedVariantId = variant.id;
    const activity = this.filteredActivities[0];
    if (activity && !this.filteredActivities.some((a) => a.id === this.selectedActivityId)) this.selectedActivityId = activity.id;
    const flow = this.filteredFlows[0];
    if (flow && !this.filteredFlows.some((f) => f.id === this.selectedFlowId)) this.selectedFlowId = flow.id;
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
    this.selectedVariantId = '';
    this.selectedActivityId = '';
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

  setViewMode(mode: ProcessMapViewMode): void {
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

  exportAs(format: ProcessMapExportFormat, event: Event): void {
    event.stopPropagation();
    this.showExportMenu = false;
    const file = this.currentFile;
    if (!file?.parsed) return;
    try {
      if (format === 'original') downloadBinaryFile(file.bytes, file.name, 'application/octet-stream');
      else if (format === 'summary-json') downloadTextFile(exportProcessMapSummaryJson(file), `${file.name}.summary.json`, 'application/json');
      else if (format === 'variants-csv') downloadTextFile(exportProcessMapVariantsCsv(file.parsed), `${file.name}.variants.csv`, 'text/csv');
      else if (format === 'flows-csv') downloadTextFile(exportProcessMapFlowsCsv(file.parsed), `${file.name}.flows.csv`, 'text/csv');
      else if (format === 'png') {
        const canvas = this.canvasHost?.nativeElement;
        if (!canvas || this.viewMode === 'table') {
          this.toast.info('Open Variants, Frequencies, or Map to export a PNG snapshot');
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

  private shiftVariant(delta: number): void {
    const list = this.filteredVariants;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((v) => v.id === this.selectedVariantId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectVariant(next.id);
  }

  private shiftActivity(delta: number): void {
    const list = this.filteredActivities;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((a) => a.id === this.selectedActivityId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectActivity(next.id);
  }

  private shiftFlow(delta: number): void {
    const list = this.filteredFlows;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((f) => f.id === this.selectedFlowId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectFlow(next.id);
  }

  private resetViewForCurrent(): void {
    this.query = '';
    this.selectedVariantId = this.parsed?.variants[0]?.id ?? '';
    this.selectedActivityId = this.parsed?.activities[0]?.id ?? '';
    this.selectedFlowId = this.parsed?.flows[0]?.id ?? '';
  }

  private renderCanvas(): void {
    if (!this.isBrowser || this.viewMode === 'table') return;
    const canvas = this.canvasHost?.nativeElement;
    if (!canvas || !this.parsed) return;
    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = Math.max(320, parent.clientWidth);
      canvas.height = Math.max(180, Math.min(this.viewMode === 'map' ? 280 : 220, parent.clientHeight || 240));
    }
    if (this.viewMode === 'variants') renderProcessMapVariants(canvas, this.filteredVariants, this.selectedVariant?.id ?? null);
    else if (this.viewMode === 'frequencies') renderProcessMapFrequencies(canvas, this.filteredActivities, this.selectedActivity?.id ?? null);
    else renderProcessMapFlows(canvas, this.filteredFlows, this.selectedFlow?.id ?? null);
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
