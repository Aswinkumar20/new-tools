/** Contextual cross-tool recommendation shown inside a text-utilities tool. */
export interface TuToolSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  path: string;
}

/** Static related-tool link for options / discovery panels. */
export interface TuRelatedToolLink {
  label: string;
  path: string;
  description: string;
}
