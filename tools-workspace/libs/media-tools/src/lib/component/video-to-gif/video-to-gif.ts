import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  ViewChild,
  computed,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  Navigation,
  TooltipDirective,
  AssetService,
  ToastService
} from '@tools-workspace/features-home';
import type { MtRelatedToolLink } from '../../shared/mt-tool-suggestion.model';
import {
  VIDEO_TO_GIF_ACCEPT_ATTR,
  VIDEO_TO_GIF_DESCRIPTION,
  VIDEO_TO_GIF_FORMATS_LABEL,
  VIDEO_TO_GIF_HELP_ITEMS,
  VIDEO_TO_GIF_INFO_ITEMS,
  VIDEO_TO_GIF_QUALITY_PRESETS,
  VIDEO_TO_GIF_RECOMMENDED_MAX_SECONDS,
  VIDEO_TO_GIF_RELATED_TOOLS,
  VIDEO_TO_GIF_TITLE,
  VIDEO_TO_GIF_UPLOAD_HINT,
  VIDEO_TO_GIF_UPLOAD_LABEL
} from '../../constants/video-to-gif.constants';
import type { VideoToGifInfoItem, VideoToGifQualityPreset } from '../../types/video-to-gif.types';
import { clampTrimRange, formatTrimTimestamp } from '../../utils/audio-trimmer.utils';
import {
  estimateGifBytes,
  formatVideoToGifFileSize,
  isClipLongerThanRecommended,
  resolveVideoToGifSuggestion,
  validateVideoToGifFiles
} from '../../utils/video-to-gif.utils';
import {
  buildGifFileName,
  convertVideoToGif,
  type VideoToGifEngine
} from '../../utils/video-to-gif-convert.utils';

@Component({
  selector: 'lib-video-to-gif',
  standalone: true,
  templateUrl: './video-to-gif.html',
  styleUrls: ['./video-to-gif.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VideoToGifComponent implements OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);

  @ViewChild('previewVideo') previewVideo?: ElementRef<HTMLVideoElement>;
  @ViewChild('fileInput') fileInput?: ElementRef<HTMLInputElement>;

  readonly title = VIDEO_TO_GIF_TITLE;
  readonly description = VIDEO_TO_GIF_DESCRIPTION;
  readonly uploadLabel = VIDEO_TO_GIF_UPLOAD_LABEL;
  readonly uploadHint = VIDEO_TO_GIF_UPLOAD_HINT;
  readonly acceptAttr = VIDEO_TO_GIF_ACCEPT_ATTR;
  readonly formatsLabel = VIDEO_TO_GIF_FORMATS_LABEL;
  readonly qualityPresets: ReadonlyArray<VideoToGifQualityPreset> = VIDEO_TO_GIF_QUALITY_PRESETS;
  readonly helpItems = VIDEO_TO_GIF_HELP_ITEMS;
  readonly infoItems: ReadonlyArray<VideoToGifInfoItem> = VIDEO_TO_GIF_INFO_ITEMS;
  readonly relatedTools: ReadonlyArray<MtRelatedToolLink> = VIDEO_TO_GIF_RELATED_TOOLS;
  readonly recommendedMaxSeconds = VIDEO_TO_GIF_RECOMMENDED_MAX_SECONDS;

  readonly sourceFile = signal<File | null>(null);
  readonly videoUrl = signal<string | null>(null);
  readonly durationSeconds = signal(0);
  readonly trimStartSeconds = signal(0);
  readonly trimEndSeconds = signal(0);
  readonly trimStartInput = signal('0:00.000');
  readonly trimEndInput = signal('0:00.000');
  readonly selectedPresetId = signal(VIDEO_TO_GIF_QUALITY_PRESETS[1]?.id ?? 'balanced');
  readonly customFps = signal(VIDEO_TO_GIF_QUALITY_PRESETS[1]?.fps ?? 12);
  readonly customWidth = signal(VIDEO_TO_GIF_QUALITY_PRESETS[1]?.maxWidth ?? 480);
  readonly useCustomQuality = signal(false);
  readonly loopCount = signal(0);
  readonly reversePlayback = signal(false);
  readonly engine = signal<VideoToGifEngine>('standard');
  readonly isLoading = signal(false);
  readonly isConverting = signal(false);
  readonly conversionProgress = signal(0);
  readonly conversionMessage = signal('');
  readonly errors = signal<string[]>([]);
  readonly showDropZone = signal(false);
  readonly gifPreviewUrl = signal<string | null>(null);
  readonly lastOutputSizeLabel = signal('—');

  private readonly dismissedSuggestionId = signal<string | null>(null);
  private abortController: AbortController | null = null;

  readonly hasSource = computed(() => this.sourceFile() !== null);
  readonly trimDurationSeconds = computed(() =>
    Math.max(0, this.trimEndSeconds() - this.trimStartSeconds())
  );

  readonly selectedPreset = computed(
    () => this.qualityPresets.find((p) => p.id === this.selectedPresetId()) ?? this.qualityPresets[0]
  );

  readonly effectiveFps = computed(() =>
    this.useCustomQuality() ? this.customFps() : this.selectedPreset().fps
  );

  readonly effectiveWidth = computed(() =>
    this.useCustomQuality() ? this.customWidth() : this.selectedPreset().maxWidth
  );

  readonly estimatedBytes = computed(() => {
    const video = this.previewVideo?.nativeElement;
    const height =
      video && video.videoWidth > 0
        ? Math.round((video.videoHeight / video.videoWidth) * this.effectiveWidth())
        : Math.round(this.effectiveWidth() * 0.75);
    return estimateGifBytes({
      width: this.effectiveWidth(),
      height,
      durationSeconds: this.trimDurationSeconds(),
      fps: this.effectiveFps()
    });
  });

  readonly statusLabel = computed(() => {
    if (this.isConverting()) {
      return 'Converting';
    }
    if (this.isLoading()) {
      return 'Loading';
    }
    return this.hasSource() ? 'Ready' : 'Idle';
  });

  readonly primarySuggestion = computed(() => {
    const suggestion = resolveVideoToGifSuggestion({ isComingSoon: false });
    if (!suggestion || this.dismissedSuggestionId() === suggestion.id) {
      return null;
    }
    return suggestion;
  });

  ngOnDestroy(): void {
    this.abortConversion();
    this.revokeVideoUrl();
    this.revokeGifPreviewUrl();
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId.set(suggestionId);
  }

  openFileDialog(): void {
    this.fileInput?.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      void this.handleFiles(Array.from(input.files));
      input.value = '';
    }
  }

  @HostListener('dragenter', ['$event'])
  onDragEnter(event: DragEvent): void {
    if (event.dataTransfer?.types.includes('Files')) {
      this.showDropZone.set(true);
    }
  }

  @HostListener('dragleave', ['$event'])
  onDragLeave(event: DragEvent): void {
    const currentTarget = event.currentTarget as HTMLElement | null;
    const relatedTarget = event.relatedTarget as Node | null;
    if (currentTarget && relatedTarget && !currentTarget.contains(relatedTarget)) {
      this.showDropZone.set(false);
    }
  }

  @HostListener('drop', ['$event'])
  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.showDropZone.set(false);
    const files = event.dataTransfer?.files;
    if (files?.length) {
      void this.handleFiles(Array.from(files));
    }
  }

  async handleFiles(files: File[]): Promise<void> {
    const { validFiles, errors } = validateVideoToGifFiles(files);
    if (errors.length) {
      this.errors.set(errors);
      this.toast.error(errors[0] ?? 'Invalid file');
      return;
    }
    if (!validFiles.length) {
      return;
    }
    await this.loadFile(validFiles[0]);
  }

  async loadFile(file: File): Promise<void> {
    this.isLoading.set(true);
    this.errors.set([]);
    this.dismissedSuggestionId.set(null);
    this.revokeGifPreviewUrl();
    this.revokeVideoUrl();

    const url = URL.createObjectURL(file);
    this.sourceFile.set(file);
    this.videoUrl.set(url);
    this.isLoading.set(false);

    requestAnimationFrame(() => {
      const video = this.previewVideo?.nativeElement;
      if (!video) {
        return;
      }
      video.load();
    });
  }

  onVideoLoadedMetadata(): void {
    const video = this.previewVideo?.nativeElement;
    if (!video) {
      return;
    }

    const duration = video.duration;
    this.durationSeconds.set(duration);
    this.trimStartSeconds.set(0);
    this.trimEndSeconds.set(duration);
    this.trimStartInput.set(formatTrimTimestamp(0));
    this.trimEndInput.set(formatTrimTimestamp(duration));

    if (isClipLongerThanRecommended(duration)) {
      this.toast.info(`Clip is longer than ${this.recommendedMaxSeconds}s — conversion may take a while.`);
    }
  }

  clearSource(): void {
    this.abortConversion();
    this.revokeGifPreviewUrl();
    this.revokeVideoUrl();
    this.sourceFile.set(null);
    this.durationSeconds.set(0);
    this.errors.set([]);
    this.lastOutputSizeLabel.set('—');
  }

  applyPreset(presetId: string): void {
    this.selectedPresetId.set(presetId);
    this.useCustomQuality.set(false);
    const preset = this.qualityPresets.find((p) => p.id === presetId);
    if (preset) {
      this.customFps.set(preset.fps);
      this.customWidth.set(preset.maxWidth);
    }
  }

  onTrimStartCommit(): void {
    this.commitTrimInput('start', this.trimStartInput());
  }

  onTrimEndCommit(): void {
    this.commitTrimInput('end', this.trimEndInput());
  }

  commitTrimInput(which: 'start' | 'end', value: string): void {
    const parsed = this.parseTimeInput(value);
    if (parsed == null) {
      this.toast.error('Invalid time format');
      this.syncTrimInputs();
      return;
    }

    const duration = this.durationSeconds();
    const nextStart = which === 'start' ? parsed : this.trimStartSeconds();
    const nextEnd = which === 'end' ? parsed : this.trimEndSeconds();
    const clamped = clampTrimRange(nextStart, nextEnd, duration);
    if (clamped.endSeconds - clamped.startSeconds < 0.05) {
      this.toast.error('Selection must be at least 50 ms');
      this.syncTrimInputs();
      return;
    }

    this.trimStartSeconds.set(clamped.startSeconds);
    this.trimEndSeconds.set(clamped.endSeconds);
    this.syncTrimInputs();
  }

  syncTrimInputs(): void {
    this.trimStartInput.set(formatTrimTimestamp(this.trimStartSeconds()));
    this.trimEndInput.set(formatTrimTimestamp(this.trimEndSeconds()));
  }

  private parseTimeInput(value: string): number | null {
    const trimmed = value.trim();
    if (/^\d+(\.\d+)?$/.test(trimmed)) {
      const seconds = Number(trimmed);
      return Number.isFinite(seconds) ? seconds : null;
    }
    const parts = trimmed.split(':');
    if (parts.length < 2 || parts.length > 3) {
      return null;
    }
    let hours = 0;
    let minutes = 0;
    let secondsPart = '';
    if (parts.length === 3) {
      hours = Number(parts[0]);
      minutes = Number(parts[1]);
      secondsPart = parts[2] ?? '';
    } else {
      minutes = Number(parts[0]);
      secondsPart = parts[1] ?? '';
    }
    const seconds = Number(secondsPart);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes) || !Number.isFinite(seconds)) {
      return null;
    }
    return hours * 3600 + minutes * 60 + seconds;
  }

  async convertToGif(): Promise<void> {
    const file = this.sourceFile();
    const video = this.previewVideo?.nativeElement;
    if (!file || !video || video.readyState < 1) {
      return;
    }

    this.abortConversion();
    this.abortController = new AbortController();
    this.isConverting.set(true);
    this.conversionProgress.set(0);
    this.conversionMessage.set('Starting…');
    this.revokeGifPreviewUrl();

    try {
      const result = await convertVideoToGif({
        video,
        sourceFile: file,
        trimStartSeconds: this.trimStartSeconds(),
        trimEndSeconds: this.trimEndSeconds(),
        fps: this.effectiveFps(),
        maxWidth: this.effectiveWidth(),
        loopCount: this.loopCount(),
        reverse: this.reversePlayback(),
        engine: this.engine(),
        gifScriptUrl: this.assetService.getAssetPath('gif.js/gif.js'),
        gifWorkerUrl: this.assetService.getAssetPath('gif.js/gif.worker.js'),
        ffmpegScriptUrl: this.assetService.getAssetPath('ffmpeg/ffmpeg.js'),
        signal: this.abortController.signal,
        onProgress: (progress, message) => {
          this.conversionProgress.set(Math.round(progress * 100));
          if (message) {
            this.conversionMessage.set(message);
          }
        }
      });

      const previewUrl = URL.createObjectURL(result.blob);
      this.gifPreviewUrl.set(previewUrl);
      this.lastOutputSizeLabel.set(formatVideoToGifFileSize(result.blob.size));
      this.toast.success(
        `GIF ready (${result.frameCount} frames · ${result.engine === 'hq' ? 'HQ' : 'Standard'})`
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        this.toast.info('Conversion cancelled');
      } else {
        const message = error instanceof Error ? error.message : 'Conversion failed';
        this.toast.error(message);
      }
    } finally {
      this.isConverting.set(false);
      this.abortController = null;
    }
  }

  cancelConversion(): void {
    this.abortConversion();
    this.isConverting.set(false);
    this.conversionMessage.set('');
    this.conversionProgress.set(0);
  }

  downloadGif(): void {
    const url = this.gifPreviewUrl();
    const file = this.sourceFile();
    if (!url || !file) {
      return;
    }
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = buildGifFileName(file.name);
    anchor.click();
  }

  formatFileSize(bytes: number): string {
    return formatVideoToGifFileSize(bytes);
  }

  formatTime(seconds: number): string {
    return formatTrimTimestamp(seconds);
  }

  formatEstimate(bytes: number): string {
    return formatVideoToGifFileSize(bytes);
  }

  private abortConversion(): void {
    this.abortController?.abort();
    this.abortController = null;
  }

  private revokeVideoUrl(): void {
    const url = this.videoUrl();
    if (url) {
      URL.revokeObjectURL(url);
    }
    this.videoUrl.set(null);
  }

  private revokeGifPreviewUrl(): void {
    const url = this.gifPreviewUrl();
    if (url) {
      URL.revokeObjectURL(url);
    }
    this.gifPreviewUrl.set(null);
  }
}
