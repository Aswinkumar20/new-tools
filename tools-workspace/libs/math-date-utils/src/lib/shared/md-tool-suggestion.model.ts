/** Contextual cross-tool recommendation shown inside a math-date-utils tool. */
export interface MdToolSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  path: string;
}

/** Static related-tool link for options / discovery panels. */
export interface MdRelatedToolLink {
  label: string;
  path: string;
  description: string;
}
