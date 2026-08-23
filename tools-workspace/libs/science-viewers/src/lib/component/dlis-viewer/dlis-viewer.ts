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
  DLIS_ACCEPT_ATTR,
  DLIS_FORMATS_HINT,
  DLIS_FORMATS_LABEL,
  DLIS_RELATED_TOOLS,
  DLIS_SUPPORTED_EXTENSIONS
} from '../../constants/dlis-viewer.constants';
import type {
  DlisChannelInfo,
  DlisExportFormat,
  DlisLoadedFile,
  DlisViewMode,
  DlisVisibleRecord
} from '../../types/dlis-viewer.types';
import type { WellLogCurve } from '../../types/well-log.types';
import { canvasToPngDataUrl } from '../../utils/science-image-render.utils';
import {
  buildDlisCurveMetadata,
  buildDlisMetadataRows,
  canExportDlis,
  createDlisFileRecord,
  createSampleDlisFile,
  curveColor,
  dlisHistogram,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  exportDlisChannelsCsv,
  exportDlisFrameCsv,
  exportDlisSummaryJson,
  filterDlisChannels,
  filterValidDlisFiles,
  formatDlisFileSize,
  readDlisFileBytes,
  renderWellCrossplot,
  renderWellLogTracks,
  resolveDlisSuggestion
} from '../../utils/dlis-viewer.utils';

@Component({
  selector: 'lib-dlis-viewer',
  standalone: true,
  templateUrl: './dlis-viewer.html',
  styleUrls: ['./dlis-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DlisViewerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('canvasHost') canvasHost?: ElementRef<HTMLCanvasElement>;
  @ViewChild('mapWrap') mapWrap?: ElementRef<HTMLElement>;
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  readonly acceptAttr = DLIS_ACCEPT_ATTR;
  readonly relatedTools = DLIS_RELATED_TOOLS;
  readonly supportedExtensions = DLIS_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = DLIS_FORMATS_LABEL;
  readonly formatsHint = DLIS_FORMATS_HINT;
  readonly viewModes: Array<{ id: DlisViewMode; label: string }> = [
    { id: 'tracks', label: 'Tracks' },
    { id: 'records', label: 'Records' },
    { id: 'channels', label: 'Channels' }
  ];

  files: DlisLoadedFile[] = [];
  currentIndex = -1;
  selectedRecordIndex = 0;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;

  viewMode: DlisViewMode = 'tracks';
  query = '';
  depthMin = 0;
  depthMax = 1;
  enabledMnemonics = new Set<string>();
  selectedMnemonic = '';
  crossplotX = '';
  crossplotY = '';
  showCrossplot = false;

  private dragDepth = 0;
  private resizeObserver: ResizeObserver | null = null;

  get currentFile(): DlisLoadedFile | null {
    return this.currentIndex >= 0 ? this.files[this.currentIndex] ?? null : null;
  }

  get parsed() {
    return this.currentFile?.parsed ?? null;
  }

  get canExport(): boolean {
    return canExportDlis(this.currentFile);
  }

  get warnings(): string[] {
    return this.currentFile?.warnings ?? [];
  }

  get metadataRows() {
    return this.parsed ? buildDlisMetadataRows(this.parsed) : [];
  }

  get visibleCurves(): WellLogCurve[] {
    if (!this.parsed) return [];
    return this.parsed.curves.filter((c) => this.enabledMnemonics.has(c.mnemonic));
  }

  get filteredChannels(): DlisChannelInfo[] {
    return this.parsed ? filterDlisChannels(this.parsed.channels, this.query) : [];
  }

  get selectedCurve(): WellLogCurve | null {
    return this.parsed?.curves.find((c) => c.mnemonic === this.selectedMnemonic) ?? this.visibleCurves[0] ?? null;
  }

  get curveMetadataRows() {
    return this.selectedCurve ? buildDlisCurveMetadata(this.selectedCurve) : [];
  }

  get histogramBars() {
    return this.selectedCurve ? dlisHistogram(this.selectedCurve) : [];
  }

  get xCurve(): WellLogCurve | null {
    return this.parsed?.curves.find((c) => c.mnemonic === this.crossplotX) ?? this.parsed?.curves[0] ?? null;
  }

  get yCurve(): WellLogCurve | null {
    return this.parsed?.curves.find((c) => c.mnemonic === this.crossplotY) ?? this.parsed?.curves[1] ?? this.parsed?.curves[0] ?? null;
  }

  get selectedRecord(): DlisVisibleRecord | null {
    return this.parsed?.records[this.selectedRecordIndex] ?? this.parsed?.records[0] ?? null;
  }

  get allCurves() {
    return this.parsed?.curves ?? [];
  }

  get extractedNames() {
    return this.parsed?.extractedStrings ?? [];
  }

  get primarySuggestion() {
    const s = resolveDlisSuggestion({ hasFiles: this.files.length > 0, hasError: !!this.errorMessage });
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
    if (!this.currentFile || !this.parsed) return;
    if (event.key === '/') {
      event.preventDefault();
      this.searchInput?.nativeElement?.focus();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (this.viewMode === 'records') this.selectRecord(Math.min(this.parsed.records.length - 1, this.selectedRecordIndex + 1));
      else this.panDepth(0.1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (this.viewMode === 'records') this.selectRecord(Math.max(0, this.selectedRecordIndex - 1));
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

  trackByFileId(_i: number, file: DlisLoadedFile): string {
    return file.id;
  }

  trackByWarning(_i: number, warning: string): string {
    return warning;
  }

  trackByCurve(_i: number, curve: WellLogCurve): string {
    return curve.mnemonic;
  }

  trackByChannel(_i: number, channel: DlisChannelInfo): string {
    return channel.mnemonic;
  }

  trackByRecord(_i: number, record: DlisVisibleRecord): number {
    return record.index;
  }

  trackByString(_i: number, value: string): string {
    return value;
  }

  curveSwatch(mnemonic: string, index = 0): string {
    return curveColor(mnemonic, index);
  }

  formatSize(bytes: number): string {
    return formatDlisFileSize(bytes);
  }

  hexAttr(value: number): string {
    return `0x${value.toString(16).padStart(2, '0')}`;
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
    const { accepted, rejected } = filterValidDlisFiles(files);
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
          const bytes = await readDlisFileBytes(file);
          const record = createDlisFileRecord(file, bytes);
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
          this.errorMessage = `${file.name}: ${error instanceof Error ? error.message : 'Invalid DLIS'}`;
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
    await this.handleFiles([createSampleDlisFile()]);
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

  selectRecord(index: number): void {
    if (!this.parsed || index < 0 || index >= this.parsed.records.length) return;
    this.selectedRecordIndex = index;
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

  toggleCrossplot(): void {
    this.showCrossplot = !this.showCrossplot;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  onDepthChange(): void {
    if (this.depthMin > this.depthMax) {
      const tmp = this.depthMin;
      this.depthMin = this.depthMax;
      this.depthMax = tmp;
    }
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  onFilterChange(): void {
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
    if (!this.parsed?.depth.length) return;
    const mid = (this.depthMin + this.depthMax) / 2;
    const half = ((this.depthMax - this.depthMin) * factor) / 2;
    const fullMin = this.parsed.depth[0];
    const fullMax = this.parsed.depth[this.parsed.depth.length - 1];
    this.depthMin = Math.max(fullMin, mid - half);
    this.depthMax = Math.min(fullMax, mid + half);
    this.onDepthChange();
  }

  panDepth(fraction: number): void {
    if (!this.parsed?.depth.length) return;
    const span = this.depthMax - this.depthMin || 1;
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
    this.selectedRecordIndex = 0;
    this.errorMessage = '';
    this.query = '';
    this.enabledMnemonics = new Set();
    this.selectedMnemonic = '';
    this.showCrossplot = false;
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

  setViewMode(mode: DlisViewMode): void {
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

  exportAs(format: DlisExportFormat, event: Event): void {
    event.stopPropagation();
    this.showExportMenu = false;
    const file = this.currentFile;
    if (!file?.parsed) return;
    try {
      const mnemonics = this.visibleCurves.map((c) => c.mnemonic);
      if (format === 'original') downloadBinaryFile(file.bytes, file.name, 'application/octet-stream');
      else if (format === 'summary-json') downloadTextFile(exportDlisSummaryJson(file), `${file.name}.summary.json`, 'application/json');
      else if (format === 'channels-csv') downloadTextFile(exportDlisChannelsCsv(file.parsed), `${file.name}.channels.csv`, 'text/csv');
      else if (format === 'frame-csv') downloadTextFile(exportDlisFrameCsv(file.parsed, mnemonics.length ? mnemonics : file.parsed.curves.map((c) => c.mnemonic)), `${file.name}.frame.csv`, 'text/csv');
      else if (format === 'png') {
        const canvas = this.canvasHost?.nativeElement;
        if (!canvas) {
          this.toast.info('Open Tracks view to export a PNG snapshot');
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
    this.selectedRecordIndex = 0;
    this.query = '';
    this.showCrossplot = false;
    if (!parsed?.curves.length) {
      this.enabledMnemonics = new Set();
      this.selectedMnemonic = parsed?.channels[0]?.mnemonic ?? '';
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
    if (!this.isBrowser || this.viewMode !== 'tracks') return;
    const canvas = this.canvasHost?.nativeElement;
    const parsed = this.parsed;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = Math.max(320, parent.clientWidth);
      canvas.height = Math.max(280, parent.clientHeight || 420);
    }
    if (!parsed?.depth.length || !parsed.curves.length) {
      this.clearCanvas();
      return;
    }
    if (this.showCrossplot && this.xCurve && this.yCurve) {
      renderWellCrossplot(canvas, this.xCurve, this.yCurve, parsed.depth, {
        depthMin: this.depthMin,
        depthMax: this.depthMax
      });
      return;
    }
    renderWellLogTracks(canvas, parsed.depth, this.visibleCurves.length ? this.visibleCurves : parsed.curves, {
      depthMin: this.depthMin,
      depthMax: this.depthMax,
      selectedMnemonic: this.selectedMnemonic || null
    });
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
