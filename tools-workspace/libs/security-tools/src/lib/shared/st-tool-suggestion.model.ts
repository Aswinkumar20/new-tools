/** Contextual cross-tool recommendation shown inside a security-tools tool. */
export interface StToolSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  path: string;
}

/** Static related-tool link for options / discovery panels. */
export interface StRelatedToolLink {
  label: string;
  path: string;
  description: string;
}
