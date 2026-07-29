import { Component } from '@angular/core';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Navigation, TooltipDirective } from '@tools-workspace/features-home';
import { TextToolBase } from '../../shared/text-tool-base';
import type { TuRelatedToolLink, TuToolSuggestion } from '../../shared/tu-tool-suggestion.model';
import {
  BASE64_MAX_UPLOAD_BYTES,
  BASE64_RELATED_TOOLS,
  BASE64_UPLOAD_ACCEPT
} from '../../constants/base64-encode-and-decode.constants';
import type { Base64ConversionMode } from '../../types/base64-encode-and-decode.types';
import {
  convertBase64,
  inputLooksLikeBase64,
  isLikelyBase64TextFile,
  resolveBase64Suggestion
} from '../../utils/base64-encode-and-decode.utils';

@Component({
  selector: 'lib-base64-encode-and-decode',
  standalone: true,
  templateUrl: './base64-encode-and-decode.html',
  styleUrls: ['./base64-encode-and-decode.scss'],
  imports: [FormsModule, CommonModule, RouterLink, Navigation, ReactiveFormsModule, TooltipDirective]
})
export class Base64EncodeAndDecodeComponent extends TextToolBase {
  override readonly maxUploadBytes = BASE64_MAX_UPLOAD_BYTES;

  mode: Base64ConversionMode = 'encode';
  readonly relatedTools: ReadonlyArray<TuRelatedToolLink> = BASE64_RELATED_TOOLS;
  private dismissedSuggestionId: string | null = null;

  get modeLabel(): string {
    return this.mode === 'encode' ? 'Encode' : 'Decode';
  }

  get inputLabel(): string {
    return this.mode === 'encode' ? 'Source text' : 'Base64 input';
  }

  get outputLabel(): string {
    return this.mode === 'encode' ? 'Base64 output' : 'Decoded text';
  }

  get sizeDelta(): number {
    if (!this.hasOutput || !this.inputText) return 0;
    return this.outputText.length - this.inputText.length;
  }

  get primarySuggestion(): TuToolSuggestion | null {
    const suggestion = resolveBase64Suggestion({
      mode: this.mode,
      hasInput: this.hasInput,
      hasOutput: this.hasOutput,
      errorMessage: this.errorMessage,
      inputLooksLikeBase64: inputLooksLikeBase64(this.inputText)
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

  selectMode(selectedMode: Base64ConversionMode): void {
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
    const result = convertBase64(this.mode, this.inputText);
    this.outputText = result.output;
    this.errorMessage = result.errorMessage;
  }

  override downloadText(): void {
    if (!this.hasOutput) return;
    const ext = this.mode === 'encode' ? 'b64.txt' : 'txt';
    const blob = new Blob([this.outputText], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `output.${ext}`;
    link.click();
    URL.revokeObjectURL(link.href);
    this.toastService.info('Download started');
  }

  swapInputOutput(): void {
    if (!this.hasOutput && !this.hasInput) {
      this.toastService.info('Nothing to swap');
      return;
    }

    const previousInput = this.inputText;
    const previousOutput = this.hasOutput ? this.outputText : '';

    this.mode = this.mode === 'encode' ? 'decode' : 'encode';
    this.dismissedSuggestionId = null;

    if (previousOutput) {
      this.isRestoringHistory = true;
      this.inputText = previousOutput;
      this.outputText = previousInput;
      this.errorMessage = '';
      this.isRestoringHistory = false;
    } else {
      this.runProcess();
    }

    this.pushToUndoStack(this.inputText);
    this.toastService.info('Mode and values swapped');
  }

  override uploadTextFile(): void {
    if (!this.fileInput) {
      this.fileInput = document.createElement('input');
      this.fileInput.type = 'file';
      this.fileInput.style.display = 'none';
      this.fileInput.addEventListener('change', () => {
        const file = this.fileInput?.files?.[0];
        if (file) {
          this.handleUploadedFile(file);
        }
        if (this.fileInput) {
          this.fileInput.value = '';
        }
      });
      document.body.appendChild(this.fileInput);
    }

    this.fileInput.accept = BASE64_UPLOAD_ACCEPT;
    this.fileInput.click();
  }

  protected override handleUploadedFile(file: File): void {
    if (file.size > this.maxUploadBytes) {
      this.toastService.error(
        `File is too large. Maximum size is ${Math.round(this.maxUploadBytes / (1024 * 1024))} MB.`
      );
      return;
    }

    if (!isLikelyBase64TextFile(file)) {
      this.toastService.error('Please upload a text-based file (.txt, .b64, .json, etc.).');
      return;
    }

    this.isReadingFile = true;
    const reader = new FileReader();

    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      if (this.historyTimer) {
        clearTimeout(this.historyTimer);
        this.historyTimer = null;
      }
      this.applyInputState(text);
      this.pushToUndoStack(text);
      this.isReadingFile = false;
      this.dismissedSuggestionId = null;
      this.toastService.info(`Loaded "${file.name}"`);
    };

    reader.onerror = () => {
      this.isReadingFile = false;
      this.toastService.error('Could not read the file. Please try another text file.');
    };

    reader.readAsText(file);
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId = suggestionId;
  }
}
