import { Component } from '@angular/core';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Navigation, TooltipDirective } from '@tools-workspace/features-home';
import { TextToolBase } from '../../shared/text-tool-base';
import type { TuRelatedToolLink, TuToolSuggestion } from '../../shared/tu-tool-suggestion.model';
import {
  SPLIT_JOIN_DEFAULT_DELIMITER,
  SPLIT_JOIN_DEFAULT_MODE,
  SPLIT_JOIN_RELATED_TOOLS,
} from '../../constants/split-join-text.constants';
import type { SplitJoinMode } from '../../types/split-join-text.types';
import {
  convertSplitJoinText,
  countSplitParts,
  inputLooksLikeDelimitedList,
  inputLooksLikeLineList,
  resolveSplitJoinSuggestion,
} from '../../utils/split-join-text.utils';

@Component({
  selector: 'lib-split-join-text',
  standalone: true,
  templateUrl: './split-join-text.html',
  styleUrls: ['./split-join-text.scss'],
  imports: [FormsModule, CommonModule, RouterLink, Navigation, ReactiveFormsModule, TooltipDirective],
})
export class SplitJoinTextComponent extends TextToolBase {
  mode: SplitJoinMode = SPLIT_JOIN_DEFAULT_MODE;
  delimiter = SPLIT_JOIN_DEFAULT_DELIMITER;
  showOptionsPanel = false;

  readonly relatedTools: ReadonlyArray<TuRelatedToolLink> = SPLIT_JOIN_RELATED_TOOLS;
  private dismissedSuggestionId: string | null = null;

  get modeLabel(): string {
    return this.mode === 'split' ? 'Split' : 'Join';
  }

  get primarySuggestion(): TuToolSuggestion | null {
    const suggestion = resolveSplitJoinSuggestion({
      mode: this.mode,
      hasInput: this.hasInput,
      hasOutput: this.hasOutput,
      delimiter: this.delimiter,
      outputUnchanged: this.hasOutput && this.outputText === this.inputText,
      looksLikeLineList: inputLooksLikeLineList(this.inputText),
      looksLikeDelimitedList: inputLooksLikeDelimitedList(this.inputText, this.delimiter),
      partCount: countSplitParts(this.inputText, this.delimiter),
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

  setMode(mode: SplitJoinMode): void {
    if (this.mode === mode) return;
    this.mode = mode;
    this.onOptionsChange();
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId = suggestionId;
  }

  protected process(): void {
    this.outputText = convertSplitJoinText({
      mode: this.mode,
      inputText: this.inputText,
      delimiter: this.delimiter,
    }).output;
  }
}
