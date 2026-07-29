/** Contextual cross-tool recommendation shown inside a file-viewer tool. */
export interface FvToolSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  path: string;
}

/** Static related-tool link for options / discovery panels. */
export interface FvRelatedToolLink {
  label: string;
  path: string;
  description: string;
}
