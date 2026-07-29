/** Contextual cross-tool recommendation shown inside a fun-tools tool. */
export interface FtToolSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  path: string;
}

/** Static related-tool link for options / discovery panels. */
export interface FtRelatedToolLink {
  label: string;
  path: string;
  description: string;
}
