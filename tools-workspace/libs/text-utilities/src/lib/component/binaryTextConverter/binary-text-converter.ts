import { Component } from '@angular/core';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Navigation, TooltipDirective } from '@tools-workspace/features-home';
import { TextToolBase } from '../../shared/text-tool-base';
import type { TuRelatedToolLink, TuToolSuggestion } from '../../shared/tu-tool-suggestion.model';
import {
  BINARY_DEFAULT_BITS,
  BINARY_DEFAULT_MODE,
  BINARY_DEFAULT_SEPARATOR,
  BINARY_RELATED_TOOLS,
  BINARY_SEPARATOR_OPTIONS
} from '../../constants/binary-text-converter.constants';
import type {
  BinaryBitWidth,
  BinaryConversionMode,
  BinarySeparatorChoice,
  BinarySeparatorOption
} from '../../types/binary-text-converter.types';
import {
  convertBinaryText,
  inputLooksLikeBinary,
  resolveBinaryTextSuggestion
} from '../../utils/binary-text-converter.utils';

@Component({
  selector: 'lib-binary-text-converter',
  standalone: true,
  templateUrl: './binary-text-converter.html',
  styleUrls: ['./binary-text-converter.scss'],
  imports: [FormsModule, CommonModule, RouterLink, Navigation, ReactiveFormsModule, TooltipDirective]
})
export class BinaryTextConverterComponent extends TextToolBase {
  mode: BinaryConversionMode = BINARY_DEFAULT_MODE;
  separator: BinarySeparatorOption = BINARY_DEFAULT_SEPARATOR;
  bits: BinaryBitWidth = BINARY_DEFAULT_BITS;

  readonly separatorOptions: ReadonlyArray<BinarySeparatorChoice> = BINARY_SEPARATOR_OPTIONS;
  readonly relatedTools: ReadonlyArray<TuRelatedToolLink> = BINARY_RELATED_TOOLS;
  private dismissedSuggestionId: string | null = null;

  get modeLabel(): string {
    return this.mode === 'encode' ? 'To binary' : 'To text';
  }

  get inputLabel(): string {
    return this.mode === 'encode' ? 'Source text' : 'Binary input';
  }

  get outputLabel(): string {
    return this.mode === 'encode' ? 'Binary output' : 'Decoded text';
  }

  get primarySuggestion(): TuToolSuggestion | null {
    const suggestion = resolveBinaryTextSuggestion({
      mode: this.mode,
      hasInput: this.hasInput,
      hasOutput: this.hasOutput,
      errorMessage: this.errorMessage,
      bits: this.bits,
      inputLooksLikeBinary: inputLooksLikeBinary(this.inputText, this.bits)
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

  selectMode(selectedMode: BinaryConversionMode): void {
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

  setSeparator(value: BinarySeparatorOption): void {
    if (this.separator === value) return;
    this.separator = value;
    this.onOptionsChange();
  }

  setBits(value: BinaryBitWidth): void {
    if (this.bits === value) return;
    this.bits = value;
    this.onOptionsChange();
  }

  protected process(): void {
    const result = convertBinaryText({
      mode: this.mode,
      inputText: this.inputText,
      separator: this.separator,
      bits: this.bits
    });
    this.outputText = result.output;
    this.errorMessage = result.errorMessage;
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId = suggestionId;
  }
}
