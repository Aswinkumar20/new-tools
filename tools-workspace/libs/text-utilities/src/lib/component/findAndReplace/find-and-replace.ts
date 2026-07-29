import { Component } from '@angular/core';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Navigation, TooltipDirective } from '@tools-workspace/features-home';
import { TextToolBase } from '../../shared/text-tool-base';
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

@Component({
  selector: 'lib-find-and-replace',
  standalone: true,
  templateUrl: './find-and-replace.html',
  styleUrls: ['./find-and-replace.scss'],
  imports: [FormsModule, CommonModule, RouterLink, Navigation, ReactiveFormsModule, TooltipDirective]
})
export class FindAndReplaceComponent extends TextToolBase {
  findText = '';
  replaceText = '';
  useRegex = FIND_AND_REPLACE_DEFAULT_OPTIONS.useRegex;
  caseSensitive = FIND_AND_REPLACE_DEFAULT_OPTIONS.caseSensitive;
  replaceAll = FIND_AND_REPLACE_DEFAULT_OPTIONS.replaceAll;
  showOptionsPanel = FIND_AND_REPLACE_SHOW_OPTIONS_DEFAULT;

  readonly relatedTools: ReadonlyArray<TuRelatedToolLink> = FIND_AND_REPLACE_RELATED_TOOLS;
  private matchCount = 0;
  private dismissedSuggestionId: string | null = null;

  get primarySuggestion(): TuToolSuggestion | null {
    const suggestion = resolveFindAndReplaceSuggestion({
      hasInput: this.hasInput,
      hasFindText: !!this.findText,
      hasOutput: this.hasOutput,
      errorMessage: this.errorMessage,
      matchCount: this.matchCount,
      useRegex: this.useRegex,
      outputUnchanged: this.hasOutput && this.outputText === this.inputText
    });
    if (!suggestion || this.dismissedSuggestionId === suggestion.id) {
      return null;
    }
    return suggestion;
  }

  override onInputChange(): void {
    this.dismissedSuggestionId = null;
    super.onInputChange();
  }

  override onOptionsChange(): void {
    this.dismissedSuggestionId = null;
    super.onOptionsChange();
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
}
