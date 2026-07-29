/** Planned audio container formats for the upcoming trimmer. */
export interface AudioTrimmerPlannedFormat {
  extension: string;
  mimeHint: string;
  label: string;
}

/** Planned export targets once trimming ships. */
export interface AudioTrimmerExportFormat {
  id: string;
  label: string;
  extension: string;
}

/** Roadmap checklist item shown on the coming-soon sidebar. */
export interface AudioTrimmerRoadmapItem {
  id: string;
  label: string;
}

export interface AudioTrimmerInfoItem {
  accent?: boolean;
  text: string;
}

export interface AudioTrimmerStatus {
  isComingSoon: true;
  plannedFormatCount: number;
  plannedExportCount: number;
}
