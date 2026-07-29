/** Contextual cross-tool recommendation shown inside a data-converter tool. */
export interface DcToolSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  path: string;
}

/** Static related-tool link for options / discovery panels. */
export interface DcRelatedToolLink {
  label: string;
  path: string;
  description: string;
}
