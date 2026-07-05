import { ChangeDetectionStrategy, Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Navigation, TooltipDirective, AssetService } from '@tools-workspace/features-home';

interface Recording {
  id: string;
  audioUrl: string;
  blob: Blob;
  duration: number;
  timestamp: number;
  size: number;
}

@Component({
  selector: 'lib-voice-recorder',
  standalone: true,
  templateUrl: './voice-recorder.html',
  styleUrls: ['./voice-recorder.scss'],
  imports: [CommonModule, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VoiceRecorderComponent implements OnDestroy {
  readonly assetService = inject(AssetService);
  readonly isRecording = signal(false);
  readonly isPaused = signal(false);
  readonly isPlaying = signal(false);
  readonly currentRecording = signal<Recording | null>(null);
  readonly recordings = signal<Recording[]>([]);
  readonly errors = signal<string[]>([]);
  readonly elapsedTime = signal<number>(0);
  readonly audioLevel = signal<number>(0);

  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private microphone: MediaStreamAudioSourceNode | null = null;
  private stream: MediaStream | null = null;
  private startTime: number = 0;
  private timerInterval: number | null = null;
  private animationFrame: number | null = null;
  private audioElement: HTMLAudioElement | null = null;

  readonly hasRecordings = computed(() => this.recordings().length > 0);
  readonly hasCurrentRecording = computed(() => this.currentRecording() !== null);
  readonly formattedTime = computed(() => this.formatTime(this.elapsedTime()));

  readonly statusLabel = computed(() => {
    if (this.isRecording()) {
      return this.isPaused() ? 'Paused' : 'Recording';
    }
    if (this.isPlaying()) {
      return 'Playing';
    }
    return 'Ready';
  });

  readonly stats = computed(() => {
    const recordings = this.recordings();
    if (recordings.length === 0) {
      return { count: 0, totalDuration: 0, totalSize: 0 };
    }

    const totalDuration = recordings.reduce((sum, r) => sum + r.duration, 0);
    const totalSize = recordings.reduce((sum, r) => sum + r.size, 0);

    return {
      count: recordings.length,
      totalDuration,
      totalSize,
      averageDuration: totalDuration / recordings.length
    };
  });

  async startRecording(): Promise<void> {
    this.errors.set([]);

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(this.stream);
      this.audioChunks = [];

      // Setup audio visualization
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.microphone = this.audioContext.createMediaStreamSource(this.stream);
      this.microphone.connect(this.analyser);

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        this.finishRecording();
      };

      this.mediaRecorder.start();
      this.isRecording.set(true);
      this.isPaused.set(false);
      this.startTime = Date.now();
      this.elapsedTime.set(0);

      this.startTimer();
      this.startAudioVisualization();
    } catch (error) {
      this.errors.set([error instanceof Error ? error.message : 'Failed to access microphone.']);
    }
  }

  stopRecording(): void {
    if (this.mediaRecorder && this.isRecording()) {
      this.mediaRecorder.stop();
      this.stopTimer();
      this.stopAudioVisualization();
      this.cleanupStream();
    }
  }

  pauseRecording(): void {
    if (this.mediaRecorder && this.isRecording() && !this.isPaused()) {
      this.mediaRecorder.pause();
      this.isPaused.set(true);
      this.stopTimer();
      this.stopAudioVisualization();
    }
  }

  resumeRecording(): void {
    if (this.mediaRecorder && this.isRecording() && this.isPaused()) {
      this.mediaRecorder.resume();
      this.isPaused.set(false);
      this.startTimer();
      this.startAudioVisualization();
    }
  }

  private finishRecording(): void {
    const blob = new Blob(this.audioChunks, { type: 'audio/webm' });
    const audioUrl = URL.createObjectURL(blob);
    const duration = this.elapsedTime();

    const recording: Recording = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      audioUrl,
      blob,
      duration,
      timestamp: Date.now(),
      size: blob.size
    };

    this.currentRecording.set(recording);
    this.recordings.update((recordings) => [recording, ...recordings].slice(0, 20));
    this.isRecording.set(false);
    this.isPaused.set(false);
  }

  private cleanupStream(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    if (this.microphone) {
      this.microphone.disconnect();
      this.microphone = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.analyser = null;
  }

  private startTimer(): void {
    this.timerInterval = window.setInterval(() => {
      if (!this.isPaused()) {
        this.elapsedTime.set((Date.now() - this.startTime) / 1000);
      } else {
        this.startTime = Date.now() - this.elapsedTime() * 1000;
      }
    }, 100);
  }

  private stopTimer(): void {
    if (this.timerInterval !== null) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  private startAudioVisualization(): void {
    if (!this.analyser) {
      return;
    }

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);

    const updateLevel = () => {
      if (!this.analyser || !this.isRecording() || this.isPaused()) {
        this.audioLevel.set(0);
        return;
      }

      this.analyser.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((sum, val) => sum + val, 0) / dataArray.length;
      this.audioLevel.set(average / 255);

      this.animationFrame = requestAnimationFrame(updateLevel);
    };

    updateLevel();
  }

  private stopAudioVisualization(): void {
    if (this.animationFrame !== null) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    this.audioLevel.set(0);
  }

  playRecording(recording: Recording): void {
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement = null;
    }

    this.audioElement = new Audio(recording.audioUrl);
    this.audioElement.onplay = () => this.isPlaying.set(true);
    this.audioElement.onpause = () => this.isPlaying.set(false);
    this.audioElement.onended = () => {
      this.isPlaying.set(false);
      this.audioElement = null;
    };

    this.currentRecording.set(recording);
    this.audioElement.play();
  }

  stopPlayback(): void {
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.currentTime = 0;
      this.audioElement = null;
      this.isPlaying.set(false);
    }
  }

  downloadRecording(recording: Recording): void {
    const link = document.createElement('a');
    link.href = recording.audioUrl;
    link.download = `recording-${recording.timestamp}.webm`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  deleteRecording(id: string): void {
    const recording = this.recordings().find((r) => r.id === id);
    if (recording) {
      URL.revokeObjectURL(recording.audioUrl);
    }

    this.recordings.update((recordings) => recordings.filter((r) => r.id !== id));

    if (this.currentRecording()?.id === id) {
      this.stopPlayback();
      this.currentRecording.set(null);
    }
  }

  clearAllRecordings(): void {
    this.recordings().forEach((recording) => {
      URL.revokeObjectURL(recording.audioUrl);
    });
    this.recordings.set([]);
    this.stopPlayback();
    this.currentRecording.set(null);
  }

  formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes} B`;
    } else if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    } else {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
  }

  formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleString();
  }

  ngOnDestroy(): void {
    this.stopRecording();
    this.stopPlayback();
    this.cleanupStream();
    this.stopTimer();
    this.stopAudioVisualization();
    this.recordings().forEach((recording) => {
      URL.revokeObjectURL(recording.audioUrl);
    });
  }
}
