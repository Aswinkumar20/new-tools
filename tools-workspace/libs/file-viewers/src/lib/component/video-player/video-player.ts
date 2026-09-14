import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  Inject,
  OnDestroy,
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
  VIDEO_ACCEPT_ATTR,
  VIDEO_FORMATS_LABEL,
  VIDEO_MAX_FILE_SIZE_LABEL,
  VIDEO_RELATED_TOOLS
} from '../../constants/video-player.constants';
import type { VideoTrackFile } from '../../types/video-player.types';
import {
  formatVideoFileSize,
  formatVideoTime,
  isIgnorableVideoPlaybackError,
  loadVideoDuration,
  resolveVideoSuggestion,
  validateVideoFiles
} from '../../utils/video-player.utils';

@Component({
  selector: 'lib-video-player',
  standalone: true,
  templateUrl: './video-player.html',
  styleUrls: ['./video-player.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation, TooltipDirective]
})
export class VideoPlayerComponent implements OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);

  @ViewChild('videoElement') videoElement!: ElementRef<HTMLVideoElement>;
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('progressBar') progressBar!: ElementRef<HTMLDivElement>;

  readonly acceptAttr = VIDEO_ACCEPT_ATTR;
  readonly formatsLabel = VIDEO_FORMATS_LABEL;
  readonly maxFileSizeLabel = VIDEO_MAX_FILE_SIZE_LABEL;
  readonly relatedTools: ReadonlyArray<FvRelatedToolLink> = VIDEO_RELATED_TOOLS;

  videoFiles: VideoTrackFile[] = [];
  currentTrackIndex = -1;
  currentTrack: VideoTrackFile | null = null;

  isPlaying = false;
  isLoading = false;
  currentTime = 0;
  duration = 0;
  volume = 100;
  playbackRate = 1;
  isMuted = false;
  previousVolume = 100;
  isPlayingPromise = false;

  showDropZone = false;
  showPlaylist = true;
  loading = false;
  errorMessage = '';
  dismissedSuggestionId: string | null = null;

  private readonly preventDefaultsFn = (e: Event) => this.preventDefaults(e);

  constructor(
    private readonly cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private readonly platformId: object
  ) {
    if (isPlatformBrowser(this.platformId)) {
      for (const eventName of ['dragenter', 'dragover', 'dragleave', 'drop']) {
        document.addEventListener(eventName, this.preventDefaultsFn, false);
        document.body.addEventListener(eventName, this.preventDefaultsFn, false);
      }
    }
  }

  get primarySuggestion() {
    const suggestion = resolveVideoSuggestion({
      hasVideos: this.videoFiles.length > 0,
      hasError: !!this.errorMessage,
      isPlaying: this.isPlaying,
      videoCount: this.videoFiles.length
    });
    if (!suggestion || this.dismissedSuggestionId === suggestion.id) {
      return null;
    }
    return suggestion;
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId = suggestionId;
    this.cdr.markForCheck();
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
    const { validFiles, errors } = validateVideoFiles(files);

    if (validFiles.length === 0) {
      this.errorMessage = errors[0] ?? 'Please select valid video files.';
      this.dismissedSuggestionId = null;
      this.toast.error('No supported video files found');
      this.cdr.markForCheck();
      return;
    }

    if (errors.length > 0) {
      this.toast.warning(errors[0]);
    }

    this.loading = true;
    this.errorMessage = '';
    this.dismissedSuggestionId = null;
    this.cdr.markForCheck();

    try {
      for (const file of validFiles) {
        await this.loadVideoFile(file);
      }
    } catch (error) {
      this.errorMessage = `Failed to load video: ${error instanceof Error ? error.message : 'Unknown error'}`;
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async loadVideoFile(file: File): Promise<void> {
    const url = URL.createObjectURL(file);
    const videoFile: VideoTrackFile = {
      name: file.name,
      file,
      url,
      size: file.size,
      duration: 0,
      loaded: false
    };

    videoFile.duration = await loadVideoDuration(url);
    videoFile.loaded = true;
    this.videoFiles.push(videoFile);

    if (this.videoFiles.length === 1) {
      this.currentTrackIndex = 0;
      this.loadTrack(0);
    }
  }

  setupVideoElement(): void {
    if (!this.videoElement?.nativeElement) {
      return;
    }

    const video = this.videoElement.nativeElement;

    video.addEventListener('loadedmetadata', () => {
      this.duration = video.duration;
      this.cdr.markForCheck();
    });

    video.addEventListener('timeupdate', () => {
      this.currentTime = video.currentTime;
      this.cdr.markForCheck();
    });

    video.addEventListener('ended', () => {
      this.nextTrack();
    });

    video.addEventListener('play', () => {
      this.isPlaying = true;
      this.cdr.markForCheck();
    });

    video.addEventListener('pause', () => {
      this.isPlaying = false;
      this.cdr.markForCheck();
    });

    video.addEventListener('loadstart', () => {
      this.isLoading = true;
      this.cdr.markForCheck();
    });

    video.addEventListener('canplay', () => {
      this.isLoading = false;
      this.cdr.markForCheck();
    });

    video.addEventListener('error', () => {
      this.errorMessage = 'Error playing video file';
      this.isLoading = false;
      this.dismissedSuggestionId = null;
      this.cdr.markForCheck();
    });
  }

  onVideoReady(): void {
    this.setupVideoElement();
  }

  loadTrack(index: number): void {
    if (index < 0 || index >= this.videoFiles.length) {
      return;
    }

    if (this.videoElement?.nativeElement && !this.videoElement.nativeElement.paused) {
      this.videoElement.nativeElement.pause();
    }

    this.currentTrackIndex = index;
    this.currentTrack = this.videoFiles[index];

    if (this.videoElement?.nativeElement) {
      const video = this.videoElement.nativeElement;
      video.src = this.currentTrack.url;
      video.load();
      this.currentTime = 0;
      this.duration = this.currentTrack.duration;
      this.isPlaying = false;
    }

    this.cdr.markForCheck();
  }

  async play(): Promise<void> {
    if (!this.videoElement?.nativeElement || !this.currentTrack || this.isPlayingPromise) {
      return;
    }

    if (this.isPlaying) {
      return;
    }

    try {
      this.isPlayingPromise = true;
      await this.videoElement.nativeElement.play();
    } catch (error: unknown) {
      if (!isIgnorableVideoPlaybackError(error)) {
        this.errorMessage = 'Error playing video. Please try again.';
        this.dismissedSuggestionId = null;
        this.cdr.markForCheck();
      }
    } finally {
      this.isPlayingPromise = false;
    }
  }

  pause(): void {
    this.videoElement?.nativeElement?.pause();
  }

  previousTrack(): void {
    if (this.videoFiles.length === 0) {
      return;
    }
    const newIndex = this.currentTrackIndex > 0 ? this.currentTrackIndex - 1 : this.videoFiles.length - 1;
    this.loadTrack(newIndex);
    void this.play();
  }

  nextTrack(): void {
    if (this.videoFiles.length === 0) {
      return;
    }
    const newIndex =
      this.currentTrackIndex < this.videoFiles.length - 1 ? this.currentTrackIndex + 1 : 0;
    if (newIndex === 0 && this.currentTrackIndex === this.videoFiles.length - 1) {
      this.pause();
      if (this.videoElement?.nativeElement) {
        this.videoElement.nativeElement.currentTime = 0;
      }
      return;
    }
    this.loadTrack(newIndex);
    void this.play();
  }

  seekTo(time: number): void {
    if (this.videoElement?.nativeElement) {
      this.videoElement.nativeElement.currentTime = time;
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
    this.volume = Math.max(0, Math.min(100, value));
    if (this.videoElement?.nativeElement) {
      this.videoElement.nativeElement.volume = this.volume / 100;
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
    if (this.videoElement?.nativeElement) {
      this.videoElement.nativeElement.playbackRate = rate;
    }
    this.cdr.markForCheck();
  }

  selectTrack(index: number): void {
    this.loadTrack(index);
    void this.play();
  }

  removeTrack(index: number): void {
    if (index < 0 || index >= this.videoFiles.length) {
      return;
    }

    URL.revokeObjectURL(this.videoFiles[index].url);
    this.videoFiles.splice(index, 1);

    if (this.videoFiles.length === 0) {
      this.currentTrackIndex = -1;
      this.currentTrack = null;
      this.pause();
    } else if (this.currentTrackIndex >= this.videoFiles.length) {
      this.currentTrackIndex = this.videoFiles.length - 1;
      this.loadTrack(this.currentTrackIndex);
    } else if (this.currentTrackIndex === index) {
      this.loadTrack(Math.min(index, this.videoFiles.length - 1));
    } else if (this.currentTrackIndex > index) {
      this.currentTrackIndex--;
    }

    this.cdr.markForCheck();
  }

  formatTime(seconds: number): string {
    return formatVideoTime(seconds);
  }

  formatFileSize(bytes: number): string {
    return formatVideoFileSize(bytes);
  }

  clearAll(): void {
    this.pause();
    for (const videoFile of this.videoFiles) {
      URL.revokeObjectURL(videoFile.url);
    }
    this.videoFiles = [];
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

    this.pause();
    for (const videoFile of this.videoFiles) {
      try {
        URL.revokeObjectURL(videoFile.url);
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
