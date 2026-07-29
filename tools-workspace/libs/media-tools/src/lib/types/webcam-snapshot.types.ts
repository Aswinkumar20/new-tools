export interface WebcamSnapshotRoadmapItem {
  id: string;
  label: string;
}

export interface WebcamSnapshotInfoItem {
  accent?: boolean;
  text: string;
}

export interface WebcamSnapshotExportFormat {
  id: string;
  label: string;
  mimeType: string;
  extension: string;
}

export interface WebcamSnapshotCountdownOption {
  seconds: number;
  label: string;
}

export interface WebcamSnapshotStatus {
  isComingSoon: true;
  plannedExportCount: number;
}
