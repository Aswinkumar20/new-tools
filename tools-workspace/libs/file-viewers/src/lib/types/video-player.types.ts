/** Planned video container formats for the upcoming player. */
export interface VideoPlannedFormat {
  extension: string;
  mimeHint: string;
  label: string;
}

/** Roadmap checklist item shown on the coming-soon sidebar. */
export interface VideoRoadmapItem {
  id: string;
  label: string;
}

export interface VideoPlayerStatus {
  isComingSoon: true;
  plannedFormatCount: number;
}
