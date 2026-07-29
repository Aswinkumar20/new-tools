import { Component } from '@angular/core';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Navigation, TooltipDirective } from '@tools-workspace/features-home';
import { TextToolBase } from '../../shared/text-tool-base';
import type { TuRelatedToolLink, TuToolSuggestion } from '../../shared/tu-tool-suggestion.model';
import {
  UNICODE_ESCAPE_DEFAULT_MODE,
  UNICODE_ESCAPE_RELATED_TOOLS,
} from '../../constants/unicode-escape-unescape.constants';
import type { UnicodeEscapeConversionMode } from '../../types/unicode-escape-unescape.types';
import {
  convertUnicodeEscapeText,
  inputHasNonAsciiCharacters,
  inputLooksLikeUnicodeEscaped,
  resolveUnicodeEscapeSuggestion,
} from '../../utils/unicode-escape-unescape.utils';

@Component({
  selector: 'lib-unicode-escape-unescape',
  standalone: true,
  templateUrl: './unicode-escape-unescape.html',
  styleUrls: ['./unicode-escape-unescape.scss'],
  imports: [FormsModule, CommonModule, RouterLink, Navigation, ReactiveFormsModule, TooltipDirective],
})
export class UnicodeEscapeUnescapeComponent extends TextToolBase {
  mode: UnicodeEscapeConversionMode = UNICODE_ESCAPE_DEFAULT_MODE;

  readonly relatedTools: ReadonlyArray<TuRelatedToolLink> = UNICODE_ESCAPE_RELATED_TOOLS;
  private dismissedSuggestionId: string | null = null;

  get modeLabel(): string {
    return this.mode === 'encode' ? 'Escape' : 'Unescape';
  }

  get inputLabel(): string {
    return this.mode === 'encode' ? 'Source text' : 'Unicode escapes';
  }

  get outputLabel(): string {
    return this.mode === 'encode' ? 'Escaped output' : 'Plain text';
  }

  get primarySuggestion(): TuToolSuggestion | null {
    const suggestion = resolveUnicodeEscapeSuggestion({
      mode: this.mode,
      hasInput: this.hasInput,
      hasOutput: this.hasOutput,
      inputLooksLikeEscaped: inputLooksLikeUnicodeEscaped(this.inputText),
      inputHasNonAscii: inputHasNonAsciiCharacters(this.inputText),
      outputUnchanged: this.hasOutput && this.outputText === this.inputText,
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

  selectMode(selectedMode: UnicodeEscapeConversionMode): void {
    if (this.mode === selectedMode) return;
    const previousOutput = this.hasOutput ? this.outputText : '';
    this.mode = selectedMode;
    this.dismissedSuggestionId = null;
    if (previousOutput) {
      this.applyInputState(previousOutput);
      this.pushToUndoStack(previousOutput);
      this.toastService.info(`Switched to ${this.modeLabel} mode`);
      return;
    }
    if (this.inputText) {
      this.runProcess();
    } else {
      this.outputText = '';
      this.errorMessage = '';
    }
  }

  protected process(): void {
    this.outputText = convertUnicodeEscapeText({
      mode: this.mode,
      inputText: this.inputText,
    }).output;
  }
}
