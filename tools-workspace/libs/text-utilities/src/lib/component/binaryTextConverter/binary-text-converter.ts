import { Component } from '@angular/core';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Navigation, TooltipDirective } from '@tools-workspace/features-home';
import { TextToolBase } from '../../shared/text-tool-base';
import { textToBinary, binaryToText } from '../../shared/text-transform.utils';

@Component({
  selector: 'lib-binary-text-converter',
  standalone: true,
  templateUrl: './binary-text-converter.html',
  styleUrls: ['./binary-text-converter.scss'],
  imports: [FormsModule, CommonModule, Navigation, ReactiveFormsModule, TooltipDirective],
})
export class BinaryTextConverterComponent extends TextToolBase {
  mode: 'encode' | 'decode' = 'encode';
  separator: 'none' | 'space' | 'colon' = 'space';
  bits: 8 | 16 = 8;

  readonly separatorOptions = [
    { value: 'none' as const, label: 'None' },
    { value: 'space' as const, label: 'Space' },
    { value: 'colon' as const, label: 'Colon' },
  ];

  get modeLabel(): string {
    return this.mode === 'encode' ? 'To binary' : 'To text';
  }

  get inputLabel(): string {
    return this.mode === 'encode' ? 'Source text' : 'Binary input';
  }

  get outputLabel(): string {
    return this.mode === 'encode' ? 'Binary output' : 'Decoded text';
  }

  private get separatorChar(): string {
    switch (this.separator) {
      case 'space': return ' ';
      case 'colon': return ':';
      default: return '';
    }
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

  setSeparator(value: 'none' | 'space' | 'colon'): void {
    if (this.separator === value) return;
    this.separator = value;
    this.onOptionsChange();
  }

  setBits(value: 8 | 16): void {
    if (this.bits === value) return;
    this.bits = value;
    this.onOptionsChange();
  }

  protected process(): void {
    this.outputText = this.mode === 'encode'
      ? textToBinary(this.inputText, this.separatorChar, this.bits)
      : binaryToText(this.inputText, this.bits);
  }
}
