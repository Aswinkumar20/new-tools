/** Contextual cross-tool recommendation shown inside a browser-utils tool. */
export interface BuToolSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  path: string;
}

/** Static related-tool link for options / discovery panels. */
export interface BuRelatedToolLink {
  label: string;
  path: string;
  description: string;
}
