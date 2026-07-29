import {
  CODE_MERGE_DEFAULT_BASE_LABEL,
  CODE_MERGE_DEFAULT_INCOMING_LABEL
} from '../constants/code-merge.constants';
import {
  buildCodeMergePreview,
  countCodeMergeLines,
  resolveCodeMergeSuggestion
} from './code-merge.utils';

describe('code-merge.utils', () => {
  it('counts lines including empty trailing lines', () => {
    expect(countCodeMergeLines('')).toBe(0);
    expect(countCodeMergeLines('a')).toBe(1);
    expect(countCodeMergeLines('a\nb\n')).toBe(3);
  });

  it('builds conflict-marker preview with default labels', () => {
    const preview = buildCodeMergePreview({
      leftBranch: 'left',
      rightBranch: 'right',
      baseLabel: '',
      incomingLabel: '',
      includeConflictMarkers: true
    });
    expect(preview).toBe(
      [
        `<<<<<<< ${CODE_MERGE_DEFAULT_BASE_LABEL}`,
        'left',
        '=======',
        'right',
        `>>>>>>> ${CODE_MERGE_DEFAULT_INCOMING_LABEL}`
      ].join('\n')
    );
  });

  it('concatenates without markers and trims', () => {
    expect(
      buildCodeMergePreview({
        leftBranch: 'a\n',
        rightBranch: 'b',
        baseLabel: 'HEAD',
        incomingLabel: 'Incoming',
        includeConflictMarkers: false
      })
    ).toBe('a\n\nb');
  });

  it('returns empty preview when both sides are empty', () => {
    expect(
      buildCodeMergePreview({
        leftBranch: '',
        rightBranch: '',
        baseLabel: 'HEAD',
        incomingLabel: 'Incoming',
        includeConflictMarkers: true
      })
    ).toBe('');
  });

  it('resolves contextual suggestions', () => {
    expect(
      resolveCodeMergeSuggestion({
        hasLeft: false,
        hasRight: false,
        hasMerged: false,
        includeConflictMarkers: true,
        branchesIdentical: false
      })?.id
    ).toBe('cm-get-started');

    expect(
      resolveCodeMergeSuggestion({
        hasLeft: true,
        hasRight: false,
        hasMerged: false,
        includeConflictMarkers: true,
        branchesIdentical: false
      })?.id
    ).toBe('cm-one-side');

    expect(
      resolveCodeMergeSuggestion({
        hasLeft: true,
        hasRight: true,
        hasMerged: false,
        includeConflictMarkers: true,
        branchesIdentical: true
      })?.id
    ).toBe('cm-identical');

    expect(
      resolveCodeMergeSuggestion({
        hasLeft: true,
        hasRight: true,
        hasMerged: true,
        includeConflictMarkers: true,
        branchesIdentical: false
      })?.id
    ).toBe('cm-markers');

    expect(
      resolveCodeMergeSuggestion({
        hasLeft: true,
        hasRight: true,
        hasMerged: true,
        includeConflictMarkers: false,
        branchesIdentical: false
      })?.id
    ).toBe('cm-concat');
  });
});
