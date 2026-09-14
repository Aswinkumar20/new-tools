import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
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
  WEBCAM_SNAPSHOT_ACCEPT_HINT,
  WEBCAM_SNAPSHOT_COUNTDOWN_OPTIONS,
  WEBCAM_SNAPSHOT_DESCRIPTION,
  WEBCAM_SNAPSHOT_EXPORT_FORMATS,
  WEBCAM_SNAPSHOT_HELP_ITEMS,
  WEBCAM_SNAPSHOT_INFO_ITEMS,
  WEBCAM_SNAPSHOT_RELATED_TOOLS,
  WEBCAM_SNAPSHOT_TITLE,
  WEBCAM_SNAPSHOT_UPLOAD_LABEL
} from '../../constants/webcam-snapshot.constants';
import type {
  WebcamSnapshotExportFormat,
  WebcamSnapshotInfoItem
} from '../../types/webcam-snapshot.types';
import {
  buildWebcamSnapshotFileName,
  canvasToSnapshotBlob,
  isSecureContextForCamera,
  mapCameraAccessError,
  resolveWebcamSnapshotSuggestion
} from '../../utils/webcam-snapshot.utils';

@Component({
  selector: 'lib-webcam-snapshot',
  standalone: true,
  templateUrl: './webcam-snapshot.html',
  styleUrls: ['./webcam-snapshot.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WebcamSnapshotComponent implements OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);

  @ViewChild('previewVideo') previewVideo?: ElementRef<HTMLVideoElement>;
  @ViewChild('captureCanvas') captureCanvas?: ElementRef<HTMLCanvasElement>;

  readonly title = WEBCAM_SNAPSHOT_TITLE;
  readonly description = WEBCAM_SNAPSHOT_DESCRIPTION;
  readonly uploadLabel = WEBCAM_SNAPSHOT_UPLOAD_LABEL;
  readonly acceptHint = WEBCAM_SNAPSHOT_ACCEPT_HINT;
  readonly helpItems = WEBCAM_SNAPSHOT_HELP_ITEMS;
  readonly infoItems: ReadonlyArray<WebcamSnapshotInfoItem> = WEBCAM_SNAPSHOT_INFO_ITEMS;
  readonly relatedTools: ReadonlyArray<MtRelatedToolLink> = WEBCAM_SNAPSHOT_RELATED_TOOLS;
  readonly exportFormats = WEBCAM_SNAPSHOT_EXPORT_FORMATS;
  readonly countdownOptions = WEBCAM_SNAPSHOT_COUNTDOWN_OPTIONS;

  readonly isCameraActive = signal(false);
  readonly isCapturing = signal(false);
  readonly countdownValue = signal<number | null>(null);
  readonly errorMessage = signal('');
  readonly mirrorPreview = signal(true);
  readonly selectedDeviceId = signal('');
  readonly selectedFormatId = signal(WEBCAM_SNAPSHOT_EXPORT_FORMATS[0].id);
  readonly selectedCountdown = signal(WEBCAM_SNAPSHOT_COUNTDOWN_OPTIONS[0].seconds);
  readonly availableDevices = signal<MediaDeviceInfo[]>([]);
  readonly lastSnapshotUrl = signal<string | null>(null);
  readonly snapshotCount = signal(0);

  private stream: MediaStream | null = null;
  private countdownTimer: ReturnType<typeof setInterval> | null = null;
  private readonly dismissedSuggestionId = signal<string | null>(null);

  readonly statusLabel = computed(() => {
    if (this.countdownValue() !== null) {
      return `Capturing in ${this.countdownValue()}…`;
    }
    if (this.isCapturing()) {
      return 'Capturing…';
    }
    return this.isCameraActive() ? 'Live' : 'Idle';
  });

  readonly selectedFormat = computed(
    () =>
      this.exportFormats.find((f) => f.id === this.selectedFormatId()) ??
      WEBCAM_SNAPSHOT_EXPORT_FORMATS[0]
  );

  readonly primarySuggestion = computed(() => {
    const suggestion = resolveWebcamSnapshotSuggestion({ isComingSoon: false });
    if (!suggestion || this.dismissedSuggestionId() === suggestion.id) {
      return null;
    }
    return suggestion;
  });

  ngOnDestroy(): void {
    this.stopCountdown();
    this.stopCamera();
    this.revokeSnapshotUrl();
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId.set(suggestionId);
  }

  async startCamera(): Promise<void> {
    this.errorMessage.set('');
    this.dismissedSuggestionId.set(null);

    if (!isSecureContextForCamera()) {
      this.errorMessage.set('Camera access requires HTTPS or localhost.');
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      this.errorMessage.set('Camera access is not supported in this browser.');
      return;
    }

    try {
      await this.enumerateDevices();
      const deviceId = this.selectedDeviceId();
      this.stopCamera();

      const constraints: MediaStreamConstraints = {
        video: deviceId ? { deviceId: { exact: deviceId } } : true,
        audio: false
      };

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.isCameraActive.set(true);

      const video = this.previewVideo?.nativeElement;
      if (video) {
        video.srcObject = this.stream;
        await video.play();
      }
    } catch (error) {
      this.errorMessage.set(mapCameraAccessError(error));
      this.isCameraActive.set(false);
    }
  }

  stopCamera(): void {
    if (this.stream) {
      for (const track of this.stream.getTracks()) {
        track.stop();
      }
      this.stream = null;
    }

    const video = this.previewVideo?.nativeElement;
    if (video) {
      video.srcObject = null;
    }

    this.isCameraActive.set(false);
  }

  async refreshDevices(): Promise<void> {
    await this.enumerateDevices();
    this.toast.info('Camera list refreshed.');
  }

  toggleMirror(): void {
    this.mirrorPreview.update((value) => !value);
  }

  captureSnapshot(): void {
    if (!this.isCameraActive() || this.isCapturing()) {
      return;
    }

    const seconds = this.selectedCountdown();
    if (seconds <= 0) {
      void this.performCapture();
      return;
    }

    this.stopCountdown();
    this.countdownValue.set(seconds);
    this.countdownTimer = setInterval(() => {
      const current = this.countdownValue();
      if (current === null || current <= 1) {
        this.stopCountdown();
        void this.performCapture();
        return;
      }
      this.countdownValue.set(current - 1);
    }, 1000);
  }

  downloadLastSnapshot(): void {
    const url = this.lastSnapshotUrl();
    if (!url) {
      return;
    }

    const link = document.createElement('a');
    link.href = url;
    link.download = buildWebcamSnapshotFileName(Date.now(), this.selectedFormat());
    link.click();
    this.toast.info('Snapshot downloaded.');
  }

  clearLastSnapshot(): void {
    this.revokeSnapshotUrl();
    this.toast.info('Preview cleared.');
  }

  private async enumerateDevices(): Promise<void> {
    if (!navigator.mediaDevices?.enumerateDevices) {
      return;
    }

    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoInputs = devices.filter((device) => device.kind === 'videoinput');
    this.availableDevices.set(videoInputs);

    if (videoInputs.length > 0 && !this.selectedDeviceId()) {
      this.selectedDeviceId.set(videoInputs[0].deviceId);
    }
  }

  private stopCountdown(): void {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
    this.countdownValue.set(null);
  }

  private async performCapture(): Promise<void> {
    const video = this.previewVideo?.nativeElement;
    const canvas = this.captureCanvas?.nativeElement;
    if (!video || !canvas || video.videoWidth === 0) {
      this.errorMessage.set('Camera preview is not ready yet.');
      return;
    }

    this.isCapturing.set(true);

    try {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Canvas is unavailable.');
      }

      if (this.mirrorPreview()) {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      ctx.setTransform(1, 0, 0, 1, 0, 0);

      const format = this.selectedFormat();
      const blob = await canvasToSnapshotBlob(canvas, format);
      if (!blob) {
        throw new Error('Failed to encode snapshot.');
      }

      this.revokeSnapshotUrl();
      const url = URL.createObjectURL(blob);
      this.lastSnapshotUrl.set(url);
      this.snapshotCount.update((count) => count + 1);
      this.toast.info('Snapshot captured.');
    } catch (error) {
      this.errorMessage.set(error instanceof Error ? error.message : 'Capture failed.');
    } finally {
      this.isCapturing.set(false);
    }
  }

  private revokeSnapshotUrl(): void {
    const url = this.lastSnapshotUrl();
    if (url) {
      URL.revokeObjectURL(url);
    }
    this.lastSnapshotUrl.set(null);
  }
}
