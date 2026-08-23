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
import { RouterLink } from '@angular/router';
import {
  AssetService,
  Navigation,
  ToastService,
  TooltipDirective
} from '@tools-workspace/features-home';
import {
  ECG_ACCEPT_ATTR,
  ECG_FORMATS_HINT,
  ECG_FORMATS_LABEL,
  ECG_PAPER_SPEED_PRESETS,
  ECG_RELATED_TOOLS,
  ECG_STANDARD_LEADS,
  ECG_SUPPORTED_EXTENSIONS
} from '../../constants/ecg-viewer.constants';
import type {
  EcgCaliperMark,
  EcgExportFormat,
  EcgInteractionMode,
  EcgLoadedRecording
} from '../../types/ecg-viewer.types';
import type { WaveformChannel, WaveformViewport } from '../../types/waveform.types';
import { canvasToPngDataUrl } from '../../utils/medical-image-render.utils';
import { computeCaliper } from '../../utils/waveform-parse.utils';
import {
  defaultWindowSamples,
  drawWaveformCanvas,
  maxStartSample
} from '../../utils/waveform-render.utils';
import {
  canExportEcg,
  createCaliperId,
  createEcgRecording,
  createSampleEcgFile,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  estimateHeartRateBpm,
  exportEcgCalipersJson,
  exportEcgSummaryJson,
  filterValidEcgFiles,
  formatWaveformFileSize,
  readWaveformFileBytes,
  resolveEcgSuggestion,
  sortEcgChannels
} from '../../utils/ecg-viewer.utils';
import {
  clipboardFiles,
  clipboardText,
  fileFromPastedText,
  looksLikeWaveformText
} from '../../utils/clinical-document.utils';

import {
  applyMedicalFullscreenToggle,
  isDocumentFullscreen,
  listenFullscreenChange
} from '../../utils/medical-fullscreen.utils';

@Component({
  selector: 'lib-ecg-viewer',
  standalone: true,
  templateUrl: './ecg-viewer.html',
  styleUrls: ['./ecg-viewer.scss'],
  imports: [CommonModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EcgViewerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly hostEl = inject(ElementRef<HTMLElement>);
  private unlistenFullscreen: (() => void) | null = null;

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('canvasHost') canvasHost!: ElementRef<HTMLCanvasElement>;

  readonly acceptAttr = ECG_ACCEPT_ATTR;
  readonly relatedTools = ECG_RELATED_TOOLS;
  readonly supportedExtensions = ECG_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = ECG_FORMATS_LABEL;
  readonly formatsHint = ECG_FORMATS_HINT;
  readonly standardLeads = ECG_STANDARD_LEADS;
  readonly paperSpeedPresets = ECG_PAPER_SPEED_PRESETS;
  readonly interactionModes: ReadonlyArray<{ id: EcgInteractionMode; label: string }> = [
    { id: 'navigate', label: 'Navigate' },
    { id: 'caliper', label: 'Calipers' }
  ];

  recordings: EcgLoadedRecording[] = [];
  currentIndex = -1;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  isFullscreen = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;

  interactionMode: EcgInteractionMode = 'navigate';
  visibleLeadIds = new Set<string>();
  gain = 28;
  pixelsPerSecond = 120;
  startSample = 0;
  windowSamples = 2500;

  calipers: EcgCaliperMark[] = [];
  private caliperDraft: { x: number; y: number } | null = null;
  private activeCaliper: WaveformCaliperPartial | null = null;

  private dragDepth = 0;
  private resizeObserver: ResizeObserver | null = null;

  get currentRecording(): EcgLoadedRecording | null {
    return this.currentIndex >= 0 ? this.recordings[this.currentIndex] ?? null : null;
  }

  get canExport(): boolean {
    return canExportEcg(this.currentRecording);
  }

  get warnings(): string[] {
    return this.currentRecording?.warnings ?? [];
  }

  get primarySuggestion() {
    const suggestion = resolveEcgSuggestion({
      hasRecordings: this.recordings.length > 0,
      hasError: !!this.errorMessage
    });
    if (!suggestion || suggestion.id === this.dismissedSuggestionId) return null;
    return suggestion;
  }

  get visibleChannels(): WaveformChannel[] {
    const rec = this.currentRecording;
    if (!rec) return [];
    const ids = sortEcgChannels(rec.waveform.channels.map((c) => c.id)).filter((id) =>
      this.visibleLeadIds.has(id)
    );
    return ids
      .map((id) => rec.waveform.channels.find((c) => c.id === id))
      .filter((c): c is WaveformChannel => !!c);
  }

  get durationLabel(): string {
    const rec = this.currentRecording;
    if (!rec) return '';
    const startSec = this.startSample / rec.waveform.sampleRateHz;
    const endSec = Math.min(
      rec.waveform.durationSec,
      (this.startSample + this.windowSamples) / rec.waveform.sampleRateHz
    );
    return `${startSec.toFixed(2)}–${endSec.toFixed(2)} s · ${rec.waveform.sampleRateHz} Hz`;
  }

  get maxScrollSample(): number {
    const rec = this.currentRecording;
    if (!rec) return 0;
    const total = rec.waveform.channels[0]?.samples.length ?? 0;
    return maxStartSample(total, this.windowSamples);
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;
    this.observeCanvasResize();
    this.unlistenFullscreen = listenFullscreenChange(() => {
      if (!isDocumentFullscreen() && this.isFullscreen) {
        this.isFullscreen = false;
        this.cdr.markForCheck();
      }
    });
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.unlistenFullscreen?.();
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
    if (!this.currentRecording || this.isTypingTarget(event.target)) return;

    if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      this.adjustGain(4);
    } else if (event.key === '-' || event.key === '_') {
      event.preventDefault();
      this.adjustGain(-4);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.scrollBy(-Math.floor(this.windowSamples * 0.1));
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.scrollBy(Math.floor(this.windowSamples * 0.1));
    } else if (event.key.toLowerCase() === 'c') {
      event.preventDefault();
      this.setInteractionMode(this.interactionMode === 'caliper' ? 'navigate' : 'caliper');
    } else if (event.key === 'Escape' && this.isFullscreen) {
      event.preventDefault();
      this.toggleFullscreen();
    }
  }

  @HostListener('window:paste', ['$event'])
  async onWindowPaste(event: ClipboardEvent): Promise<void> {
    if (this.isTypingTarget(event.target)) return;
    const files = clipboardFiles(event);
    if (files.length) {
      event.preventDefault();
      await this.handleFiles(files);
      return;
    }
    const text = clipboardText(event);
    if (!looksLikeWaveformText(text)) return;
    const file = fileFromPastedText(
      text,
      text.trim().startsWith('{') ? 'pasted-ecg.json' : 'pasted-ecg.csv',
      text.trim().startsWith('{') ? 'application/json' : 'text/csv'
    );
    if (!file) return;
    event.preventDefault();
    await this.handleFiles([file]);
  }

  trackByRecordingId(_index: number, rec: EcgLoadedRecording): string {
    return rec.id;
  }

  trackByLeadId(_index: number, ch: { id: string }): string {
    return ch.id;
  }

  trackByCaliperId(_index: number, cal: EcgCaliperMark): string {
    return cal.id;
  }

  trackByWarning(_index: number, warning: string): string {
    return warning;
  }

  formatSize(bytes: number): string {
    return formatWaveformFileSize(bytes);
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
    const { accepted, rejected } = filterValidEcgFiles(files);
    for (const item of rejected) this.toast.error(`${item.name}: ${item.reason}`);
    if (!accepted.length) {
      this.cdr.markForCheck();
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.cdr.markForCheck();

    try {
      const loaded: EcgLoadedRecording[] = [];
      for (const file of accepted) {
        try {
          const bytes = await readWaveformFileBytes(file);
          loaded.push(createEcgRecording(file, bytes));
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Invalid ECG waveform';
          this.errorMessage = `${file.name}: ${message}`;
          this.toast.error(this.errorMessage);
        }
      }

      if (loaded.length) {
        const merged = [...this.recordings, ...loaded];
        const byId = new Map<string, EcgLoadedRecording>();
        for (const item of merged) byId.set(item.id, item);
        this.recordings = Array.from(byId.values());
        this.currentIndex = Math.min(
          Math.max(0, this.recordings.length - loaded.length),
          this.recordings.length - 1
        );
        this.resetViewportForCurrent();
        this.renderCanvas();
        const current = this.currentRecording;
        if (current) {
          this.toast.success(`Loaded ${current.name}`);
          if (current.warnings.length) {
            this.toast.info(`${current.warnings.length} note(s) about this recording`);
          }
        }
      }
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Failed to load ECG';
      this.toast.error(this.errorMessage);
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async loadSample(): Promise<void> {
    await this.handleFiles([createSampleEcgFile()]);
  }

  selectRecording(index: number): void {
    if (index < 0 || index >= this.recordings.length || index === this.currentIndex) return;
    this.currentIndex = index;
    this.calipers = [];
    this.caliperDraft = null;
    this.activeCaliper = null;
    this.resetViewportForCurrent();
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  removeRecording(index: number, event: Event): void {
    event.stopPropagation();
    if (index < 0 || index >= this.recordings.length) return;
    const next = this.recordings.filter((_, i) => i !== index);
    this.recordings = next;
    if (!next.length) {
      this.clearAll();
      return;
    }
    if (this.currentIndex >= next.length) this.currentIndex = next.length - 1;
    else if (index < this.currentIndex) this.currentIndex -= 1;
    this.resetViewportForCurrent();
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  clearAll(): void {
    this.recordings = [];
    this.currentIndex = -1;
    this.errorMessage = '';
    this.calipers = [];
    this.caliperDraft = null;
    this.activeCaliper = null;
    this.clearCanvas();
    this.cdr.markForCheck();
  }

  dismissSuggestion(id: string): void {
    this.dismissedSuggestionId = id;
    this.cdr.markForCheck();
  }

  applySuggestion(suggestion: { id: string }): void {
    if (suggestion.id === 'try-sample') void this.loadSample();
    else if (suggestion.id === 'upload') this.openFilePicker();
  }

  setInteractionMode(mode: EcgInteractionMode): void {
    this.interactionMode = mode;
    this.caliperDraft = null;
    this.activeCaliper = null;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  toggleLead(id: string): void {
    if (this.visibleLeadIds.has(id)) {
      if (this.visibleLeadIds.size <= 1) {
        this.toast.info('At least one lead must remain visible');
        return;
      }
      this.visibleLeadIds.delete(id);
    } else {
      this.visibleLeadIds.add(id);
    }
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  isLeadVisible(id: string): boolean {
    return this.visibleLeadIds.has(id);
  }

  showAllLeads(): void {
    const rec = this.currentRecording;
    if (!rec) return;
    this.visibleLeadIds = new Set(rec.waveform.channels.map((c) => c.id));
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  deleteCaliper(id: string): void {
    this.calipers = this.calipers.filter((c) => c.id !== id);
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  onGainChange(event: Event): void {
    this.gain = Number((event.target as HTMLInputElement).value);
    this.renderCanvas();
  }

  onSpeedChange(event: Event): void {
    this.pixelsPerSecond = Number((event.target as HTMLInputElement).value);
    this.renderCanvas();
  }

  setPaperSpeed(pixelsPerSecond: number): void {
    this.pixelsPerSecond = pixelsPerSecond;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  onScrollChange(event: Event): void {
    this.startSample = Number((event.target as HTMLInputElement).value);
    this.renderCanvas();
  }

  onWindowChange(event: Event): void {
    const rec = this.currentRecording;
    if (!rec) return;
    this.windowSamples = Number((event.target as HTMLInputElement).value);
    const total = rec.waveform.channels[0]?.samples.length ?? 0;
    this.startSample = Math.min(this.startSample, maxStartSample(total, this.windowSamples));
    this.renderCanvas();
  }

  toggleSidebar(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;
    this.cdr.markForCheck();
    setTimeout(() => this.renderCanvas(), 220);
  }

  toggleExportMenu(event: Event): void {
    event.stopPropagation();
    this.showExportMenu = !this.showExportMenu;
    this.cdr.markForCheck();
  }

  exportAs(format: EcgExportFormat, event?: Event): void {
    event?.stopPropagation();
    this.showExportMenu = false;
    const current = this.currentRecording;
    if (!current) {
      this.toast.error('Nothing to export');
      return;
    }
    const base = current.name.replace(/\.[^.]+$/, '') || 'ecg-recording';
    try {
      if (format === 'original') {
        downloadBinaryFile(current.bytes, current.name, 'application/octet-stream');
        this.toast.success('Exported original file');
      } else if (format === 'summary-json') {
        downloadTextFile(
          exportEcgSummaryJson(current, this.calipers.length),
          `${base}-summary.json`,
          'application/json'
        );
        this.toast.success('Exported summary JSON');
      } else if (format === 'calipers-json') {
        downloadTextFile(
          exportEcgCalipersJson(current, this.calipers),
          `${base}-calipers.json`,
          'application/json'
        );
        this.toast.success('Exported calipers JSON');
      } else if (format === 'png') {
        const canvas = this.canvasHost?.nativeElement;
        const url = canvas ? canvasToPngDataUrl(canvas) : null;
        if (!url) this.toast.error('PNG snapshot unavailable');
        else {
          downloadDataUrl(url, `${base}-snapshot.png`);
          this.toast.success('Exported PNG snapshot');
        }
      }
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'Export failed');
    }
    this.cdr.markForCheck();
  }

  async toggleFullscreen(): Promise<void> {
    if (!this.isBrowser) {
      this.isFullscreen = !this.isFullscreen;
      this.cdr.markForCheck();
      return;
    }
    const result = await applyMedicalFullscreenToggle(this.hostEl.nativeElement, this.isFullscreen);
    this.isFullscreen = result.active;
    this.cdr.markForCheck();
    setTimeout(() => this.renderCanvas(), 80);
  }

  adjustGain(delta: number): void {
    this.gain = Math.max(8, Math.min(80, this.gain + delta));
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  scrollBy(delta: number): void {
    this.startSample = Math.max(0, Math.min(this.maxScrollSample, this.startSample + delta));
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  heartRateLabel(caliper: EcgCaliperMark): string {
    const bpm = estimateHeartRateBpm(caliper.deltaTimeMs);
    return bpm ? `~${bpm} bpm` : '';
  }

  onCanvasClick(event: MouseEvent): void {
    if (this.interactionMode !== 'caliper') return;
    const canvas = this.canvasHost?.nativeElement;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    if (!this.caliperDraft) {
      this.caliperDraft = { x, y };
      this.activeCaliper = { x1: x, y1: y, x2: x, y2: y, deltaTimeMs: 0, deltaAmplitude: 0 };
    } else {
      const { deltaTimeMs, deltaAmplitude } = computeCaliper(
        this.caliperDraft.x,
        this.caliperDraft.y,
        x,
        y,
        this.pixelsPerSecond,
        this.gain
      );
      const count = this.calipers.length + 1;
      this.calipers = [
        ...this.calipers,
        {
          id: createCaliperId(),
          label: `Caliper ${count}`,
          x1: this.caliperDraft.x,
          y1: this.caliperDraft.y,
          x2: x,
          y2: y,
          deltaTimeMs,
          deltaAmplitude
        }
      ];
      this.caliperDraft = null;
      this.activeCaliper = null;
      this.toast.success(`Caliper: ${deltaTimeMs.toFixed(1)} ms`);
    }
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  onCanvasMouseMove(event: MouseEvent): void {
    if (this.interactionMode !== 'caliper' || !this.caliperDraft) return;
    const canvas = this.canvasHost?.nativeElement;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const { deltaTimeMs, deltaAmplitude } = computeCaliper(
      this.caliperDraft.x,
      this.caliperDraft.y,
      x,
      y,
      this.pixelsPerSecond,
      this.gain
    );
    this.activeCaliper = {
      x1: this.caliperDraft.x,
      y1: this.caliperDraft.y,
      x2: x,
      y2: y,
      deltaTimeMs,
      deltaAmplitude
    };
    this.renderCanvas();
  }

  private resetViewportForCurrent(): void {
    const rec = this.currentRecording;
    if (!rec) return;
    this.visibleLeadIds = new Set(rec.waveform.channels.map((c) => c.id));
    const total = rec.waveform.channels[0]?.samples.length ?? 0;
    const canvas = this.canvasHost?.nativeElement;
    const width = Math.max(320, Math.floor(canvas?.parentElement?.getBoundingClientRect().width ?? 800));
    this.windowSamples = defaultWindowSamples(total, rec.waveform.sampleRateHz, width);
    this.startSample = 0;
    this.calipers = [];
    this.caliperDraft = null;
    this.activeCaliper = null;
  }

  private viewport(): WaveformViewport {
    return {
      startSample: this.startSample,
      windowSamples: this.windowSamples,
      gain: this.gain,
      pixelsPerSecond: this.pixelsPerSecond
    };
  }

  private renderCanvas(): void {
    if (!this.isBrowser) return;
    const canvas = this.canvasHost?.nativeElement;
    if (!canvas) return;

    const rect = canvas.parentElement?.getBoundingClientRect();
    const width = Math.max(320, Math.floor(rect?.width ?? 800));
    const channels = this.visibleChannels;
    const channelHeight = 56;
    const height = Math.max(240, channels.length * channelHeight + 16);
    canvas.width = width;
    canvas.height = height;

    const caliperOverlay =
      this.activeCaliper ??
      (this.calipers.length ? this.calipers[this.calipers.length - 1] : null);

    drawWaveformCanvas(canvas, {
      channels,
      viewport: this.viewport(),
      grid: true,
      caliper: this.interactionMode === 'caliper' ? caliperOverlay : null,
      channelHeight,
      traceColor: '#34d399'
    });
    this.cdr.markForCheck();
  }

  private clearCanvas(): void {
    const canvas = this.canvasHost?.nativeElement;
    if (!canvas || typeof canvas.getContext !== 'function') return;
    if (typeof process !== 'undefined' && process.env['JEST_WORKER_ID']) return;
    drawWaveformCanvas(canvas, {
      channels: [],
      viewport: { startSample: 0, windowSamples: 100, gain: 1, pixelsPerSecond: 100 }
    });
  }

  private observeCanvasResize(): void {
    const host = this.canvasHost?.nativeElement?.parentElement;
    if (!host || typeof ResizeObserver === 'undefined') return;
    this.resizeObserver = new ResizeObserver(() => this.renderCanvas());
    this.resizeObserver.observe(host);
  }

  private isTypingTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
  }

  private isFileDrag(event: DragEvent): boolean {
    const types = event.dataTransfer?.types;
    if (!types) return false;
    return Array.from(types).includes('Files');
  }
}

type WaveformCaliperPartial = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  deltaTimeMs: number;
  deltaAmplitude: number;
};
