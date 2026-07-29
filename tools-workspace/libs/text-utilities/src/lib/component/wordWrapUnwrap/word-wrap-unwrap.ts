import { Component } from '@angular/core';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Navigation, TooltipDirective } from '@tools-workspace/features-home';
import { TextToolBase } from '../../shared/text-tool-base';
import type { TuRelatedToolLink, TuToolSuggestion } from '../../shared/tu-tool-suggestion.model';
import {
  WORD_WRAP_DEFAULT_MODE,
  WORD_WRAP_DEFAULT_SHOW_OPTIONS_PANEL,
  WORD_WRAP_DEFAULT_WIDTH,
  WORD_WRAP_RELATED_TOOLS,
} from '../../constants/word-wrap-unwrap.constants';
import type { WordWrapMode } from '../../types/word-wrap-unwrap.types';
import {
  clampWrapWidth,
  convertWordWrapText,
  inputHasLongLines,
  inputHasSoftLineBreaks,
  resolveWordWrapSuggestion,
} from '../../utils/word-wrap-unwrap.utils';

@Component({
  selector: 'lib-word-wrap-unwrap',
  standalone: true,
  templateUrl: './word-wrap-unwrap.html',
  styleUrls: ['./word-wrap-unwrap.scss'],
  imports: [FormsModule, CommonModule, RouterLink, Navigation, ReactiveFormsModule, TooltipDirective],
})
export class WordWrapUnwrapComponent extends TextToolBase {
  mode: WordWrapMode = WORD_WRAP_DEFAULT_MODE;
  wrapWidth = WORD_WRAP_DEFAULT_WIDTH;
  showOptionsPanel = WORD_WRAP_DEFAULT_SHOW_OPTIONS_PANEL;

  readonly relatedTools: ReadonlyArray<TuRelatedToolLink> = WORD_WRAP_RELATED_TOOLS;
  private dismissedSuggestionId: string | null = null;

  get modeLabel(): string {
    return this.mode === 'wrap' ? 'Wrap' : 'Unwrap';
  }

  get primarySuggestion(): TuToolSuggestion | null {
    const suggestion = resolveWordWrapSuggestion({
      mode: this.mode,
      hasInput: this.hasInput,
      hasOutput: this.hasOutput,
      wrapWidth: this.wrapWidth,
      outputUnchanged: this.hasOutput && this.outputText === this.inputText,
      hasLongLines: inputHasLongLines(this.inputText, this.wrapWidth),
      hasSoftLineBreaks: inputHasSoftLineBreaks(this.inputText),
    });
    if (!suggestion || this.dismissedSuggestionId === suggestion.id) {
      return null;
    }
    return suggestion;
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId = suggestionId;
  }

  override onInputChange(): void {
    this.dismissedSuggestionId = null;
    super.onInputChange();
  }

  override onOptionsChange(): void {
    this.dismissedSuggestionId = null;
    super.onOptionsChange();
  }

  setMode(mode: WordWrapMode): void {
    if (this.mode === mode) return;
    this.mode = mode;
    this.onOptionsChange();
  }

  onWrapWidthChange(): void {
    this.wrapWidth = clampWrapWidth(this.wrapWidth);
    this.onOptionsChange();
  }

  protected process(): void {
    this.outputText = convertWordWrapText({
      mode: this.mode,
      inputText: this.inputText,
      wrapWidth: this.wrapWidth,
    }).output;
  }
}
