/** Contextual cross-tool recommendation shown inside an image-color tool. */
export interface IctToolSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  path: string;
}

/** Static related-tool link for options / discovery panels. */
export interface IctRelatedToolLink {
  label: string;
  path: string;
  description: string;
}
