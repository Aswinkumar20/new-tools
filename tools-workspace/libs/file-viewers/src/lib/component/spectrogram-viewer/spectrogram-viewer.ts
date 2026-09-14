import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  ViewChild,
  inject
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AssetService, Navigation, ToastService, TooltipDirective } from '@tools-workspace/features-home';
import type { FvRelatedToolLink } from '../../shared/fv-tool-suggestion.model';
import type { FvToolSuggestion } from '../../shared/fv-tool-suggestion.model';
import {
  SPECTROGRAM_ACCEPT_ATTR,
  SPECTROGRAM_DESCRIPTION,
  SPECTROGRAM_FORMATS_LABEL,
  SPECTROGRAM_HELP_ITEMS,
  SPECTROGRAM_RELATED_TOOLS,
  SPECTROGRAM_VIEWER_TITLE
} from '../../constants/spectrogram-viewer.constants';
import {
  computeOfflineSpectrogram,
  decodeAudioFile,
  drawSpectrogramCanvas,
  formatAudioDuration,
  isAudioAnalysisFile,
  type SpectrogramData
} from '../../utils/fv-audio-analysis.utils';

@Component({
  selector: 'lib-spectrogram-viewer',
  standalone: true,
  templateUrl: './spectrogram-viewer.html',
  styleUrls: ['./spectrogram-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SpectrogramViewerComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('spectrogramCanvas') spectrogramCanvas!: ElementRef<HTMLCanvasElement>;

  readonly title = SPECTROGRAM_VIEWER_TITLE;
  readonly description = SPECTROGRAM_DESCRIPTION;
  readonly acceptAttr = SPECTROGRAM_ACCEPT_ATTR;
  readonly formatsLabel = SPECTROGRAM_FORMATS_LABEL;
  readonly helpItems = SPECTROGRAM_HELP_ITEMS;
  readonly relatedTools: ReadonlyArray<FvRelatedToolLink> = SPECTROGRAM_RELATED_TOOLS;

  fileName = '';
  fileSize = 0;
  duration = 0;
  spectrogramData: SpectrogramData | null = null;
  loading = false;
  computing = false;
  computeProgress = 0;
  zoomStart = 0;
  zoomEnd = 100;
  errorMessage = '';
  showDropZone = false;
  dismissedSuggestionId: string | null = null;

  private computeProgressTimer: ReturnType<typeof setInterval> | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private readonly preventDefaultsFn = (e: Event) => this.preventDefaults(e);

  get primarySuggestion(): FvToolSuggestion | null {
    let suggestion: FvToolSuggestion | null = null;

    if (this.errorMessage) {
      suggestion = {
        id: 'sgv-spectrum',
        title: 'Try live spectrum analysis?',
        reason: 'WAV Spectrum Viewer shows waveform and real-time FFT while playing.',
        actionLabel: 'Open WAV Spectrum Viewer',
        path: '/file-viewers/wav-spectrum-viewer'
      };
    } else if (this.spectrogramData) {
      suggestion = {
        id: 'sgv-trim',
        title: 'Trim a segment?',
        reason: 'Audio Trimmer can export a focused clip after you inspect the spectrogram.',
        actionLabel: 'Open Audio Trimmer',
        path: '/media-tools/audio-trimmer'
      };
    } else {
      suggestion = {
        id: 'sgv-intro',
        title: 'Upload audio to begin',
        reason: 'Drop an audio file to compute an offline STFT spectrogram with zoom.',
        actionLabel: 'Open WAV Spectrum Viewer',
        path: '/file-viewers/wav-spectrum-viewer'
      };
    }

    if (!suggestion || this.dismissedSuggestionId === suggestion.id) {
      return null;
    }
    return suggestion;
  }

  get columnCount(): number {
    return this.spectrogramData?.columns.length ?? 0;
  }

  get zoomStartRatio(): number {
    return this.zoomStart / 100;
  }

  get zoomEndRatio(): number {
    return this.zoomEnd / 100;
  }

  ngOnInit(): void {
    this.setupDragAndDrop();
  }

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.setupResizeObserver();
    }
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId = suggestionId;
    this.cdr.markForCheck();
  }

  setupDragAndDrop(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    for (const eventName of ['dragenter', 'dragover', 'dragleave', 'drop']) {
      document.addEventListener(eventName, this.preventDefaultsFn, false);
      document.body.addEventListener(eventName, this.preventDefaultsFn, false);
    }
  }

  preventDefaults(e: Event): void {
    e.preventDefault();
    e.stopPropagation();
  }

  @HostListener('dragenter', ['$event'])
  onDragEnter(e: DragEvent): void {
    if (e.dataTransfer?.types.includes('Files')) {
      this.showDropZone = true;
      this.cdr.markForCheck();
    }
  }

  @HostListener('dragleave', ['$event'])
  onDragLeave(e: DragEvent): void {
    const currentTarget = e.currentTarget as HTMLElement | null;
    const relatedTarget = e.relatedTarget as Node | null;
    if (currentTarget && relatedTarget && !currentTarget.contains(relatedTarget)) {
      this.showDropZone = false;
      this.cdr.markForCheck();
    }
  }

  @HostListener('drop', ['$event'])
  onDrop(e: DragEvent): void {
    this.preventDefaults(e);
    this.showDropZone = false;
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      void this.handleFiles(Array.from(files));
    }
    this.cdr.markForCheck();
  }

  openFileDialog(): void {
    this.fileInput?.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      void this.handleFiles(Array.from(input.files));
      input.value = '';
    }
  }

  async handleFiles(files: File[]): Promise<void> {
    const validFiles = files.filter(isAudioAnalysisFile);

    if (validFiles.length === 0) {
      this.errorMessage = 'Please select a supported audio file.';
      this.dismissedSuggestionId = null;
      this.toast.error('No supported audio files found');
      this.cdr.markForCheck();
      return;
    }

    await this.loadAudioFile(validFiles[0]!);
  }

  async loadAudioFile(file: File): Promise<void> {
    this.loading = true;
    this.computing = true;
    this.computeProgress = 0;
    this.errorMessage = '';
    this.dismissedSuggestionId = null;
    this.spectrogramData = null;
    this.zoomStart = 0;
    this.zoomEnd = 100;
    this.cdr.markForCheck();

    this.startComputeProgress();

    try {
      const buffer = await decodeAudioFile(file);
      this.duration = buffer.duration;
      this.fileName = file.name;
      this.fileSize = file.size;

      await new Promise<void>((resolve) => {
        setTimeout(() => {
          this.spectrogramData = computeOfflineSpectrogram(buffer);
          resolve();
        }, 0);
      });

      this.computeProgress = 100;
      this.cdr.markForCheck();
      requestAnimationFrame(() => this.redrawSpectrogram());
    } catch (error) {
      this.errorMessage = `Failed to compute spectrogram: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.toast.error('Failed to compute spectrogram');
    } finally {
      this.stopComputeProgress();
      this.loading = false;
      this.computing = false;
      this.cdr.markForCheck();
    }
  }

  onZoomChange(): void {
    if (this.zoomStart >= this.zoomEnd) {
      this.zoomEnd = Math.min(100, this.zoomStart + 1);
    }
    this.redrawSpectrogram();
    this.cdr.markForCheck();
  }

  clearAll(): void {
    this.spectrogramData = null;
    this.fileName = '';
    this.fileSize = 0;
    this.duration = 0;
    this.zoomStart = 0;
    this.zoomEnd = 100;
    this.errorMessage = '';
    this.dismissedSuggestionId = null;
    this.toast.info('Spectrogram cleared');
    this.cdr.markForCheck();
  }

  formatTime(seconds: number): string {
    return formatAudioDuration(seconds);
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  private redrawSpectrogram(): void {
    if (!this.spectrogramCanvas?.nativeElement || !this.spectrogramData) {
      return;
    }

    drawSpectrogramCanvas(
      this.spectrogramCanvas.nativeElement,
      this.spectrogramData,
      this.zoomStartRatio,
      this.zoomEndRatio
    );
  }

  private startComputeProgress(): void {
    this.stopComputeProgress();
    this.computeProgressTimer = setInterval(() => {
      if (this.computeProgress < 90) {
        this.computeProgress = Math.min(90, this.computeProgress + 5);
        this.cdr.markForCheck();
      }
    }, 120);
  }

  private stopComputeProgress(): void {
    if (this.computeProgressTimer !== null) {
      clearInterval(this.computeProgressTimer);
      this.computeProgressTimer = null;
    }
  }

  private setupResizeObserver(): void {
    if (!this.spectrogramCanvas?.nativeElement || typeof ResizeObserver === 'undefined') {
      return;
    }

    this.resizeObserver = new ResizeObserver(() => this.redrawSpectrogram());
    this.resizeObserver.observe(this.spectrogramCanvas.nativeElement);
  }

  private cleanup(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    this.stopComputeProgress();
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;

    for (const eventName of ['dragenter', 'dragover', 'dragleave', 'drop']) {
      document.removeEventListener(eventName, this.preventDefaultsFn, false);
      document.body.removeEventListener(eventName, this.preventDefaultsFn, false);
    }
  }
}
