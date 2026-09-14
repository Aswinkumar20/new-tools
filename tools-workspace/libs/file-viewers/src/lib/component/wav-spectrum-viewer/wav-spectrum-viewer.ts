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
  WAV_SPECTRUM_ACCEPT_ATTR,
  WAV_SPECTRUM_FORMATS_LABEL,
  WAV_SPECTRUM_FFT_SIZE,
  WAV_SPECTRUM_HELP_ITEMS,
  WAV_SPECTRUM_RELATED_TOOLS,
  WAV_SPECTRUM_TITLE,
  WAV_SPECTRUM_DESCRIPTION
} from '../../constants/wav-spectrum-viewer.constants';
import {
  computeWaveformPeaks,
  decodeAudioFile,
  drawSpectrumCanvas,
  drawWaveformCanvas,
  formatAudioDuration,
  isAudioAnalysisFile
} from '../../utils/fv-audio-analysis.utils';

@Component({
  selector: 'lib-wav-spectrum-viewer',
  standalone: true,
  templateUrl: './wav-spectrum-viewer.html',
  styleUrls: ['./wav-spectrum-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WavSpectrumViewerComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('audioElement') audioElement!: ElementRef<HTMLAudioElement>;
  @ViewChild('waveformCanvas') waveformCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('spectrumCanvas') spectrumCanvas!: ElementRef<HTMLCanvasElement>;

  readonly title = WAV_SPECTRUM_TITLE;
  readonly description = WAV_SPECTRUM_DESCRIPTION;
  readonly acceptAttr = WAV_SPECTRUM_ACCEPT_ATTR;
  readonly formatsLabel = WAV_SPECTRUM_FORMATS_LABEL;
  readonly helpItems = WAV_SPECTRUM_HELP_ITEMS;
  readonly relatedTools: ReadonlyArray<FvRelatedToolLink> = WAV_SPECTRUM_RELATED_TOOLS;
  readonly fftSize = WAV_SPECTRUM_FFT_SIZE;

  fileName = '';
  fileSize = 0;
  audioUrl: string | null = null;
  duration = 0;
  currentTime = 0;
  peaks: number[] = [];
  loading = false;
  isPlaying = false;
  isPlayingPromise = false;
  errorMessage = '';
  showDropZone = false;
  dismissedSuggestionId: string | null = null;

  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private frequencyData: Uint8Array | null = null;
  private animationFrameId: number | null = null;
  private audioSourceConnected = false;
  private readonly preventDefaultsFn = (e: Event) => this.preventDefaults(e);

  get primarySuggestion(): FvToolSuggestion | null {
    let suggestion: FvToolSuggestion | null = null;

    if (this.errorMessage) {
      suggestion = {
        id: 'wsv-audio',
        title: 'Try the audio player?',
        reason: 'Audio Player handles playback when spectrum analysis fails.',
        actionLabel: 'Open Audio Player',
        path: '/file-viewers/audio-player'
      };
    } else if (this.audioUrl) {
      suggestion = {
        id: 'wsv-spectrogram',
        title: 'Need a time-frequency view?',
        reason: 'Spectrogram Viewer renders STFT heatmaps for deeper analysis.',
        actionLabel: 'Open Spectrogram Viewer',
        path: '/file-viewers/spectrogram-viewer'
      };
    } else {
      suggestion = {
        id: 'wsv-intro',
        title: 'Upload audio to analyze',
        reason: 'Drop a WAV or other audio file to visualize waveform and live FFT.',
        actionLabel: 'Open Audio Player',
        path: '/file-viewers/audio-player'
      };
    }

    if (!suggestion || this.dismissedSuggestionId === suggestion.id) {
      return null;
    }
    return suggestion;
  }

  get playheadRatio(): number | null {
    if (!this.duration) {
      return null;
    }
    return this.currentTime / this.duration;
  }

  ngOnInit(): void {
    this.setupDragAndDrop();
  }

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.setupAudioElement();
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
    this.errorMessage = '';
    this.dismissedSuggestionId = null;
    this.stopPlayback();
    this.revokeAudioUrl();
    this.cdr.markForCheck();

    try {
      const buffer = await decodeAudioFile(file);
      this.peaks = computeWaveformPeaks(buffer);
      this.duration = buffer.duration;

      const url = URL.createObjectURL(file);
      this.audioUrl = url;
      this.fileName = file.name;
      this.fileSize = file.size;

      if (this.audioElement?.nativeElement) {
        this.audioElement.nativeElement.src = url;
        this.audioElement.nativeElement.load();
      }

      this.cdr.markForCheck();
      requestAnimationFrame(() => {
        this.redrawWaveform();
        this.clearSpectrum();
      });
    } catch (error) {
      this.errorMessage = `Failed to load audio: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.toast.error('Failed to load audio file');
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  setupAudioElement(): void {
    if (!this.audioElement?.nativeElement) {
      return;
    }

    const audio = this.audioElement.nativeElement;

    audio.addEventListener('loadedmetadata', () => {
      this.duration = audio.duration || this.duration;
      this.cdr.markForCheck();
    });

    audio.addEventListener('timeupdate', () => {
      this.currentTime = audio.currentTime;
      this.redrawWaveform();
      this.cdr.markForCheck();
    });

    audio.addEventListener('play', () => {
      this.isPlaying = true;
      this.ensureAnalyser();
      void this.audioContext?.resume();
      this.startSpectrumLoop();
      this.cdr.markForCheck();
    });

    audio.addEventListener('pause', () => {
      this.isPlaying = false;
      this.stopSpectrumLoop();
      this.cdr.markForCheck();
    });

    audio.addEventListener('ended', () => {
      this.isPlaying = false;
      this.stopSpectrumLoop();
      this.cdr.markForCheck();
    });

    audio.addEventListener('error', () => {
      this.errorMessage = 'Error playing audio file';
      this.dismissedSuggestionId = null;
      this.cdr.markForCheck();
    });
  }

  async togglePlayback(): Promise<void> {
    if (!this.audioElement?.nativeElement || !this.audioUrl || this.isPlayingPromise) {
      return;
    }

    const audio = this.audioElement.nativeElement;

    if (this.isPlaying) {
      audio.pause();
      return;
    }

    try {
      this.isPlayingPromise = true;
      this.ensureAnalyser();
      await this.audioContext?.resume();
      await audio.play();
    } catch {
      this.errorMessage = 'Unable to start playback. Try interacting with the page first.';
      this.cdr.markForCheck();
    } finally {
      this.isPlayingPromise = false;
    }
  }

  seekTo(ratio: number): void {
    if (!this.audioElement?.nativeElement || !this.duration) {
      return;
    }

    const clamped = Math.max(0, Math.min(1, ratio));
    this.audioElement.nativeElement.currentTime = clamped * this.duration;
    this.currentTime = this.audioElement.nativeElement.currentTime;
    this.redrawWaveform();
    this.cdr.markForCheck();
  }

  onWaveformClick(event: MouseEvent): void {
    if (!this.waveformCanvas?.nativeElement || !this.duration) {
      return;
    }

    const rect = this.waveformCanvas.nativeElement.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / rect.width;
    this.seekTo(ratio);
  }

  clearAll(): void {
    this.stopPlayback();
    this.revokeAudioUrl();
    this.peaks = [];
    this.fileName = '';
    this.fileSize = 0;
    this.duration = 0;
    this.currentTime = 0;
    this.errorMessage = '';
    this.dismissedSuggestionId = null;
    this.clearSpectrum();
    this.toast.info('Audio cleared');
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

  private ensureAnalyser(): void {
    if (!isPlatformBrowser(this.platformId) || !this.audioElement?.nativeElement) {
      return;
    }

    if (!this.audioContext) {
      const AudioCtx =
        globalThis.AudioContext ||
        (globalThis as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioContext = new AudioCtx();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = WAV_SPECTRUM_FFT_SIZE;
      this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
    }

    if (!this.audioSourceConnected && this.audioContext && this.analyser) {
      const source = this.audioContext.createMediaElementSource(this.audioElement.nativeElement);
      source.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);
      this.audioSourceConnected = true;
    }
  }

  private startSpectrumLoop(): void {
    if (!this.analyser || !this.frequencyData || !this.spectrumCanvas?.nativeElement) {
      return;
    }

    const canvas = this.spectrumCanvas.nativeElement;

    const draw = (): void => {
      if (!this.isPlaying || !this.analyser || !this.frequencyData) {
        this.animationFrameId = null;
        return;
      }

      this.animationFrameId = requestAnimationFrame(draw);
      this.analyser.getByteFrequencyData(this.frequencyData as Uint8Array<ArrayBuffer>);
      drawSpectrumCanvas(canvas, this.frequencyData);
    };

    this.stopSpectrumLoop();
    draw();
  }

  private stopSpectrumLoop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private redrawWaveform(): void {
    if (!this.waveformCanvas?.nativeElement || this.peaks.length === 0) {
      return;
    }

    drawWaveformCanvas(this.waveformCanvas.nativeElement, this.peaks, this.playheadRatio);
  }

  private clearSpectrum(): void {
    if (!this.spectrumCanvas?.nativeElement) {
      return;
    }

    const canvas = this.spectrumCanvas.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  private stopPlayback(): void {
    this.stopSpectrumLoop();
    this.audioElement?.nativeElement?.pause();
    this.isPlaying = false;
  }

  private revokeAudioUrl(): void {
    if (this.audioUrl) {
      try {
        URL.revokeObjectURL(this.audioUrl);
      } catch {
        // Ignore invalid object URLs during teardown
      }
      this.audioUrl = null;
    }

    if (this.audioElement?.nativeElement) {
      this.audioElement.nativeElement.removeAttribute('src');
      this.audioElement.nativeElement.load();
    }
  }

  private cleanup(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    this.stopPlayback();
    this.revokeAudioUrl();

    void this.audioContext?.close();
    this.audioContext = null;
    this.analyser = null;
    this.frequencyData = null;
    this.audioSourceConnected = false;

    for (const eventName of ['dragenter', 'dragover', 'dragleave', 'drop']) {
      document.removeEventListener(eventName, this.preventDefaultsFn, false);
      document.body.removeEventListener(eventName, this.preventDefaultsFn, false);
    }
  }
}
