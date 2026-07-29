import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  Inject,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  ViewChild,
  inject
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Navigation, TooltipDirective, AssetService, ToastService } from '@tools-workspace/features-home';
import type { FvRelatedToolLink } from '../../shared/fv-tool-suggestion.model';
import {
  AUDIO_ACCEPT_ATTR,
  AUDIO_DEFAULT_VOLUME,
  AUDIO_PLAYBACK_RATES,
  AUDIO_RELATED_TOOLS,
  AUDIO_TRACK_LOAD_DELAY_MS,
  AUDIO_VIS_CANVAS_HEIGHT,
  AUDIO_VIS_COLORS,
  AUDIO_VIS_FFT_SIZE
} from '../../constants/audio-player.constants';
import type { AudioRepeatMode, AudioTrackFile } from '../../types/audio-player.types';
import {
  clampVolumePercent,
  cycleRepeatMode,
  filterValidAudioFiles,
  formatAudioFileSize,
  formatAudioTime,
  generateShuffledIndices,
  isIgnorablePlaybackError,
  loadAudioDuration,
  resolveAudioSuggestion,
  resolveNextTrackIndex,
  resolvePreviousTrackIndex,
  shouldStopAtPlaylistEnd
} from '../../utils/audio-player.utils';

@Component({
  selector: 'lib-audio-player',
  standalone: true,
  templateUrl: './audio-player.html',
  styleUrls: ['./audio-player.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation, TooltipDirective]
})
export class FileViewerAudioPlayerComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);

  @ViewChild('audioElement') audioElement!: ElementRef<HTMLAudioElement>;
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('waveformCanvas') waveformCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('progressBar') progressBar!: ElementRef<HTMLDivElement>;

  readonly acceptAttr = AUDIO_ACCEPT_ATTR;
  readonly playbackRates = AUDIO_PLAYBACK_RATES;
  readonly relatedTools: ReadonlyArray<FvRelatedToolLink> = AUDIO_RELATED_TOOLS;

  audioFiles: AudioTrackFile[] = [];
  currentTrackIndex = -1;
  currentTrack: AudioTrackFile | null = null;

  isPlaying = false;
  isLoading = false;
  currentTime = 0;
  duration = 0;
  volume = AUDIO_DEFAULT_VOLUME;
  playbackRate = 1;
  isMuted = false;
  previousVolume = AUDIO_DEFAULT_VOLUME;
  isPlayingPromise = false;

  repeatMode: AudioRepeatMode = 'none';
  shuffleMode = false;
  shuffledIndices: number[] = [];

  showDropZone = false;
  showPlaylist = true;
  loading = false;
  errorMessage = '';

  dismissedSuggestionId: string | null = null;

  audioContext: AudioContext | null = null;
  analyser: AnalyserNode | null = null;
  dataArray: Uint8Array | null = null;
  animationFrameId: number | null = null;

  private readonly preventDefaultsFn = (e: Event) => this.preventDefaults(e);

  constructor(
    private readonly cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private readonly platformId: object
  ) {}

  get primarySuggestion() {
    const suggestion = resolveAudioSuggestion({
      hasTracks: this.audioFiles.length > 0,
      hasError: !!this.errorMessage,
      isPlaying: this.isPlaying,
      trackCount: this.audioFiles.length
    });
    if (!suggestion || this.dismissedSuggestionId === suggestion.id) {
      return null;
    }
    return suggestion;
  }

  ngOnInit(): void {
    this.setupDragAndDrop();
  }

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.setupAudioElement();
      setTimeout(() => {
        this.setupAudioVisualization();
        this.resizeCanvas();
      }, 100);
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
    }
  }

  async handleFiles(files: File[]): Promise<void> {
    const validFiles = filterValidAudioFiles(files);

    if (validFiles.length === 0) {
      this.errorMessage = 'Please select valid audio files (.mp3, .wav, .ogg, .flac, etc.)';
      this.dismissedSuggestionId = null;
      this.toast.error('No supported audio files found');
      this.cdr.markForCheck();
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.dismissedSuggestionId = null;
    this.cdr.markForCheck();

    try {
      for (const file of validFiles) {
        await this.loadAudioFile(file);
      }
    } catch (error) {
      this.errorMessage = `Failed to load audio file: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async loadAudioFile(file: File): Promise<void> {
    try {
      const url = URL.createObjectURL(file);

      const audioFile: AudioTrackFile = {
        name: file.name,
        file,
        url,
        size: file.size,
        duration: 0,
        loaded: false
      };

      await this.loadAudioMetadata(audioFile);

      this.audioFiles.push(audioFile);

      if (this.audioFiles.length === 1) {
        this.currentTrackIndex = 0;
        this.loadTrack(0);
      }

      this.loading = false;
      this.cdr.markForCheck();
    } catch (error) {
      throw new Error(
        `Failed to load audio file: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async loadAudioMetadata(audioFile: AudioTrackFile): Promise<void> {
    audioFile.duration = await loadAudioDuration(audioFile.url);
    audioFile.loaded = true;
  }

  setupAudioElement(): void {
    if (!this.audioElement?.nativeElement) {
      return;
    }

    const audio = this.audioElement.nativeElement;

    audio.addEventListener('loadedmetadata', () => {
      this.duration = audio.duration;
      this.cdr.markForCheck();
    });

    audio.addEventListener('timeupdate', () => {
      this.currentTime = audio.currentTime;
      this.cdr.markForCheck();
    });

    audio.addEventListener('ended', () => {
      this.onTrackEnd();
    });

    audio.addEventListener('play', () => {
      this.isPlaying = true;
      this.startVisualization();
      this.cdr.markForCheck();
    });

    audio.addEventListener('pause', () => {
      this.isPlaying = false;
      this.stopVisualization();
      this.cdr.markForCheck();
    });

    audio.addEventListener('loadstart', () => {
      this.isLoading = true;
      this.cdr.markForCheck();
    });

    audio.addEventListener('canplay', () => {
      this.isLoading = false;
      this.cdr.markForCheck();
    });

    audio.addEventListener('error', () => {
      this.errorMessage = 'Error playing audio file';
      this.isLoading = false;
      this.dismissedSuggestionId = null;
      this.cdr.markForCheck();
    });
  }

  loadTrack(index: number): void {
    if (index < 0 || index >= this.audioFiles.length) {
      return;
    }

    if (this.audioElement?.nativeElement) {
      const audio = this.audioElement.nativeElement;
      if (!audio.paused) {
        audio.pause();
      }
    }

    this.currentTrackIndex = index;
    this.currentTrack = this.audioFiles[index];

    if (this.audioElement?.nativeElement) {
      const audio = this.audioElement.nativeElement;
      audio.src = this.currentTrack.url;
      audio.load();
      this.currentTime = 0;
      this.duration = this.currentTrack.duration;
      this.isPlaying = false;
    }

    this.cdr.markForCheck();
  }

  async play(): Promise<void> {
    if (!this.audioElement?.nativeElement || !this.currentTrack || this.isPlayingPromise) {
      return;
    }

    if (this.isPlaying) {
      return;
    }

    try {
      this.isPlayingPromise = true;
      await this.audioElement.nativeElement.play();
    } catch (error: unknown) {
      if (!isIgnorablePlaybackError(error)) {
        this.errorMessage = 'Error playing audio. Please try again.';
        this.dismissedSuggestionId = null;
        this.cdr.markForCheck();
      }
    } finally {
      this.isPlayingPromise = false;
    }
  }

  pause(): void {
    if (this.audioElement?.nativeElement && this.isPlaying) {
      this.audioElement.nativeElement.pause();
    }
  }

  stop(): void {
    if (this.audioElement?.nativeElement) {
      this.audioElement.nativeElement.pause();
      this.audioElement.nativeElement.currentTime = 0;
      this.currentTime = 0;
    }
  }

  previousTrack(): void {
    if (this.audioFiles.length === 0) {
      return;
    }

    const newIndex = resolvePreviousTrackIndex({
      trackCount: this.audioFiles.length,
      currentIndex: this.currentTrackIndex,
      shuffleMode: this.shuffleMode,
      shuffledIndices: this.shuffledIndices
    });

    this.loadTrack(newIndex);
    void this.play();
  }

  nextTrack(): void {
    if (this.audioFiles.length === 0) {
      return;
    }

    if (this.repeatMode === 'one') {
      this.loadTrack(this.currentTrackIndex);
      void this.play();
      return;
    }

    if (this.shuffleMode) {
      this.generateShuffledIndices();
    }

    const newIndex = resolveNextTrackIndex({
      trackCount: this.audioFiles.length,
      currentIndex: this.currentTrackIndex,
      shuffleMode: this.shuffleMode,
      shuffledIndices: this.shuffledIndices
    });

    if (
      shouldStopAtPlaylistEnd({
        repeatMode: this.repeatMode,
        currentIndex: this.currentTrackIndex,
        nextIndex: newIndex,
        trackCount: this.audioFiles.length
      })
    ) {
      this.stop();
      return;
    }

    this.loadTrack(newIndex);
    setTimeout(() => {
      void this.play();
    }, AUDIO_TRACK_LOAD_DELAY_MS);
  }

  onTrackEnd(): void {
    if (this.repeatMode === 'one') {
      this.loadTrack(this.currentTrackIndex);
      setTimeout(() => {
        void this.play();
      }, AUDIO_TRACK_LOAD_DELAY_MS);
    } else if (this.repeatMode === 'all') {
      this.nextTrack();
    } else {
      this.nextTrack();
    }
  }

  seekTo(time: number): void {
    if (this.audioElement?.nativeElement) {
      this.audioElement.nativeElement.currentTime = time;
      this.currentTime = time;
    }
  }

  onProgressBarClick(event: MouseEvent): void {
    if (!this.progressBar?.nativeElement || !this.duration) {
      return;
    }

    const rect = this.progressBar.nativeElement.getBoundingClientRect();
    const percent = (event.clientX - rect.left) / rect.width;
    this.seekTo(percent * this.duration);
  }

  setVolume(value: number): void {
    this.volume = clampVolumePercent(value);
    if (this.audioElement?.nativeElement) {
      this.audioElement.nativeElement.volume = this.volume / 100;
    }
    this.cdr.markForCheck();
  }

  toggleMute(): void {
    if (this.isMuted) {
      this.volume = this.previousVolume;
      this.isMuted = false;
    } else {
      this.previousVolume = this.volume;
      this.volume = 0;
      this.isMuted = true;
    }
    this.setVolume(this.volume);
  }

  setPlaybackRate(rate: number): void {
    this.playbackRate = rate;
    if (this.audioElement?.nativeElement) {
      this.audioElement.nativeElement.playbackRate = rate;
    }
    this.cdr.markForCheck();
  }

  toggleRepeat(): void {
    this.repeatMode = cycleRepeatMode(this.repeatMode);
    this.cdr.markForCheck();
  }

  toggleShuffle(): void {
    this.shuffleMode = !this.shuffleMode;
    if (this.shuffleMode) {
      this.generateShuffledIndices();
    }
    this.cdr.markForCheck();
  }

  generateShuffledIndices(): void {
    this.shuffledIndices = generateShuffledIndices(this.audioFiles.length);
  }

  selectTrack(index: number): void {
    this.loadTrack(index);
    setTimeout(() => {
      void this.play();
    }, AUDIO_TRACK_LOAD_DELAY_MS);
  }

  removeTrack(index: number): void {
    if (index < 0 || index >= this.audioFiles.length) {
      return;
    }

    const audioFile = this.audioFiles[index];
    URL.revokeObjectURL(audioFile.url);

    this.audioFiles.splice(index, 1);

    if (this.audioFiles.length === 0) {
      this.currentTrackIndex = -1;
      this.currentTrack = null;
      this.stop();
    } else {
      if (this.currentTrackIndex >= this.audioFiles.length) {
        this.currentTrackIndex = this.audioFiles.length - 1;
      }
      if (this.currentTrackIndex === index && this.currentTrackIndex < this.audioFiles.length) {
        this.loadTrack(this.currentTrackIndex);
      } else if (this.currentTrackIndex > index) {
        this.currentTrackIndex--;
      }
    }

    this.cdr.markForCheck();
  }

  setupAudioVisualization(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    try {
      const AudioCtx =
        globalThis.AudioContext ||
        (globalThis as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioContext = new AudioCtx();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = AUDIO_VIS_FFT_SIZE;
      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);

      if (this.audioElement?.nativeElement) {
        const source = this.audioContext.createMediaElementSource(this.audioElement.nativeElement);
        source.connect(this.analyser);
        this.analyser.connect(this.audioContext.destination);
      }

      this.resizeCanvas();
    } catch {
      // Visualization is optional when AudioContext is blocked
    }
  }

  resizeCanvas(): void {
    if (!this.waveformCanvas?.nativeElement) {
      return;
    }

    const canvas = this.waveformCanvas.nativeElement;
    const container = canvas.parentElement;
    if (!container) {
      return;
    }

    const rect = container.getBoundingClientRect();
    canvas.width = rect.width - 32;
    canvas.height = AUDIO_VIS_CANVAS_HEIGHT;
  }

  startVisualization(): void {
    if (!this.analyser || !this.waveformCanvas?.nativeElement || !this.dataArray || this.dataArray.length === 0) {
      return;
    }

    const canvas = this.waveformCanvas.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    const draw = (): void => {
      if (!this.isPlaying || !this.analyser || !this.dataArray) {
        this.animationFrameId = null;
        return;
      }

      this.animationFrameId = requestAnimationFrame(draw);

      this.analyser.getByteFrequencyData(this.dataArray as any);

      const width = canvas.width;
      const height = canvas.height;
      const barWidth = width / this.dataArray.length;

      ctx.fillStyle = AUDIO_VIS_COLORS.background;
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = AUDIO_VIS_COLORS.bars;
      for (let i = 0; i < this.dataArray.length; i++) {
        const barHeight = (this.dataArray[i] / 255) * height;
        ctx.fillRect(i * barWidth, height - barHeight, barWidth - 2, barHeight);
      }

      this.analyser.getByteTimeDomainData(this.dataArray as any);
      ctx.strokeStyle = AUDIO_VIS_COLORS.waveform;
      ctx.lineWidth = 2;
      ctx.beginPath();

      const sliceWidth = width / this.dataArray.length;
      let x = 0;

      for (let i = 0; i < this.dataArray.length; i++) {
        const v = this.dataArray[i] / 128;
        const y = (v * height) / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      ctx.lineTo(width, height / 2);
      ctx.stroke();
    };

    draw();
  }

  stopVisualization(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  formatTime(seconds: number): string {
    return formatAudioTime(seconds);
  }

  formatFileSize(bytes: number): string {
    return formatAudioFileSize(bytes);
  }

  downloadTrack(track: AudioTrackFile): void {
    const link = document.createElement('a');
    link.href = track.url;
    link.download = track.name;
    link.click();
    this.toast.info(`Downloaded ${track.name}`);
  }

  clearAll(): void {
    this.stop();
    this.stopVisualization();
    for (const audioFile of this.audioFiles) {
      try {
        URL.revokeObjectURL(audioFile.url);
      } catch {
        // Ignore invalid object URLs during teardown
      }
    }
    this.audioFiles = [];
    this.currentTrackIndex = -1;
    this.currentTrack = null;
    this.currentTime = 0;
    this.duration = 0;
    this.errorMessage = '';
    this.dismissedSuggestionId = null;
    this.toast.info('Playlist cleared');
    this.cdr.markForCheck();
  }

  togglePlaylist(): void {
    this.showPlaylist = !this.showPlaylist;
    this.cdr.markForCheck();
  }

  cleanup(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    this.stop();
    this.stopVisualization();

    if (this.audioContext) {
      void this.audioContext.close();
    }

    for (const audioFile of this.audioFiles) {
      try {
        URL.revokeObjectURL(audioFile.url);
      } catch {
        // Ignore invalid object URLs during teardown
      }
    }

    for (const eventName of ['dragenter', 'dragover', 'dragleave', 'drop']) {
      document.removeEventListener(eventName, this.preventDefaultsFn, false);
      document.body.removeEventListener(eventName, this.preventDefaultsFn, false);
    }
  }
}
