/** Planned video container formats for Video to GIF. */
export interface VideoToGifPlannedFormat {
  extension: string;
  mimeHint: string;
  label: string;
}

/** Roadmap checklist item shown on the coming-soon sidebar. */
export interface VideoToGifRoadmapItem {
  id: string;
  label: string;
}

export interface VideoToGifInfoItem {
  accent?: boolean;
  text: string;
}

/** Planned GIF quality presets once conversion ships. */
export interface VideoToGifQualityPreset {
  id: string;
  label: string;
  fps: number;
  maxWidth: number;
}

export interface VideoToGifStatus {
  isComingSoon: true;
  plannedFormatCount: number;
  recommendedMaxSeconds: number;
}
