/** Contextual cross-tool recommendation shown inside a media-tools tool. */
export interface MtToolSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  path: string;
}

/** Static related-tool link for options / discovery panels. */
export interface MtRelatedToolLink {
  label: string;
  path: string;
  description: string;
}
