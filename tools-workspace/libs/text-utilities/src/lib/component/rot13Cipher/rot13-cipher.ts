import { Component } from '@angular/core';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Navigation, TooltipDirective } from '@tools-workspace/features-home';
import { TextToolBase } from '../../shared/text-tool-base';
import type { TuRelatedToolLink, TuToolSuggestion } from '../../shared/tu-tool-suggestion.model';
import {
  ROT13_DEFAULT_CAESAR_SHIFT,
  ROT13_DEFAULT_MODE,
  ROT13_RELATED_TOOLS,
} from '../../constants/rot13-cipher.constants';
import type { Rot13CipherMode } from '../../types/rot13-cipher.types';
import {
  caesarDecodeShift,
  clampCaesarShift,
  convertRot13CipherText,
  inputHasAlphabeticCharacters,
  resolveRot13Suggestion,
} from '../../utils/rot13-cipher.utils';

@Component({
  selector: 'lib-rot13-cipher',
  standalone: true,
  templateUrl: './rot13-cipher.html',
  styleUrls: ['./rot13-cipher.scss'],
  imports: [FormsModule, CommonModule, RouterLink, Navigation, ReactiveFormsModule, TooltipDirective],
})
export class Rot13CipherComponent extends TextToolBase {
  cipherMode: Rot13CipherMode = ROT13_DEFAULT_MODE;
  caesarShift = ROT13_DEFAULT_CAESAR_SHIFT;

  readonly relatedTools: ReadonlyArray<TuRelatedToolLink> = ROT13_RELATED_TOOLS;
  private dismissedSuggestionId: string | null = null;

  get cipherModeLabel(): string {
    return this.cipherMode === 'rot13' ? 'ROT13' : `Caesar ${this.caesarShift}`;
  }

  get decodeShift(): number {
    return caesarDecodeShift(this.caesarShift);
  }

  get primarySuggestion(): TuToolSuggestion | null {
    const suggestion = resolveRot13Suggestion({
      mode: this.cipherMode,
      hasInput: this.hasInput,
      hasOutput: this.hasOutput,
      caesarShift: this.caesarShift,
      decodeShift: this.decodeShift,
      inputHasLetters: inputHasAlphabeticCharacters(this.inputText),
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

  setCipherMode(mode: Rot13CipherMode): void {
    if (this.cipherMode === mode) return;
    this.cipherMode = mode;
    this.dismissedSuggestionId = null;
    this.onOptionsChange();
  }

  onCaesarShiftChange(): void {
    this.caesarShift = clampCaesarShift(this.caesarShift);
    this.dismissedSuggestionId = null;
    this.onOptionsChange();
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId = suggestionId;
  }

  protected process(): void {
    this.outputText = convertRot13CipherText({
      mode: this.cipherMode,
      inputText: this.inputText,
      caesarShift: this.caesarShift,
    }).output;
  }
}
