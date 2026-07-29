/** Contextual cross-tool recommendation shown inside a dev-design tool. */
export interface DdToolSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  path: string;
}

/** Static related-tool link for options / discovery panels. */
export interface DdRelatedToolLink {
  label: string;
  path: string;
  description: string;
}
