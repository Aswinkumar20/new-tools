/** Contextual cross-tool recommendation shown inside a testing-tools tool. */
export interface TtToolSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  path: string;
}

/** Static related-tool link for options / discovery panels. */
export interface TtRelatedToolLink {
  label: string;
  path: string;
  description: string;
}
