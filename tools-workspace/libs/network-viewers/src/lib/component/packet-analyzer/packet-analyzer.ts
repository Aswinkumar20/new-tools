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
  PACKET_ANALYZER_ACCEPT_ATTR,
  PACKET_ANALYZER_FORMATS_HINT,
  PACKET_ANALYZER_FORMATS_LABEL,
  PACKET_ANALYZER_RELATED_TOOLS,
  PACKET_ANALYZER_SUPPORTED_EXTENSIONS
} from '../../constants/packet-analyzer.constants';
import type {
  PacketAnalyzerExportFormat,
  PacketAnalyzerLoadedFile,
  PacketAnalyzerPacket,
  PacketAnalyzerViewMode,
  PacketLayer
} from '../../types/packet-analyzer.types';
import {
  buildLayerMetadata,
  buildPacketAnalyzerMetadataRows,
  buildSelectedPacketMetadata,
  canExportPacketAnalyzer,
  canvasToPngDataUrl,
  createPacketAnalyzerFileRecord,
  createSamplePacketAnalyzerFile,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  exportPacketAnalyzerCsv,
  exportPacketAnalyzerSummaryJson,
  exportPacketDecodeJson,
  filterAnalyzerPackets,
  filterValidPacketAnalyzerFiles,
  formatPacketAnalyzerFileSize,
  hexForSelectedLayer,
  layerColor,
  protocolColor,
  readPacketAnalyzerFileBytes,
  renderPacketLayers,
  resolvePacketAnalyzerSuggestion
} from '../../utils/packet-analyzer.utils';

@Component({
  selector: 'lib-packet-analyzer',
  standalone: true,
  templateUrl: './packet-analyzer.html',
  styleUrls: ['./packet-analyzer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PacketAnalyzerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('canvasHost') canvasHost?: ElementRef<HTMLCanvasElement>;
  @ViewChild('mapWrap') mapWrap?: ElementRef<HTMLElement>;
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  readonly acceptAttr = PACKET_ANALYZER_ACCEPT_ATTR;
  readonly relatedTools = PACKET_ANALYZER_RELATED_TOOLS;
  readonly supportedExtensions = PACKET_ANALYZER_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = PACKET_ANALYZER_FORMATS_LABEL;
  readonly formatsHint = PACKET_ANALYZER_FORMATS_HINT;
  readonly viewModes: Array<{ id: PacketAnalyzerViewMode; label: string }> = [
    { id: 'decode', label: 'Decode' },
    { id: 'hex', label: 'Hex' },
    { id: 'layers', label: 'Layers' },
    { id: 'table', label: 'Table' }
  ];

  files: PacketAnalyzerLoadedFile[] = [];
  currentIndex = -1;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;
  viewMode: PacketAnalyzerViewMode = 'decode';
  query = '';
  selectedPacketIndex = 0;
  selectedLayerId = '';

  private dragDepth = 0;
  private resizeObserver: ResizeObserver | null = null;

  get currentFile(): PacketAnalyzerLoadedFile | null {
    return this.currentIndex >= 0 ? this.files[this.currentIndex] ?? null : null;
  }

  get parsed() {
    return this.currentFile?.parsed ?? null;
  }

  get canExport(): boolean {
    return canExportPacketAnalyzer(this.currentFile);
  }

  get warnings(): string[] {
    return this.currentFile?.warnings ?? [];
  }

  get metadataRows() {
    return this.parsed ? buildPacketAnalyzerMetadataRows(this.parsed) : [];
  }

  get filteredPackets(): PacketAnalyzerPacket[] {
    return this.parsed ? filterAnalyzerPackets(this.parsed.packets, this.query) : [];
  }

  get selectedPacket(): PacketAnalyzerPacket | null {
    return this.filteredPackets.find((p) => p.index === this.selectedPacketIndex) ?? this.filteredPackets[0] ?? null;
  }

  get layers(): PacketLayer[] {
    return this.selectedPacket?.layers ?? [];
  }

  get selectedLayer(): PacketLayer | null {
    return this.layers.find((l) => l.id === this.selectedLayerId) ?? this.layers[0] ?? null;
  }

  get packetMetadataRows() {
    return this.selectedPacket ? buildSelectedPacketMetadata(this.selectedPacket) : [];
  }

  get layerMetadataRows() {
    return this.selectedLayer ? buildLayerMetadata(this.selectedLayer) : [];
  }

  get hexDump(): string {
    return hexForSelectedLayer(this.selectedPacket, this.viewMode === 'hex' ? null : this.selectedLayer);
  }

  get primarySuggestion() {
    const s = resolvePacketAnalyzerSuggestion({ hasFiles: this.files.length > 0, hasError: !!this.errorMessage });
    return !s || s.id === this.dismissedSuggestionId ? null : s;
  }

  protoColor(protocol: string): string {
    return protocolColor(protocol);
  }

  layerTint(name: string): string {
    return layerColor(name);
  }

  layerNames(packet: PacketAnalyzerPacket): string {
    return packet.layers.map((l) => l.name).join(' / ');
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
      this.shiftPacket(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.shiftPacket(-1);
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      this.shiftLayer(event.key === 'ArrowRight' ? 1 : -1);
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      this.query = '';
      this.onFilterChange();
    } else if (event.key.toLowerCase() === 'i') {
      event.preventDefault();
      this.shiftLayer(1);
    }
  }

  trackByFileId(_i: number, file: PacketAnalyzerLoadedFile): string {
    return file.id;
  }

  trackByWarning(_i: number, warning: string): string {
    return warning;
  }

  trackByPacket(_i: number, packet: PacketAnalyzerPacket): number {
    return packet.index;
  }

  trackByLayer(_i: number, layer: PacketLayer): string {
    return layer.id;
  }

  formatSize(bytes: number): string {
    return formatPacketAnalyzerFileSize(bytes);
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
    const { accepted, rejected } = filterValidPacketAnalyzerFiles(files);
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
          const bytes = await readPacketAnalyzerFileBytes(file);
          const record = createPacketAnalyzerFileRecord(file, bytes);
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
          this.errorMessage = `${file.name}: ${error instanceof Error ? error.message : 'Invalid packet data'}`;
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
    await this.handleFiles([createSamplePacketAnalyzerFile()]);
  }

  selectFile(index: number): void {
    if (index < 0 || index >= this.files.length || index === this.currentIndex) return;
    this.currentIndex = index;
    this.resetViewForCurrent();
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectPacket(index: number): void {
    this.selectedPacketIndex = index;
    this.selectedLayerId = this.filteredPackets.find((p) => p.index === index)?.layers[0]?.id ?? '';
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectLayer(id: string): void {
    this.selectedLayerId = id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  onFilterChange(): void {
    const first = this.filteredPackets[0];
    if (first && !this.filteredPackets.some((p) => p.index === this.selectedPacketIndex)) {
      this.selectedPacketIndex = first.index;
      this.selectedLayerId = first.layers[0]?.id ?? '';
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
    this.selectedPacketIndex = 0;
    this.selectedLayerId = '';
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

  setViewMode(mode: PacketAnalyzerViewMode): void {
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

  exportAs(format: PacketAnalyzerExportFormat, event: Event): void {
    event.stopPropagation();
    this.showExportMenu = false;
    const file = this.currentFile;
    if (!file?.parsed) return;
    try {
      if (format === 'original') downloadBinaryFile(file.bytes, file.name, 'application/octet-stream');
      else if (format === 'summary-json') downloadTextFile(exportPacketAnalyzerSummaryJson(file), `${file.name}.summary.json`, 'application/json');
      else if (format === 'decode-json') downloadTextFile(exportPacketDecodeJson(file, this.selectedPacket), `${file.name}.decode.json`, 'application/json');
      else if (format === 'packets-csv') downloadTextFile(exportPacketAnalyzerCsv(file.parsed), `${file.name}.packets.csv`, 'text/csv');
      else if (format === 'png') {
        const canvas = this.canvasHost?.nativeElement;
        if (!canvas || this.viewMode !== 'layers') {
          this.toast.info('Open Layers to export a PNG snapshot');
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

  private shiftPacket(delta: number): void {
    const packets = this.filteredPackets;
    if (!packets.length) return;
    const idx = Math.max(0, packets.findIndex((p) => p.index === this.selectedPacketIndex));
    const next = packets[Math.min(packets.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectPacket(next.index);
  }

  private shiftLayer(delta: number): void {
    if (!this.layers.length) return;
    const idx = Math.max(0, this.layers.findIndex((l) => l.id === this.selectedLayerId));
    const next = this.layers[Math.min(this.layers.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectLayer(next.id);
  }

  private resetViewForCurrent(): void {
    this.query = '';
    this.selectedPacketIndex = this.parsed?.packets[0]?.index ?? 0;
    this.selectedLayerId = this.parsed?.packets[0]?.layers[0]?.id ?? '';
  }

  private renderCanvas(): void {
    if (!this.isBrowser || this.viewMode !== 'layers') return;
    const canvas = this.canvasHost?.nativeElement;
    if (!canvas || !this.selectedPacket) return;
    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = Math.max(320, parent.clientWidth);
      canvas.height = Math.max(280, parent.clientHeight || 420);
    }
    renderPacketLayers(canvas, this.selectedPacket.layers, this.selectedLayer?.id ?? null);
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
