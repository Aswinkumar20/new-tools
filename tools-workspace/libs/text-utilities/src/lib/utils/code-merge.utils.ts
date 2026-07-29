import type { TuToolSuggestion } from '../shared/tu-tool-suggestion.model';
import {
  CODE_MERGE_DEFAULT_BASE_LABEL,
  CODE_MERGE_DEFAULT_INCOMING_LABEL
} from '../constants/code-merge.constants';
import type {
  CodeMergeOptions,
  CodeMergeSuggestionContext
} from '../types/code-merge.types';

export function countCodeMergeLines(text: string): number {
  return text ? text.split('\n').length : 0;
}

export function buildCodeMergePreview(options: CodeMergeOptions): string {
  const left = options.leftBranch ?? '';
  const right = options.rightBranch ?? '';
  if (!left && !right) {
    return '';
  }

  if (options.includeConflictMarkers) {
    return [
      `<<<<<<< ${options.baseLabel || CODE_MERGE_DEFAULT_BASE_LABEL}`,
      left,
      '=======',
      right,
      `>>>>>>> ${options.incomingLabel || CODE_MERGE_DEFAULT_INCOMING_LABEL}`
    ].join('\n');
  }

  return `${left}\n${right}`.trim();
}

export function resolveCodeMergeSuggestion(
  context: CodeMergeSuggestionContext
): TuToolSuggestion | null {
  const { hasLeft, hasRight, hasMerged, includeConflictMarkers, branchesIdentical } =
    context;

  if (!hasLeft && !hasRight) {
    return {
      id: 'cm-get-started',
      title: 'Build a merge preview?',
      reason:
        'Paste base content on the left and incoming changes on the right, then click Merge.',
      actionLabel: 'Open Text Difference',
      path: '/text-utilities/text-difference'
    };
  }

  if (hasLeft !== hasRight) {
    return {
      id: 'cm-one-side',
      title: 'Only one branch has content',
      reason:
        'Add the missing side so the preview includes both base and incoming changes, or merge anyway to wrap a single pane.',
      actionLabel: 'Open Text Difference',
      path: '/text-utilities/text-difference'
    };
  }

  if (branchesIdentical && hasLeft && hasRight) {
    return {
      id: 'cm-identical',
      title: 'Both branches look identical',
      reason:
        'No textual difference between panes. Use Text Difference to confirm whitespace-only changes, or skip markers and concatenate.',
      actionLabel: 'Open Text Difference',
      path: '/text-utilities/text-difference'
    };
  }

  if (hasMerged && includeConflictMarkers) {
    return {
      id: 'cm-markers',
      title: 'Conflict markers ready to copy',
      reason:
        'Paste into your editor to resolve manually. Diff first if you need change locations, then Find & Replace to strip markers.',
      actionLabel: 'Open Find and Replace',
      path: '/text-utilities/find-and-replace'
    };
  }

  if (hasMerged && !includeConflictMarkers) {
    return {
      id: 'cm-concat',
      title: 'Branches concatenated',
      reason:
        'Markers are off — output is left then right. Diff the originals if you still need to reconcile overlapping edits.',
      actionLabel: 'Open Text Difference',
      path: '/text-utilities/text-difference'
    };
  }

  return {
    id: 'cm-ready',
    title: 'Ready to merge',
    reason: 'Click Merge to generate a preview. Adjust labels and markers in the sidebar anytime.',
    actionLabel: 'Open Sort Lines',
    path: '/text-utilities/sort-lines'
  };
}
