/** Contextual cross-tool recommendation shown inside a code-file-tools tool. */
export interface CftToolSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  path: string;
}

/** Static related-tool link for options / discovery panels. */
export interface CftRelatedToolLink {
  label: string;
  path: string;
  description: string;
}
