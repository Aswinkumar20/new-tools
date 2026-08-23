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
  TRACE_EXPLORER_ACCEPT_ATTR,
  TRACE_EXPLORER_FORMATS_HINT,
  TRACE_EXPLORER_FORMATS_LABEL,
  TRACE_EXPLORER_RELATED_TOOLS,
  TRACE_EXPLORER_SUPPORTED_EXTENSIONS
} from '../../constants/trace-explorer.constants';
import type {
  TraceAttributeStat,
  TraceCase,
  TraceExplorerExportFormat,
  TraceExplorerLoadedFile,
  TraceExplorerViewMode,
  TraceStep
} from '../../types/trace-explorer.types';
import {
  buildTraceAttributeMetadata,
  buildTraceCaseMetadata,
  buildTraceExplorerMetadataRows,
  buildTraceStepMetadata,
  canExportTraceExplorer,
  canvasToPngDataUrl,
  createSampleTraceExplorerFile,
  createTraceExplorerFileRecord,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  exportTraceExplorerStepsCsv,
  exportTraceExplorerSummaryJson,
  exportTraceExplorerTracesCsv,
  filterTraceAttributes,
  filterTraceCases,
  filterTraceSteps,
  filterValidTraceExplorerFiles,
  formatTraceDuration,
  formatTraceExplorerFileSize,
  readTraceExplorerFileBytes,
  renderTraceAttributes,
  renderTracePaths,
  renderTraceSteps,
  resolveTraceExplorerSuggestion,
  traceExplorerColor
} from '../../utils/trace-explorer.utils';

@Component({
  selector: 'lib-trace-explorer',
  standalone: true,
  templateUrl: './trace-explorer.html',
  styleUrls: ['./trace-explorer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TraceExplorerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('canvasHost') canvasHost?: ElementRef<HTMLCanvasElement>;
  @ViewChild('mapWrap') mapWrap?: ElementRef<HTMLElement>;
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  readonly acceptAttr = TRACE_EXPLORER_ACCEPT_ATTR;
  readonly relatedTools = TRACE_EXPLORER_RELATED_TOOLS;
  readonly supportedExtensions = TRACE_EXPLORER_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = TRACE_EXPLORER_FORMATS_LABEL;
  readonly formatsHint = TRACE_EXPLORER_FORMATS_HINT;
  readonly viewModes: Array<{ id: TraceExplorerViewMode; label: string }> = [
    { id: 'path', label: 'Path' },
    { id: 'attributes', label: 'Attributes' },
    { id: 'steps', label: 'Steps' },
    { id: 'table', label: 'Table' }
  ];

  files: TraceExplorerLoadedFile[] = [];
  currentIndex = -1;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;
  viewMode: TraceExplorerViewMode = 'path';
  query = '';
  selectedTraceId = '';
  selectedAttributeId = '';
  selectedStepId = '';

  private dragDepth = 0;
  private resizeObserver: ResizeObserver | null = null;

  get currentFile(): TraceExplorerLoadedFile | null {
    return this.currentIndex >= 0 ? this.files[this.currentIndex] ?? null : null;
  }

  get parsed() {
    return this.currentFile?.parsed ?? null;
  }

  get canExport(): boolean {
    return canExportTraceExplorer(this.currentFile);
  }

  get warnings(): string[] {
    return this.currentFile?.warnings ?? [];
  }

  get metadataRows() {
    return this.parsed ? buildTraceExplorerMetadataRows(this.parsed) : [];
  }

  get filteredTraces(): TraceCase[] {
    return this.parsed ? filterTraceCases(this.parsed.traces, this.query) : [];
  }

  get filteredAttributes(): TraceAttributeStat[] {
    return this.parsed ? filterTraceAttributes(this.parsed.attributes, this.query) : [];
  }

  get filteredSteps(): TraceStep[] {
    return this.parsed ? filterTraceSteps(this.parsed.steps, this.query) : [];
  }

  get selectedTrace(): TraceCase | null {
    return this.filteredTraces.find((t) => t.id === this.selectedTraceId) ?? this.filteredTraces[0] ?? null;
  }

  get selectedAttribute(): TraceAttributeStat | null {
    return this.filteredAttributes.find((a) => a.id === this.selectedAttributeId) ?? this.filteredAttributes[0] ?? null;
  }

  get selectedStep(): TraceStep | null {
    return this.filteredSteps.find((s) => s.id === this.selectedStepId) ?? this.filteredSteps[0] ?? null;
  }

  get traceMetadataRows() {
    return this.selectedTrace ? buildTraceCaseMetadata(this.selectedTrace) : [];
  }

  get attributeMetadataRows() {
    return this.selectedAttribute ? buildTraceAttributeMetadata(this.selectedAttribute) : [];
  }

  get stepMetadataRows() {
    return this.selectedStep ? buildTraceStepMetadata(this.selectedStep) : [];
  }

  get primarySuggestion() {
    const s = resolveTraceExplorerSuggestion({ hasFiles: this.files.length > 0, hasError: !!this.errorMessage });
    return !s || s.id === this.dismissedSuggestionId ? null : s;
  }

  tint(index: number): string {
    return traceExplorerColor(index);
  }

  formatDuration(ms: number): string {
    return formatTraceDuration(ms);
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
      if (this.viewMode === 'attributes') this.shiftAttribute(1);
      else if (this.viewMode === 'steps') this.shiftStep(1);
      else this.shiftTrace(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (this.viewMode === 'attributes') this.shiftAttribute(-1);
      else if (this.viewMode === 'steps') this.shiftStep(-1);
      else this.shiftTrace(-1);
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      this.query = '';
      this.onFilterChange();
    }
  }

  trackByFileId(_i: number, file: TraceExplorerLoadedFile): string {
    return file.id;
  }

  trackByWarning(_i: number, warning: string): string {
    return warning;
  }

  trackByTrace(_i: number, trace: TraceCase): string {
    return trace.id;
  }

  trackByAttribute(_i: number, attr: TraceAttributeStat): string {
    return attr.id;
  }

  trackByStep(_i: number, step: TraceStep): string {
    return step.id;
  }

  formatSize(bytes: number): string {
    return formatTraceExplorerFileSize(bytes);
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
    const { accepted, rejected } = filterValidTraceExplorerFiles(files);
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
          const bytes = await readTraceExplorerFileBytes(file);
          const record = createTraceExplorerFileRecord(file, bytes);
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
          this.errorMessage = `${file.name}: ${error instanceof Error ? error.message : 'Invalid traces'}`;
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
    await this.handleFiles([createSampleTraceExplorerFile()]);
  }

  selectFile(index: number): void {
    if (index < 0 || index >= this.files.length || index === this.currentIndex) return;
    this.currentIndex = index;
    this.resetViewForCurrent();
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectTrace(id: string): void {
    this.selectedTraceId = id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectAttribute(id: string): void {
    this.selectedAttributeId = id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectStep(id: string): void {
    this.selectedStepId = id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  onFilterChange(): void {
    const trace = this.filteredTraces[0];
    if (trace && !this.filteredTraces.some((t) => t.id === this.selectedTraceId)) this.selectedTraceId = trace.id;
    const attr = this.filteredAttributes[0];
    if (attr && !this.filteredAttributes.some((a) => a.id === this.selectedAttributeId)) this.selectedAttributeId = attr.id;
    const step = this.filteredSteps[0];
    if (step && !this.filteredSteps.some((s) => s.id === this.selectedStepId)) this.selectedStepId = step.id;
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
    this.selectedTraceId = '';
    this.selectedAttributeId = '';
    this.selectedStepId = '';
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

  setViewMode(mode: TraceExplorerViewMode): void {
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

  exportAs(format: TraceExplorerExportFormat, event: Event): void {
    event.stopPropagation();
    this.showExportMenu = false;
    const file = this.currentFile;
    if (!file?.parsed) return;
    try {
      if (format === 'original') downloadBinaryFile(file.bytes, file.name, 'application/octet-stream');
      else if (format === 'summary-json') downloadTextFile(exportTraceExplorerSummaryJson(file), `${file.name}.summary.json`, 'application/json');
      else if (format === 'traces-csv') downloadTextFile(exportTraceExplorerTracesCsv(file.parsed), `${file.name}.traces.csv`, 'text/csv');
      else if (format === 'steps-csv') downloadTextFile(exportTraceExplorerStepsCsv(file.parsed), `${file.name}.steps.csv`, 'text/csv');
      else if (format === 'png') {
        const canvas = this.canvasHost?.nativeElement;
        if (!canvas || this.viewMode === 'table') {
          this.toast.info('Open Path, Attributes, or Steps to export a PNG snapshot');
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

  private shiftTrace(delta: number): void {
    const list = this.filteredTraces;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((t) => t.id === this.selectedTraceId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectTrace(next.id);
  }

  private shiftAttribute(delta: number): void {
    const list = this.filteredAttributes;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((a) => a.id === this.selectedAttributeId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectAttribute(next.id);
  }

  private shiftStep(delta: number): void {
    const list = this.filteredSteps;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((s) => s.id === this.selectedStepId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectStep(next.id);
  }

  private resetViewForCurrent(): void {
    this.query = '';
    this.selectedTraceId = this.parsed?.traces[0]?.id ?? '';
    this.selectedAttributeId = this.parsed?.attributes[0]?.id ?? '';
    this.selectedStepId = this.parsed?.steps[0]?.id ?? '';
  }

  private renderCanvas(): void {
    if (!this.isBrowser || this.viewMode === 'table') return;
    const canvas = this.canvasHost?.nativeElement;
    if (!canvas || !this.parsed) return;
    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = Math.max(320, parent.clientWidth);
      canvas.height = Math.max(180, Math.min(this.viewMode === 'steps' ? 280 : 220, parent.clientHeight || 240));
    }
    if (this.viewMode === 'path') renderTracePaths(canvas, this.filteredTraces, this.selectedTrace?.id ?? null);
    else if (this.viewMode === 'attributes') renderTraceAttributes(canvas, this.filteredAttributes, this.selectedAttribute?.id ?? null);
    else renderTraceSteps(canvas, this.filteredSteps, this.selectedStep?.id ?? null);
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
