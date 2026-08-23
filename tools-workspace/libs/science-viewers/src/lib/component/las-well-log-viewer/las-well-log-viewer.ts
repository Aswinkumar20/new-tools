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
  LAS_ACCEPT_ATTR,
  LAS_FORMATS_HINT,
  LAS_FORMATS_LABEL,
  LAS_RELATED_TOOLS,
  LAS_SUPPORTED_EXTENSIONS
} from '../../constants/las-well-log-viewer.constants';
import type {
  LasExportFormat,
  LasLoadedFile,
  LasViewMode
} from '../../types/las-well-log-viewer.types';
import type { WellLogCurve } from '../../types/well-log.types';
import { canvasToPngDataUrl } from '../../utils/science-image-render.utils';
import {
  buildCurveMetadata,
  buildLasMetadataRows,
  canExportLas,
  createLasFileRecord,
  createSampleLasFile,
  curveColor,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  exportLasCurvesCsv,
  exportLasSubset,
  exportLasSummaryJson,
  filterLasCurves,
  filterValidLasFiles,
  formatLasFileSize,
  lasHistogram,
  readLasFileBytes,
  renderWellCrossplot,
  renderWellLogTracks,
  resolveLasSuggestion
} from '../../utils/las-well-log-viewer.utils';

@Component({
  selector: 'lib-las-well-log-viewer',
  standalone: true,
  templateUrl: './las-well-log-viewer.html',
  styleUrls: ['./las-well-log-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LasWellLogViewerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('canvasHost') canvasHost?: ElementRef<HTMLCanvasElement>;
  @ViewChild('mapWrap') mapWrap?: ElementRef<HTMLElement>;
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  readonly acceptAttr = LAS_ACCEPT_ATTR;
  readonly relatedTools = LAS_RELATED_TOOLS;
  readonly supportedExtensions = LAS_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = LAS_FORMATS_LABEL;
  readonly formatsHint = LAS_FORMATS_HINT;
  readonly viewModes: Array<{ id: LasViewMode; label: string }> = [
    { id: 'tracks', label: 'Tracks' },
    { id: 'crossplot', label: 'Crossplot' },
    { id: 'histogram', label: 'Histogram' },
    { id: 'table', label: 'Table' }
  ];

  files: LasLoadedFile[] = [];
  currentIndex = -1;
  selectedRowIndex = 0;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;

  viewMode: LasViewMode = 'tracks';
  query = '';
  depthMin = 0;
  depthMax = 1;
  enabledMnemonics = new Set<string>();
  selectedMnemonic = '';
  crossplotX = '';
  crossplotY = '';

  private dragDepth = 0;
  private resizeObserver: ResizeObserver | null = null;

  get currentFile(): LasLoadedFile | null {
    return this.currentIndex >= 0 ? this.files[this.currentIndex] ?? null : null;
  }

  get parsed() {
    return this.currentFile?.parsed ?? null;
  }

  get canExport(): boolean {
    return canExportLas(this.currentFile);
  }

  get warnings(): string[] {
    return this.currentFile?.warnings ?? [];
  }

  get metadataRows() {
    return this.parsed ? buildLasMetadataRows(this.parsed) : [];
  }

  get visibleCurves(): WellLogCurve[] {
    if (!this.parsed) return [];
    return filterLasCurves(this.parsed.curves, this.query).filter((c) => this.enabledMnemonics.has(c.mnemonic));
  }

  get filteredCurveList(): WellLogCurve[] {
    return this.parsed ? filterLasCurves(this.parsed.curves, this.query) : [];
  }

  get selectedCurve(): WellLogCurve | null {
    return this.parsed?.curves.find((c) => c.mnemonic === this.selectedMnemonic) ?? this.visibleCurves[0] ?? null;
  }

  get curveMetadataRows() {
    return this.selectedCurve ? buildCurveMetadata(this.selectedCurve) : [];
  }

  get histogramBars() {
    return this.selectedCurve ? lasHistogram(this.selectedCurve) : [];
  }

  get xCurve(): WellLogCurve | null {
    return this.parsed?.curves.find((c) => c.mnemonic === this.crossplotX) ?? this.parsed?.curves[0] ?? null;
  }

  get yCurve(): WellLogCurve | null {
    return this.parsed?.curves.find((c) => c.mnemonic === this.crossplotY) ?? this.parsed?.curves[1] ?? this.parsed?.curves[0] ?? null;
  }

  get tableRows(): number[] {
    if (!this.parsed) return [];
    const rows: number[] = [];
    for (let i = 0; i < this.parsed.depth.length; i++) {
      const d = this.parsed.depth[i];
      if (d >= this.depthMin && d <= this.depthMax) rows.push(i);
    }
    return rows;
  }

  get wellRows() {
    return this.parsed?.well ?? [];
  }

  get parameterRows() {
    return this.parsed?.parameters ?? [];
  }

  get primarySuggestion() {
    const s = resolveLasSuggestion({ hasFiles: this.files.length > 0, hasError: !!this.errorMessage });
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
    if (!this.currentFile) return;
    if (event.key === '/') {
      event.preventDefault();
      this.searchInput?.nativeElement?.focus();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (this.viewMode === 'table') this.selectRow(Math.min(this.tableRows.length - 1, this.selectedRowIndex + 1));
      else this.panDepth(0.1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (this.viewMode === 'table') this.selectRow(Math.max(0, this.selectedRowIndex - 1));
      else this.panDepth(-0.1);
    } else if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      this.zoomDepth(0.8);
    } else if (event.key === '-' || event.key === '_') {
      event.preventDefault();
      this.zoomDepth(1.25);
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      this.fitDepth();
    }
  }

  trackByFileId(_i: number, file: LasLoadedFile): string {
    return file.id;
  }

  trackByWarning(_i: number, warning: string): string {
    return warning;
  }

  trackByCurve(_i: number, curve: WellLogCurve): string {
    return curve.mnemonic;
  }

  trackByRow(_i: number, index: number): number {
    return index;
  }

  curveSwatch(mnemonic: string, index = 0): string {
    return curveColor(mnemonic, index);
  }

  formatSize(bytes: number): string {
    return formatLasFileSize(bytes);
  }

  formatValue(value: number | undefined): string {
    return value == null || !Number.isFinite(value) ? '—' : value.toFixed(3);
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
    const { accepted, rejected } = filterValidLasFiles(files);
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
          const bytes = await readLasFileBytes(file);
          const record = createLasFileRecord(file, bytes);
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
          this.errorMessage = `${file.name}: ${error instanceof Error ? error.message : 'Invalid LAS'}`;
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
    await this.handleFiles([createSampleLasFile()]);
  }

  selectFile(index: number): void {
    if (index < 0 || index >= this.files.length || index === this.currentIndex) return;
    this.currentIndex = index;
    this.resetViewForCurrent();
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectCurve(mnemonic: string): void {
    this.selectedMnemonic = mnemonic;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  toggleCurve(mnemonic: string): void {
    if (this.enabledMnemonics.has(mnemonic)) {
      if (this.enabledMnemonics.size === 1) return;
      this.enabledMnemonics.delete(mnemonic);
    } else this.enabledMnemonics.add(mnemonic);
    this.enabledMnemonics = new Set(this.enabledMnemonics);
    if (!this.enabledMnemonics.has(this.selectedMnemonic)) {
      this.selectedMnemonic = [...this.enabledMnemonics][0] ?? '';
    }
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  toggleLogScale(curve: WellLogCurve): void {
    curve.logScale = !curve.logScale;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  toggleReversed(curve: WellLogCurve): void {
    curve.reversed = !curve.reversed;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectRow(index: number): void {
    if (index < 0 || index >= this.tableRows.length) return;
    this.selectedRowIndex = index;
    this.cdr.markForCheck();
  }

  onDepthChange(): void {
    if (this.depthMin > this.depthMax) {
      const tmp = this.depthMin;
      this.depthMin = this.depthMax;
      this.depthMax = tmp;
    }
    this.selectedRowIndex = 0;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  onFilterChange(): void {
    this.selectedRowIndex = 0;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  setCrossplotX(mnemonic: string): void {
    this.crossplotX = mnemonic;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  setCrossplotY(mnemonic: string): void {
    this.crossplotY = mnemonic;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  zoomDepth(factor: number): void {
    if (!this.parsed) return;
    const mid = (this.depthMin + this.depthMax) / 2;
    const half = ((this.depthMax - this.depthMin) * factor) / 2;
    const fullMin = this.parsed.depth[0];
    const fullMax = this.parsed.depth[this.parsed.depth.length - 1];
    this.depthMin = Math.max(fullMin, mid - half);
    this.depthMax = Math.min(fullMax, mid + half);
    if (this.depthMax - this.depthMin < Math.abs(this.parsed.step || 0.5)) {
      this.depthMin = Math.max(fullMin, mid - Math.abs(this.parsed.step || 0.5));
      this.depthMax = Math.min(fullMax, mid + Math.abs(this.parsed.step || 0.5));
    }
    this.onDepthChange();
  }

  panDepth(fraction: number): void {
    if (!this.parsed) return;
    const span = this.depthMax - this.depthMin;
    const delta = span * fraction;
    const fullMin = this.parsed.depth[0];
    const fullMax = this.parsed.depth[this.parsed.depth.length - 1];
    let nextMin = this.depthMin + delta;
    let nextMax = this.depthMax + delta;
    if (nextMin < fullMin) {
      nextMax += fullMin - nextMin;
      nextMin = fullMin;
    }
    if (nextMax > fullMax) {
      nextMin -= nextMax - fullMax;
      nextMax = fullMax;
    }
    this.depthMin = Math.max(fullMin, nextMin);
    this.depthMax = Math.min(fullMax, nextMax);
    this.onDepthChange();
  }

  fitDepth(): void {
    if (!this.parsed?.depth.length) return;
    this.depthMin = this.parsed.depth[0];
    this.depthMax = this.parsed.depth[this.parsed.depth.length - 1];
    this.onDepthChange();
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
    this.selectedRowIndex = 0;
    this.errorMessage = '';
    this.query = '';
    this.enabledMnemonics = new Set();
    this.selectedMnemonic = '';
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

  setViewMode(mode: LasViewMode): void {
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

  exportAs(format: LasExportFormat, event: Event): void {
    event.stopPropagation();
    this.showExportMenu = false;
    const file = this.currentFile;
    if (!file?.parsed) return;
    try {
      const mnemonics = this.visibleCurves.map((c) => c.mnemonic);
      if (format === 'original') downloadBinaryFile(new TextEncoder().encode(file.text), file.name, 'text/plain');
      else if (format === 'summary-json') downloadTextFile(exportLasSummaryJson(file), `${file.name}.summary.json`, 'application/json');
      else if (format === 'curves-csv') downloadTextFile(exportLasCurvesCsv(file.parsed, mnemonics), `${file.name}.curves.csv`, 'text/csv');
      else if (format === 'subset-las') {
        downloadTextFile(
          exportLasSubset(file.parsed, mnemonics, this.depthMin, this.depthMax),
          `${file.name}.subset.las`,
          'text/plain'
        );
      } else if (format === 'png') {
        const canvas = this.canvasHost?.nativeElement;
        if (!canvas) {
          this.toast.info('Open Tracks or Crossplot to export a PNG snapshot');
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

  private resetViewForCurrent(): void {
    const parsed = this.parsed;
    this.selectedRowIndex = 0;
    this.query = '';
    if (!parsed?.curves.length) {
      this.enabledMnemonics = new Set();
      this.selectedMnemonic = '';
      this.crossplotX = '';
      this.crossplotY = '';
      this.depthMin = 0;
      this.depthMax = 1;
      return;
    }
    this.enabledMnemonics = new Set(parsed.curves.map((c) => c.mnemonic));
    this.selectedMnemonic = parsed.curves[0].mnemonic;
    this.crossplotX = parsed.curves[0].mnemonic;
    this.crossplotY = parsed.curves[1]?.mnemonic || parsed.curves[0].mnemonic;
    this.depthMin = parsed.depth[0];
    this.depthMax = parsed.depth[parsed.depth.length - 1];
  }

  private renderCanvas(): void {
    if (!this.isBrowser || (this.viewMode !== 'tracks' && this.viewMode !== 'crossplot')) return;
    const canvas = this.canvasHost?.nativeElement;
    const parsed = this.parsed;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = Math.max(320, parent.clientWidth);
      canvas.height = Math.max(280, parent.clientHeight || 420);
    }
    if (!parsed?.depth.length) {
      this.clearCanvas();
      return;
    }
    if (this.viewMode === 'tracks') {
      renderWellLogTracks(canvas, parsed.depth, this.visibleCurves.length ? this.visibleCurves : parsed.curves, {
        depthMin: this.depthMin,
        depthMax: this.depthMax,
        selectedMnemonic: this.selectedMnemonic || null
      });
      return;
    }
    if (this.xCurve && this.yCurve) {
      renderWellCrossplot(canvas, this.xCurve, this.yCurve, parsed.depth, {
        depthMin: this.depthMin,
        depthMax: this.depthMax
      });
    }
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
