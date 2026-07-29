export interface CodeMergeOptions {
  leftBranch: string;
  rightBranch: string;
  baseLabel: string;
  incomingLabel: string;
  includeConflictMarkers: boolean;
}

export interface CodeMergeSuggestionContext {
  hasLeft: boolean;
  hasRight: boolean;
  hasMerged: boolean;
  includeConflictMarkers: boolean;
  branchesIdentical: boolean;
}
