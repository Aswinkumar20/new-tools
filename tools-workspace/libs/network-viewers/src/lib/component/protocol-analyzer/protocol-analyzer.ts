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
  PROTOCOL_ANALYZER_ACCEPT_ATTR,
  PROTOCOL_ANALYZER_FORMATS_HINT,
  PROTOCOL_ANALYZER_FORMATS_LABEL,
  PROTOCOL_ANALYZER_RELATED_TOOLS,
  PROTOCOL_ANALYZER_SUPPORTED_EXTENSIONS
} from '../../constants/protocol-analyzer.constants';
import type {
  ProtocolAnalyzerExportFormat,
  ProtocolAnalyzerLoadedFile,
  ProtocolAnalyzerViewMode,
  ProtocolDissector
} from '../../types/protocol-analyzer.types';
import type { PcapPacket } from '../../types/pcap-viewer.types';
import {
  buildDissectorMetadata,
  buildProtocolAnalyzerMetadataRows,
  canExportProtocolAnalyzer,
  canvasToPngDataUrl,
  createProtocolAnalyzerFileRecord,
  createSampleProtocolAnalyzerFile,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  exportProtocolDissectorsCsv,
  exportProtocolPacketsCsv,
  exportProtocolSummaryJson,
  filterProtocolDissectors,
  filterProtocolPackets,
  filterValidProtocolAnalyzerFiles,
  formatProtocolAnalyzerFileSize,
  protocolColor,
  readProtocolAnalyzerFileBytes,
  renderProtocolBars,
  renderProtocolTimeline,
  resolveProtocolAnalyzerSuggestion
} from '../../utils/protocol-analyzer.utils';

@Component({
  selector: 'lib-protocol-analyzer',
  standalone: true,
  templateUrl: './protocol-analyzer.html',
  styleUrls: ['./protocol-analyzer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProtocolAnalyzerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('canvasHost') canvasHost?: ElementRef<HTMLCanvasElement>;
  @ViewChild('mapWrap') mapWrap?: ElementRef<HTMLElement>;
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  readonly acceptAttr = PROTOCOL_ANALYZER_ACCEPT_ATTR;
  readonly relatedTools = PROTOCOL_ANALYZER_RELATED_TOOLS;
  readonly supportedExtensions = PROTOCOL_ANALYZER_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = PROTOCOL_ANALYZER_FORMATS_LABEL;
  readonly formatsHint = PROTOCOL_ANALYZER_FORMATS_HINT;
  readonly viewModes: Array<{ id: ProtocolAnalyzerViewMode; label: string }> = [
    { id: 'dissectors', label: 'Dissectors' },
    { id: 'timeline', label: 'Timeline' },
    { id: 'protocols', label: 'Protocols' },
    { id: 'table', label: 'Table' }
  ];

  files: ProtocolAnalyzerLoadedFile[] = [];
  currentIndex = -1;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;
  viewMode: ProtocolAnalyzerViewMode = 'dissectors';
  query = '';
  selectedProtocol = '';
  selectedPacketIndex = 0;

  private dragDepth = 0;
  private resizeObserver: ResizeObserver | null = null;

  get currentFile(): ProtocolAnalyzerLoadedFile | null {
    return this.currentIndex >= 0 ? this.files[this.currentIndex] ?? null : null;
  }

  get parsed() {
    return this.currentFile?.parsed ?? null;
  }

  get canExport(): boolean {
    return canExportProtocolAnalyzer(this.currentFile);
  }

  get warnings(): string[] {
    return this.currentFile?.warnings ?? [];
  }

  get metadataRows() {
    return this.parsed ? buildProtocolAnalyzerMetadataRows(this.parsed) : [];
  }

  get filteredDissectors(): ProtocolDissector[] {
    return this.parsed ? filterProtocolDissectors(this.parsed.dissectors, this.query) : [];
  }

  get selectedDissector(): ProtocolDissector | null {
    if (!this.selectedProtocol) return null;
    return this.filteredDissectors.find((d) => d.name === this.selectedProtocol) ?? null;
  }

  get dissectorMetadataRows() {
    return this.selectedDissector ? buildDissectorMetadata(this.selectedDissector) : [];
  }

  get filteredPackets(): PcapPacket[] {
    if (!this.parsed?.packets.length) return [];
    return filterProtocolPackets(this.parsed.packets, this.query, this.selectedDissector?.name ?? null);
  }

  get selectedPacket(): PcapPacket | null {
    return this.filteredPackets.find((p) => p.index === this.selectedPacketIndex) ?? this.filteredPackets[0] ?? null;
  }

  get primarySuggestion() {
    const s = resolveProtocolAnalyzerSuggestion({ hasFiles: this.files.length > 0, hasError: !!this.errorMessage });
    return !s || s.id === this.dismissedSuggestionId ? null : s;
  }

  protoColor(protocol: string): string {
    return protocolColor(protocol);
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
      if (this.viewMode === 'table') this.shiftPacket(1);
      else this.shiftDissector(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (this.viewMode === 'table') this.shiftPacket(-1);
      else this.shiftDissector(-1);
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      this.query = '';
      this.selectedProtocol = '';
      this.onFilterChange();
    }
  }

  trackByFileId(_i: number, file: ProtocolAnalyzerLoadedFile): string {
    return file.id;
  }

  trackByWarning(_i: number, warning: string): string {
    return warning;
  }

  trackByDissector(_i: number, dissector: ProtocolDissector): string {
    return dissector.name;
  }

  trackByPacket(_i: number, packet: PcapPacket): number {
    return packet.index;
  }

  formatSize(bytes: number): string {
    return formatProtocolAnalyzerFileSize(bytes);
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
    const { accepted, rejected } = filterValidProtocolAnalyzerFiles(files);
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
          const bytes = await readProtocolAnalyzerFileBytes(file);
          const record = createProtocolAnalyzerFileRecord(file, bytes);
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
          this.errorMessage = `${file.name}: ${error instanceof Error ? error.message : 'Invalid protocol trace'}`;
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
    await this.handleFiles([createSampleProtocolAnalyzerFile()]);
  }

  selectFile(index: number): void {
    if (index < 0 || index >= this.files.length || index === this.currentIndex) return;
    this.currentIndex = index;
    this.resetViewForCurrent();
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectDissector(name: string): void {
    this.selectedProtocol = name;
    const first = this.filteredPackets[0];
    if (first) this.selectedPacketIndex = first.index;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectPacket(index: number): void {
    this.selectedPacketIndex = index;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  onFilterChange(): void {
    const first = this.filteredDissectors[0];
    if (this.selectedProtocol && first && !this.filteredDissectors.some((d) => d.name === this.selectedProtocol)) {
      this.selectedProtocol = first.name;
    }
    const pkt = this.filteredPackets[0];
    if (pkt && !this.filteredPackets.some((p) => p.index === this.selectedPacketIndex)) this.selectedPacketIndex = pkt.index;
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
    this.selectedProtocol = '';
    this.selectedPacketIndex = 0;
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

  setViewMode(mode: ProtocolAnalyzerViewMode): void {
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

  exportAs(format: ProtocolAnalyzerExportFormat, event: Event): void {
    event.stopPropagation();
    this.showExportMenu = false;
    const file = this.currentFile;
    if (!file?.parsed) return;
    try {
      if (format === 'original') downloadBinaryFile(file.bytes, file.name, 'application/octet-stream');
      else if (format === 'summary-json') downloadTextFile(exportProtocolSummaryJson(file), `${file.name}.summary.json`, 'application/json');
      else if (format === 'dissectors-csv') downloadTextFile(exportProtocolDissectorsCsv(file.parsed), `${file.name}.dissectors.csv`, 'text/csv');
      else if (format === 'protocols-csv') {
        if (!file.parsed.packets.length) {
          downloadTextFile(exportProtocolDissectorsCsv(file.parsed), `${file.name}.protocols.csv`, 'text/csv');
        } else {
          downloadTextFile(exportProtocolPacketsCsv(file.parsed), `${file.name}.packets.csv`, 'text/csv');
        }
      } else if (format === 'png') {
        const canvas = this.canvasHost?.nativeElement;
        if (!canvas || (this.viewMode !== 'timeline' && this.viewMode !== 'protocols')) {
          this.toast.info('Open Timeline or Protocols to export a PNG snapshot');
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

  private shiftDissector(delta: number): void {
    const list = this.filteredDissectors;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((d) => d.name === this.selectedProtocol));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectDissector(next.name);
  }

  private shiftPacket(delta: number): void {
    const packets = this.filteredPackets;
    if (!packets.length) return;
    const idx = Math.max(0, packets.findIndex((p) => p.index === this.selectedPacketIndex));
    const next = packets[Math.min(packets.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectPacket(next.index);
  }

  private resetViewForCurrent(): void {
    this.query = '';
    this.selectedProtocol = this.parsed?.dissectors[0]?.name ?? '';
    this.selectedPacketIndex = this.parsed?.packets[0]?.index ?? 0;
  }

  private renderCanvas(): void {
    if (!this.isBrowser || (this.viewMode !== 'timeline' && this.viewMode !== 'protocols')) return;
    const canvas = this.canvasHost?.nativeElement;
    const parsed = this.parsed;
    if (!canvas || !parsed) return;
    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = Math.max(320, parent.clientWidth);
      canvas.height = Math.max(280, parent.clientHeight || 420);
    }
    if (this.viewMode === 'protocols') {
      renderProtocolBars(canvas, this.filteredDissectors);
      return;
    }
    renderProtocolTimeline(canvas, parsed.packets, this.selectedDissector?.name ?? null, this.selectedPacket?.index ?? null);
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
