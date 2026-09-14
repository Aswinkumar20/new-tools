import { Component, inject } from '@angular/core';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  Navigation,
  TooltipDirective,
  AssetService,
} from '@tools-workspace/features-home';
import { TextToolProcessingHost } from '../../shared/text-tool-processing-host';
import { TextToolProcessingOverlayComponent } from '../../shared/text-tool-processing-overlay.component';
import type { TuRelatedToolLink, TuToolSuggestion } from '../../shared/tu-tool-suggestion.model';
import { tuCopyText } from '../../shared/tu-clipboard.util';
import {
  CODE_MERGE_DEFAULT_BASE_LABEL,
  CODE_MERGE_DEFAULT_INCOMING_LABEL,
  CODE_MERGE_DEFAULT_INCLUDE_MARKERS,
  CODE_MERGE_RELATED_TOOLS
} from '../../constants/code-merge.constants';
import {
  buildCodeMergePreview,
  countCodeMergeLines,
  resolveCodeMergeSuggestion
} from '../../utils/code-merge.utils';

@Component({
  selector: 'lib-code-merge',
  standalone: true,
  templateUrl: './code-merge.html',
  styleUrls: ['./code-merge.scss'],
  imports: [FormsModule, CommonModule, RouterLink, Navigation, ReactiveFormsModule, TooltipDirective, TextToolProcessingOverlayComponent]
})
export class CodeMergeComponent extends TextToolProcessingHost {
  readonly assetService = inject(AssetService);

  readonly relatedTools: ReadonlyArray<TuRelatedToolLink> = CODE_MERGE_RELATED_TOOLS;

  leftBranch = '';
  rightBranch = '';
  baseLabel = CODE_MERGE_DEFAULT_BASE_LABEL;
  incomingLabel = CODE_MERGE_DEFAULT_INCOMING_LABEL;
  includeConflictMarkers = CODE_MERGE_DEFAULT_INCLUDE_MARKERS;
  mergedPreview = '';
  private dismissedSuggestionId: string | null = null;

  get hasLeft(): boolean {
    return !!this.leftBranch;
  }

  get hasRight(): boolean {
    return !!this.rightBranch;
  }

  get hasMerged(): boolean {
    return !!this.mergedPreview;
  }

  get leftLineCount(): number {
    return countCodeMergeLines(this.leftBranch);
  }

  get rightLineCount(): number {
    return countCodeMergeLines(this.rightBranch);
  }

  get primarySuggestion(): TuToolSuggestion | null {
    const suggestion = resolveCodeMergeSuggestion({
      hasLeft: this.hasLeft,
      hasRight: this.hasRight,
      hasMerged: this.hasMerged,
      includeConflictMarkers: this.includeConflictMarkers,
      branchesIdentical: this.hasLeft && this.hasRight && this.leftBranch === this.rightBranch
    });
    if (!suggestion || this.dismissedSuggestionId === suggestion.id) {
      return null;
    }
    return suggestion;
  }

  merge(): void {
    this.dismissedSuggestionId = null;
    const totalLen = this.leftBranch.length + this.rightBranch.length;
    this.scheduleDebouncedWork(() => {
      this.mergedPreview = buildCodeMergePreview({
        leftBranch: this.leftBranch,
        rightBranch: this.rightBranch,
        baseLabel: this.baseLabel,
        incomingLabel: this.incomingLabel,
        includeConflictMarkers: this.includeConflictMarkers
      });
    }, totalLen);
  }

  clear(): void {
    this.cancelInFlightOperations();
    this.leftBranch = '';
    this.rightBranch = '';
    this.mergedPreview = '';
    this.dismissedSuggestionId = null;
    this.toastService.info('Cleared');
  }

  async copyLeft(): Promise<void> {
    await tuCopyText(this.toastService, this.leftBranch, 'Left branch');
  }

  async copyRight(): Promise<void> {
    await tuCopyText(this.toastService, this.rightBranch, 'Right branch');
  }

  async copyMerged(): Promise<void> {
    await tuCopyText(this.toastService, this.mergedPreview, 'Merged preview');
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId = suggestionId;
  }

  onBranchInput(): void {
    this.dismissedSuggestionId = null;
  }
}
