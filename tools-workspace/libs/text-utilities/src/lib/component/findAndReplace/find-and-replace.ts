import { Component } from '@angular/core';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Navigation, TooltipDirective } from '@tools-workspace/features-home';
import { TextToolBase } from '../../shared/text-tool-base';
import { TextToolProcessingOverlayComponent } from '../../shared/text-tool-processing-overlay.component';
import type { TuRelatedToolLink, TuToolSuggestion } from '../../shared/tu-tool-suggestion.model';
import {
  FIND_AND_REPLACE_DEFAULT_OPTIONS,
  FIND_AND_REPLACE_RELATED_TOOLS,
  FIND_AND_REPLACE_SHOW_OPTIONS_DEFAULT
} from '../../constants/find-and-replace.constants';
import {
  applyFindAndReplace,
  resolveFindAndReplaceSuggestion
} from '../../utils/find-and-replace.utils';

export type FarReplaceStatus = 'idle' | 'preview' | 'applied' | 'no-match' | 'pass-through' | 'error';

@Component({
  selector: 'lib-find-and-replace',
  standalone: true,
  templateUrl: './find-and-replace.html',
  styleUrls: ['./find-and-replace.scss'],
  imports: [FormsModule, CommonModule, RouterLink, Navigation, ReactiveFormsModule, TooltipDirective, TextToolProcessingOverlayComponent]
})
export class FindAndReplaceComponent extends TextToolBase {
  findText = '';
  replaceText = '';
  useRegex = FIND_AND_REPLACE_DEFAULT_OPTIONS.useRegex;
  caseSensitive = FIND_AND_REPLACE_DEFAULT_OPTIONS.caseSensitive;
  replaceAll = FIND_AND_REPLACE_DEFAULT_OPTIONS.replaceAll;
  showOptionsPanel = FIND_AND_REPLACE_SHOW_OPTIONS_DEFAULT;
  replaceApplied = false;
  lastAppliedMatchCount = 0;

  readonly relatedTools: ReadonlyArray<TuRelatedToolLink> = FIND_AND_REPLACE_RELATED_TOOLS;
  private matchCount = 0;
  private dismissedSuggestionId: string | null = null;

  get displayMatchCount(): number {
    return this.matchCount;
  }

  get canApplyReplace(): boolean {
    return (
      this.hasInput &&
      !!this.findText.trim() &&
      !this.errorMessage &&
      this.matchCount > 0 &&
      !this.isProcessing
    );
  }

  get replaceStatus(): FarReplaceStatus {
    if (this.errorMessage) return 'error';
    if (this.replaceApplied) return 'applied';
    if (!this.hasInput || !this.findText.trim()) {
      return this.hasInput ? 'pass-through' : 'idle';
    }
    if (this.matchCount === 0) return 'no-match';
    return 'preview';
  }

  get outputStatusLabel(): string {
    switch (this.replaceStatus) {
      case 'applied':
        return `Applied · ${this.lastAppliedMatchCount} replaced`;
      case 'preview':
        return `Preview · ${this.matchCount} match${this.matchCount === 1 ? '' : 'es'}`;
      case 'no-match':
        return 'No matches';
      case 'pass-through':
        return 'Unchanged';
      case 'error':
        return 'Error';
      default:
        return 'Waiting';
    }
  }

  get showPreviewOutput(): boolean {
    return this.hasInput && !this.errorMessage;
  }

  get primarySuggestion(): TuToolSuggestion | null {
    const suggestion = resolveFindAndReplaceSuggestion({
      hasInput: this.hasInput,
      hasFindText: !!this.findText,
      hasOutput: this.hasOutput,
      errorMessage: this.errorMessage,
      matchCount: this.matchCount,
      useRegex: this.useRegex,
      outputUnchanged: this.hasOutput && this.outputText === this.inputText,
      replaceApplied: this.replaceApplied,
      appliedMatchCount: this.lastAppliedMatchCount
    });
    if (!suggestion || this.dismissedSuggestionId === suggestion.id) {
      return null;
    }
    return suggestion;
  }

  override onInputChange(): void {
    this.replaceApplied = false;
    this.dismissedSuggestionId = null;
    super.onInputChange();
  }

  override onOptionsChange(): void {
    this.replaceApplied = false;
    this.dismissedSuggestionId = null;
    super.onOptionsChange();
  }

  override clear(): void {
    this.replaceApplied = false;
    this.lastAppliedMatchCount = 0;
    this.matchCount = 0;
    super.clear();
  }

  override useOutputAsInput(): void {
    if (!this.hasOutput) {
      this.toastService.info('No output to use');
      return;
    }
    if (!this.replaceApplied && this.findText.trim() && this.matchCount > 0) {
      this.toastService.info('Use Apply Replace first to confirm changes, or click → In to copy preview to input.');
      return;
    }
    super.useOutputAsInput();
    this.replaceApplied = false;
  }

  applyReplace(): void {
    if (!this.hasInput) {
      this.toastService.info('Add input text first.');
      return;
    }
    if (!this.findText.trim()) {
      this.toastService.info('Enter a find term in Options first.');
      return;
    }
    if (this.errorMessage) {
      this.toastService.error(this.errorMessage);
      return;
    }
    if (this.matchCount === 0) {
      this.toastService.info('No matches found — nothing to replace.');
      return;
    }

    const findLabel = this.truncateForConfirm(this.findText);
    const replaceLabel = this.truncateForConfirm(this.replaceText);
    const scope = this.replaceAll ? 'all' : 'the first';
    const confirmed = globalThis.confirm?.(
      `Replace ${this.matchCount} occurrence${this.matchCount === 1 ? '' : 's'} (${scope}) of "${findLabel}" with "${replaceLabel}"?\n\nYour input text will be updated.`
    );

    if (!confirmed) {
      this.toastService.info('Replace cancelled.');
      return;
    }

    const appliedCount = this.matchCount;
    this.applyInputState(this.outputText);
    this.pushToUndoStack(this.outputText);
    this.lastAppliedMatchCount = appliedCount;
    this.replaceApplied = true;
    this.toastService.success(
      `Replaced ${appliedCount} occurrence${appliedCount === 1 ? '' : 's'}. Input text updated.`
    );
  }

  protected override handleUploadedFile(file: File): void {
    this.replaceApplied = false;
    super.handleUploadedFile(file);
  }

  protected process(): void {
    const result = applyFindAndReplace(this.inputText, this.findText, this.replaceText, {
      useRegex: this.useRegex,
      caseSensitive: this.caseSensitive,
      replaceAll: this.replaceAll
    });
    this.matchCount = result.matchCount;
    this.outputText = result.output;
    this.errorMessage = result.errorMessage;
  }

  protected override resetDerivedState(): void {
    this.matchCount = 0;
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId = suggestionId;
  }

  private truncateForConfirm(value: string): string {
    return value.length > 40 ? `${value.slice(0, 40)}…` : value;
  }
}
