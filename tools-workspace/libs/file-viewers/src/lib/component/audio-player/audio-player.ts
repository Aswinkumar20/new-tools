import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
  ViewChild,
  ElementRef,
  ChangeDetectorRef,
  HostListener,
  PLATFORM_ID,
  Inject
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';

interface AudioFile {
  name: string;
  file: File;
  url: string;
  size: number;
  duration: number;
  artist?: string;
  title?: string;
  album?: string;
  loaded: boolean;
}

@Component({
  selector: 'lib-audio-player',
  standalone: true,
  templateUrl: './audio-player.html',
  styleUrls: ['./audio-player.scss'],
  imports: [CommonModule, FormsModule, Navigation]
})
export class FileViewerAudioPlayerComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('audioElement') audioElement!: ElementRef<HTMLAudioElement>;
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('waveformCanvas') waveformCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('progressBar') progressBar!: ElementRef<HTMLDivElement>;

  audioFiles: AudioFile[] = [];
  currentTrackIndex: number = -1;
  currentTrack: AudioFile | null = null;

  // Playback state
  isPlaying: boolean = false;
  isLoading: boolean = false;
  currentTime: number = 0;
  duration: number = 0;
  volume: number = 100;
  playbackRate: number = 1;
  isMuted: boolean = false;
  previousVolume: number = 100;
  isPlayingPromise: boolean = false;

  // Playback modes
  repeatMode: 'none' | 'one' | 'all' = 'none';
  shuffleMode: boolean = false;
  shuffledIndices: number[] = [];

  // UI state
  showDropZone: boolean = false;
  showAbout: boolean = false;
  showPlaylist: boolean = true;
  showEqualizer: boolean = false;
  loading: boolean = false;
  errorMessage: string = '';

  // Audio visualization
  audioContext: AudioContext | null = null;
  analyser: AnalyserNode | null = null;
  dataArray: Uint8Array | null = null;
  animationFrameId: number | null = null;

  // Playlist scroll position
  playlistScrollTop: number = 0;

  private readonly supportedFormats = [
    '.mp3',
    '.wav',
    '.ogg',
    '.flac',
    '.aac',
    '.m4a',
    '.opus',
    '.webm',
    '.wma',
    '.aiff',
    '.au'
  ];

  private readonly preventDefaultsFn = (e: Event) => this.preventDefaults(e);

  constructor(
    private readonly cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private readonly platformId: Object
  ) {}

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

  setupDragAndDrop(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    for (const eventName of ['dragenter', 'dragover', 'dragleave', 'drop']) {
      document.addEventListener(eventName, this.preventDefaultsFn, false);
      document.body.addEventListener(eventName, this.preventDefaultsFn, false);
    }
  }

  preventDefaults(e: Event): void {
    e.preventDefault();
    e.stopPropagation();
  }

  onDragEnter(): void {
    this.showDropZone = true;
    this.cdr.markForCheck();
  }

  onDragLeave(): void {
    this.showDropZone = false;
    this.cdr.markForCheck();
  }

  onDrop(e: DragEvent): void {
    this.showDropZone = false;
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      this.handleFiles(Array.from(files));
    }
  }

  openFileDialog(): void {
    this.fileInput?.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.handleFiles(Array.from(input.files));
    }
  }

  async handleFiles(files: File[]): Promise<void> {
    const validFiles = files.filter(file => {
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      return this.supportedFormats.includes(ext) || 
             file.type.startsWith('audio/');
    });

    if (validFiles.length === 0) {
      this.errorMessage = 'Please select valid audio files (.mp3, .wav, .ogg, .flac, etc.)';
      this.cdr.markForCheck();
      return;
    }

    this.loading = true;
    this.errorMessage = '';
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
      
      const audioFile: AudioFile = {
        name: file.name,
        file: file,
        url: url,
        size: file.size,
        duration: 0,
        loaded: false
      };

      // Load metadata
      await this.loadAudioMetadata(audioFile);

      this.audioFiles.push(audioFile);

      if (this.audioFiles.length === 1) {
        this.currentTrackIndex = 0;
        this.loadTrack(0);
      }

      this.loading = false;
      this.cdr.markForCheck();
    } catch (error) {
      console.error('Error loading audio file:', error);
      throw new Error(`Failed to load audio file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async loadAudioMetadata(audioFile: AudioFile): Promise<void> {
    return new Promise((resolve, reject) => {
      const audio = new Audio();
      audio.preload = 'metadata';
      
      audio.addEventListener('loadedmetadata', () => {
        audioFile.duration = audio.duration;
        audioFile.loaded = true;
        resolve();
      });

      audio.addEventListener('error', () => {
        reject(new Error('Failed to load audio metadata'));
      });

      audio.src = audioFile.url;
    });
  }

  setupAudioElement(): void {
    if (!this.audioElement?.nativeElement) return;

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
      this.cdr.markForCheck();
    });
  }

  loadTrack(index: number): void {
    if (index < 0 || index >= this.audioFiles.length) {
      return;
    }

    // Pause current playback if playing to prevent AbortError
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

    // Check if already playing
    if (this.isPlaying) {
      return;
    }

    try {
      this.isPlayingPromise = true;
      await this.audioElement.nativeElement.play();
      // Playback started successfully - isPlaying will be set by the 'play' event listener
    } catch (error: any) {
      // AbortError is expected when play() is interrupted by pause() or load()
      // This is not a real error, just the browser's way of handling interrupted play requests
      if (error.name === 'AbortError' || error.name === 'NotAllowedError') {
        // Silently ignore - these are expected in certain scenarios
      } else {
        console.error('Error playing audio:', error);
        this.errorMessage = 'Error playing audio. Please try again.';
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
    if (this.audioFiles.length === 0) return;

    let newIndex: number;
    if (this.shuffleMode && this.shuffledIndices.length > 0) {
      const currentShuffleIndex = this.shuffledIndices.indexOf(this.currentTrackIndex);
      newIndex = currentShuffleIndex > 0 
        ? this.shuffledIndices[currentShuffleIndex - 1]
        : this.shuffledIndices[this.shuffledIndices.length - 1];
    } else {
      newIndex = this.currentTrackIndex > 0 
        ? this.currentTrackIndex - 1 
        : this.audioFiles.length - 1;
    }

    this.loadTrack(newIndex);
    this.play();
  }

  nextTrack(): void {
    if (this.audioFiles.length === 0) return;

    if (this.repeatMode === 'one') {
      this.loadTrack(this.currentTrackIndex);
      this.play();
      return;
    }

    let newIndex: number;
    if (this.shuffleMode) {
      this.generateShuffledIndices();
      const currentShuffleIndex = this.shuffledIndices.indexOf(this.currentTrackIndex);
      newIndex = currentShuffleIndex < this.shuffledIndices.length - 1
        ? this.shuffledIndices[currentShuffleIndex + 1]
        : this.shuffledIndices[0];
    } else {
      newIndex = this.currentTrackIndex < this.audioFiles.length - 1
        ? this.currentTrackIndex + 1
        : 0;
    }

    if (newIndex === 0 && this.repeatMode === 'none' && this.currentTrackIndex === this.audioFiles.length - 1) {
      this.stop();
      return;
    }

    this.loadTrack(newIndex);
    // Wait a bit for the track to load before playing
    setTimeout(() => {
      this.play();
    }, 100);
  }

  onTrackEnd(): void {
    if (this.repeatMode === 'one') {
      this.loadTrack(this.currentTrackIndex);
      setTimeout(() => {
        this.play();
      }, 100);
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
    if (!this.progressBar?.nativeElement || !this.duration) return;

    const rect = this.progressBar.nativeElement.getBoundingClientRect();
    const percent = (event.clientX - rect.left) / rect.width;
    const newTime = percent * this.duration;
    this.seekTo(newTime);
  }

  setVolume(value: number): void {
    this.volume = Math.max(0, Math.min(100, value));
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
    const modes: Array<'none' | 'one' | 'all'> = ['none', 'all', 'one'];
    const currentIndex = modes.indexOf(this.repeatMode);
    this.repeatMode = modes[(currentIndex + 1) % modes.length];
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
    this.shuffledIndices = Array.from({ length: this.audioFiles.length }, (_, i) => i);
    // Fisher-Yates shuffle
    for (let i = this.shuffledIndices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.shuffledIndices[i], this.shuffledIndices[j]] = [this.shuffledIndices[j], this.shuffledIndices[i]];
    }
  }

  selectTrack(index: number): void {
    this.loadTrack(index);
    // Wait a bit for the track to load before playing
    setTimeout(() => {
      this.play();
    }, 100);
  }

  removeTrack(index: number): void {
    if (index < 0 || index >= this.audioFiles.length) return;

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
    if (!isPlatformBrowser(this.platformId)) return;

    try {
      this.audioContext = new (globalThis.AudioContext || (globalThis as any).webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      const bufferLength = this.analyser.frequencyBinCount;
      this.dataArray = new Uint8Array(bufferLength);

      if (this.audioElement?.nativeElement) {
        const source = this.audioContext.createMediaElementSource(this.audioElement.nativeElement);
        source.connect(this.analyser);
        this.analyser.connect(this.audioContext.destination);
      }

      this.resizeCanvas();
    } catch (error) {
      console.warn('Audio visualization not available:', error);
    }
  }

  resizeCanvas(): void {
    if (!this.waveformCanvas?.nativeElement) return;

    const canvas = this.waveformCanvas.nativeElement;
    const container = canvas.parentElement;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    canvas.width = rect.width - 32; // Account for padding
    canvas.height = 150;
  }

  startVisualization(): void {
    if (!this.analyser || !this.waveformCanvas?.nativeElement || !this.dataArray || this.dataArray.length === 0) return;

    const canvas = this.waveformCanvas.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

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

      ctx.fillStyle = '#1a237e';
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = '#2196f3';
      for (let i = 0; i < this.dataArray.length; i++) {
        const barHeight = (this.dataArray[i] / 255) * height;
        ctx.fillRect(i * barWidth, height - barHeight, barWidth - 2, barHeight);
      }

      // Draw waveform
      this.analyser.getByteTimeDomainData(this.dataArray as any);
      ctx.strokeStyle = '#4caf50';
      ctx.lineWidth = 2;
      ctx.beginPath();

      const sliceWidth = width / this.dataArray.length;
      let x = 0;

      for (let i = 0; i < this.dataArray.length; i++) {
        const v = this.dataArray[i] / 128;
        const y = v * height / 2;

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
    if (Number.isNaN(seconds) || !Number.isFinite(seconds)) {
      return '0:00';
    }

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  downloadTrack(track: AudioFile): void {
    const link = document.createElement('a');
    link.href = track.url;
    link.download = track.name;
    link.click();
  }

  toggleAbout(): void {
    this.showAbout = !this.showAbout;
    this.cdr.markForCheck();
  }

  togglePlaylist(): void {
    this.showPlaylist = !this.showPlaylist;
    this.cdr.markForCheck();
  }

  toggleEqualizer(): void {
    this.showEqualizer = !this.showEqualizer;
    this.cdr.markForCheck();
  }

  cleanup(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    this.stop();
    this.stopVisualization();

    if (this.audioContext) {
      this.audioContext.close();
    }

    // Cleanup object URLs
    for (const audioFile of this.audioFiles) {
      URL.revokeObjectURL(audioFile.url);
    }

    for (const eventName of ['dragenter', 'dragover', 'dragleave', 'drop']) {
      document.removeEventListener(eventName, this.preventDefaultsFn, false);
      document.body.removeEventListener(eventName, this.preventDefaultsFn, false);
    }
  }
}
