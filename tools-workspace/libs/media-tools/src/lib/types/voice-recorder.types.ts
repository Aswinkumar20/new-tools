export interface VoiceRecording {
  id: string;
  audioUrl: string;
  blob: Blob;
  duration: number;
  timestamp: number;
  size: number;
}

export interface VoiceRecorderStats {
  count: number;
  totalDuration: number;
  totalSize: number;
  averageDuration?: number;
}

export interface VoiceRecorderSuggestionContext {
  hasRecordings: boolean;
  hasError: boolean;
  isRecording: boolean;
  errorMessage: string | null;
}
