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
import { AssetService, Navigation, ToastService, TooltipDirective } from '@tools-workspace/features-home';
import {
  FASTA_ACCEPT_ATTR,
  FASTA_FORMATS_HINT,
  FASTA_FORMATS_LABEL,
  FASTA_RELATED_TOOLS,
  FASTA_SUPPORTED_EXTENSIONS
} from '../../constants/fasta-viewer.constants';
import type {
  FastaExportFormat,
  FastaLoadedFile,
  FastaRecord,
  FastaViewMode,
  FastaWrap
} from '../../types/fasta-viewer.types';
import type { SequenceWrapLine } from '../../types/sequence.types';
import { canvasToPngDataUrl, drawHistogramToCanvas } from '../../utils/science-image-render.utils';
import {
  buildFastaMetadataRows,
  buildRecordMetadataRows,
  canExportFasta,
  createFastaFileRecord,
  createSampleFastaFile,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  exportFastaSequencesCsv,
  exportFastaSummaryJson,
  exportSelectedFasta,
  filterFastaRecords,
  filterValidFastaFiles,
  formatFastaFileSize,
  readFastaFileBytes,
  recordCompositionBars,
  residueColor,
  resolveFastaSuggestion,
  reverseComplement,
  translateSequence,
  wrapSequence
} from '../../utils/fasta-viewer.utils';

@Component({
  selector: 'lib-fasta-viewer',
  standalone: true,
  templateUrl: './fasta-viewer.html',
  styleUrls: ['./fasta-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FastaViewerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('canvasHost') canvasHost?: ElementRef<HTMLCanvasElement>;
  @ViewChild('mapWrap') mapWrap?: ElementRef<HTMLElement>;
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  readonly acceptAttr = FASTA_ACCEPT_ATTR;
  readonly relatedTools = FASTA_RELATED_TOOLS;
  readonly supportedExtensions = FASTA_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = FASTA_FORMATS_LABEL;
  readonly formatsHint = FASTA_FORMATS_HINT;
  readonly wraps: FastaWrap[] = [60, 80, 100, 0];
  readonly translateFrames = [0, 1, 2];
  readonly viewModes: Array<{ id: FastaViewMode; label: string }> = [
    { id: 'sequence', label: 'Sequence' },
    { id: 'composition', label: 'Composition' }
  ];

  files: FastaLoadedFile[] = [];
  currentIndex = -1;
  selectedRecordIndex = 0;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;

  viewMode: FastaViewMode = 'sequence';
  wrap: FastaWrap = 60;
  colorize = true;
  query = '';
  jumpPos = '';
  displayMode: 'original' | 'rc' | 'translate' = 'original';
  translateFrame = 0;

  private dragDepth = 0;
  private resizeObserver: ResizeObserver | null = null;

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  get currentFile(): FastaLoadedFile | null {
    return this.currentIndex >= 0 ? this.files[this.currentIndex] ?? null : null;
  }

  get parsed() {
    return this.currentFile?.parsed ?? null;
  }

  get canExport(): boolean {
    return canExportFasta(this.currentFile);
  }

  get warnings(): string[] {
    return this.currentFile?.warnings ?? [];
  }

  get metadataRows() {
    return this.parsed ? buildFastaMetadataRows(this.parsed) : [];
  }

  get visibleRecords(): FastaRecord[] {
    if (!this.parsed) return [];
    return filterFastaRecords(this.parsed.records, this.query);
  }

  get selectedRecord(): FastaRecord | null {
    return this.visibleRecords[this.selectedRecordIndex] ?? null;
  }

  get recordMetadataRows() {
    return this.selectedRecord ? buildRecordMetadataRows(this.selectedRecord) : [];
  }

  get compositionBars() {
    return this.selectedRecord ? recordCompositionBars(this.selectedRecord) : [];
  }

  get displaySequence(): string {
    const record = this.selectedRecord;
    if (!record) return '';
    if (this.displayMode === 'rc') return reverseComplement(record.sequence);
    if (this.displayMode === 'translate') return translateSequence(record.sequence, this.translateFrame);
    return record.sequence;
  }

  get displayAlphabet() {
    if (this.displayMode === 'translate') return 'protein' as const;
    return this.selectedRecord?.alphabet ?? 'dna';
  }

  get wrappedLines(): SequenceWrapLine[] {
    const seq = this.displaySequence;
    const maxChars = this.colorize ? 12_000 : 80_000;
    const clipped = seq.length > maxChars ? seq.slice(0, maxChars) : seq;
    return wrapSequence(clipped, this.wrap);
  }

  get sequenceClipped(): boolean {
    const maxChars = this.colorize ? 12_000 : 80_000;
    return this.displaySequence.length > maxChars;
  }

  get primarySuggestion() {
    const s = resolveFastaSuggestion({ hasFiles: this.files.length > 0, hasError: !!this.errorMessage });
    return !s || s.id === this.dismissedSuggestionId ? null : s;
  }

  get canUseCanvasExport(): boolean {
    return this.viewMode === 'composition';
  }

  get canCopy(): boolean {
    return !!this.displaySequence;
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
    if (this.isTypingTarget(event.target)) {
      if (event.key === 'Escape') (event.target as HTMLElement).blur();
      return;
    }
    if (event.key === 'Escape' && this.showExportMenu) {
      this.showExportMenu = false;
      this.cdr.markForCheck();
      return;
    }
    if (!this.currentFile) return;
    if (event.key === '/') {
      event.preventDefault();
      this.searchInput?.nativeElement?.focus();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.selectRecord(Math.min(this.visibleRecords.length - 1, this.selectedRecordIndex + 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.selectRecord(Math.max(0, this.selectedRecordIndex - 1));
    } else if (event.key.toLowerCase() === 'r') {
      event.preventDefault();
      this.setDisplayMode(this.displayMode === 'rc' ? 'original' : 'rc');
    } else if (event.key.toLowerCase() === 't') {
      event.preventDefault();
      this.setDisplayMode(this.displayMode === 'translate' ? 'original' : 'translate');
    } else if (event.key.toLowerCase() === 'c' && (event.metaKey || event.ctrlKey)) {
      return;
    } else if (event.key.toLowerCase() === 'c') {
      event.preventDefault();
      void this.copySequence();
    }
  }

  // ---------------------------------------------------------------------------
  // TrackBy / formatters
  // ---------------------------------------------------------------------------

  trackByFileId(_index: number, file: FastaLoadedFile): string {
    return file.id;
  }

  trackByWarning(_index: number, warning: string): string {
    return warning;
  }

  trackByRecord(_index: number, record: FastaRecord): string {
    return `${record.index}:${record.id}`;
  }

  trackByLine(_index: number, line: SequenceWrapLine): number {
    return line.start;
  }

  trackByChar(index: number, ch: string): string {
    return `${index}:${ch}`;
  }

  residueStyle(ch: string): Record<string, string> {
    if (!this.colorize) return {};
    return { color: residueColor(ch, this.displayAlphabet) };
  }

  formatSize(bytes: number): string {
    return formatFastaFileSize(bytes);
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
    const { accepted, rejected } = filterValidFastaFiles(files);
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
          const bytes = await readFastaFileBytes(file);
          const record = createFastaFileRecord(file, bytes);
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
          this.errorMessage = `${file.name}: ${error instanceof Error ? error.message : 'Invalid FASTA'}`;
          this.toast.error(this.errorMessage);
        }
      }
      this.renderCanvas();
      if (this.currentFile) {
        this.errorMessage = '';
        this.toast.success(`Loaded ${this.currentFile.name}`);
        if (this.currentFile.softFail) {
          this.toast.warning('Parsed with no sequence records — metadata may still be available');
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
    await this.handleFiles([createSampleFastaFile()]);
  }

  selectFile(index: number): void {
    if (index < 0 || index >= this.files.length || index === this.currentIndex) return;
    this.currentIndex = index;
    this.resetViewForCurrent();
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectRecord(index: number): void {
    if (index < 0 || index >= this.visibleRecords.length) return;
    if (index === this.selectedRecordIndex) return;
    this.selectedRecordIndex = index;
    this.displayMode = 'original';
    this.jumpPos = '';
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
    this.selectedRecordIndex = 0;
    this.errorMessage = '';
    this.query = '';
    this.jumpPos = '';
    this.displayMode = 'original';
    this.translateFrame = 0;
    this.wrap = 60;
    this.colorize = true;
    this.viewMode = 'sequence';
    this.showExportMenu = false;
    this.showDropZone = false;
    this.dragDepth = 0;
    this.dismissedSuggestionId = null;
    this.clearCanvas();
    this.cdr.markForCheck();
  }

  // ---------------------------------------------------------------------------
  // Selection / filters / view controls
  // ---------------------------------------------------------------------------

  setViewMode(mode: FastaViewMode): void {
    if (this.viewMode === mode) return;
    this.viewMode = mode;
    this.cdr.markForCheck();
    setTimeout(() => this.renderCanvas(), 0);
  }

  setWrap(wrap: FastaWrap): void {
    if (this.wrap === wrap) return;
    this.wrap = wrap;
    this.cdr.markForCheck();
  }

  toggleColor(): void {
    this.colorize = !this.colorize;
    this.cdr.markForCheck();
  }

  setDisplayMode(mode: 'original' | 'rc' | 'translate'): void {
    if (mode === 'rc' || mode === 'translate') {
      const alphabet = this.selectedRecord?.alphabet;
      if (alphabet === 'protein') {
        this.toast.info('Reverse complement / translate apply to nucleic sequences.');
        return;
      }
    }
    if (this.displayMode === mode) return;
    this.displayMode = mode;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  setTranslateFrame(frame: number): void {
    const next = Math.max(0, Math.min(2, Math.round(frame)));
    if (this.translateFrame === next) return;
    this.translateFrame = next;
    this.cdr.markForCheck();
  }

  onQueryChange(): void {
    if (this.selectedRecordIndex >= this.visibleRecords.length) {
      this.selectedRecordIndex = 0;
    }
    if (!this.visibleRecords.length) {
      this.selectedRecordIndex = 0;
    }
    this.displayMode = 'original';
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  jumpToPosition(): void {
    const pos = Number(this.jumpPos);
    if (!Number.isFinite(pos) || pos < 1) {
      this.cdr.markForCheck();
      return;
    }
    this.cdr.markForCheck();
  }

  lineHighlighted(line: SequenceWrapLine): boolean {
    const pos = Number(this.jumpPos);
    if (!Number.isFinite(pos) || pos < 1) return false;
    const end = line.start + line.text.length - 1;
    return pos >= line.start && pos <= end;
  }

  async copySequence(): Promise<void> {
    const seq = this.displaySequence;
    if (!seq) {
      this.toast.info('Nothing to copy');
      this.cdr.markForCheck();
      return;
    }
    if (!this.isBrowser || typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      this.toast.error('Clipboard is not available');
      this.cdr.markForCheck();
      return;
    }
    try {
      await navigator.clipboard.writeText(seq);
      this.toast.success('Sequence copied');
    } catch {
      this.toast.error('Could not copy sequence');
    }
    this.cdr.markForCheck();
  }

  // ---------------------------------------------------------------------------
  // Suggestions / chrome / export
  // ---------------------------------------------------------------------------

  dismissSuggestion(id: string): void {
    this.dismissedSuggestionId = id;
    this.cdr.markForCheck();
  }

  applySuggestion(suggestion: { action: string }): void {
    if (suggestion.action === 'sample') void this.loadSample();
    else this.openFilePicker();
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

  exportAs(format: FastaExportFormat, event: Event): void {
    event.stopPropagation();
    this.showExportMenu = false;
    const file = this.currentFile;
    if (!this.canExport || !file?.parsed) {
      this.toast.info('Nothing to export');
      this.cdr.markForCheck();
      return;
    }
    try {
      if (format === 'original') downloadBinaryFile(new TextEncoder().encode(file.text), file.name, 'text/plain');
      else if (format === 'summary-json') downloadTextFile(exportFastaSummaryJson(file), `${file.name}.summary.json`, 'application/json');
      else if (format === 'sequences-csv') downloadTextFile(exportFastaSequencesCsv(file.parsed), `${file.name}.sequences.csv`, 'text/csv');
      else if (format === 'selected-fasta') {
        if (!this.selectedRecord) {
          this.toast.info('Select a record to export as FASTA');
          this.cdr.markForCheck();
          return;
        }
        downloadTextFile(exportSelectedFasta(this.selectedRecord), `${this.selectedRecord.id}.fasta`, 'text/plain');
      } else if (format === 'png') {
        const canvas = this.canvasHost?.nativeElement;
        if (!canvas || !this.canUseCanvasExport) {
          this.toast.info('Open Composition view to export a PNG snapshot');
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

  private resetViewForCurrent(): void {
    this.selectedRecordIndex = 0;
    this.query = '';
    this.jumpPos = '';
    this.displayMode = 'original';
    this.translateFrame = 0;
  }

  private renderCanvas(): void {
    if (!this.isBrowser || !this.canUseCanvasExport) return;
    const canvas = this.canvasHost?.nativeElement;
    const record = this.selectedRecord;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = Math.max(320, parent.clientWidth);
      canvas.height = Math.max(220, parent.clientHeight || 420);
    }
    if (!record) {
      this.clearCanvas();
      return;
    }
    const bars = recordCompositionBars(record);
    drawHistogramToCanvas(
      canvas,
      bars.map((b) => b.count),
      { color: '#14b8a6', background: '#0f172a' }
    );
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
