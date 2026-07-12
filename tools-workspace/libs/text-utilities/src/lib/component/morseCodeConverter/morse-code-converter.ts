import { Component } from '@angular/core';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Navigation, TooltipDirective } from '@tools-workspace/features-home';
import { TextToolBase } from '../../shared/text-tool-base';
import { textToMorse, morseToText } from '../../shared/text-transform.utils';

@Component({
  selector: 'lib-morse-code-converter',
  standalone: true,
  templateUrl: './morse-code-converter.html',
  styleUrls: ['./morse-code-converter.scss'],
  imports: [FormsModule, CommonModule, Navigation, ReactiveFormsModule, TooltipDirective],
})
export class MorseCodeConverterComponent extends TextToolBase {
  mode: 'encode' | 'decode' = 'encode';

  get modeLabel(): string {
    return this.mode === 'encode' ? 'To Morse' : 'To text';
  }

  get inputLabel(): string {
    return this.mode === 'encode' ? 'Source text' : 'Morse code';
  }

  get outputLabel(): string {
    return this.mode === 'encode' ? 'Morse output' : 'Decoded text';
  }

  selectMode(selectedMode: 'encode' | 'decode'): void {
    if (this.mode === selectedMode) return;
    const previousOutput = this.hasOutput ? this.outputText : '';
    this.mode = selectedMode;
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
    this.outputText = this.mode === 'encode'
      ? textToMorse(this.inputText)
      : morseToText(this.inputText);
  }
}
