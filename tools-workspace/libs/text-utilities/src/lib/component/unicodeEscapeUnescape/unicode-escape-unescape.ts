import { Component } from '@angular/core';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Navigation, TooltipDirective } from '@tools-workspace/features-home';
import { TextToolBase } from '../../shared/text-tool-base';
import { unicodeEscape, unicodeUnescape } from '../../shared/text-transform.utils';

@Component({
  selector: 'lib-unicode-escape-unescape',
  standalone: true,
  templateUrl: './unicode-escape-unescape.html',
  styleUrls: ['./unicode-escape-unescape.scss'],
  imports: [FormsModule, CommonModule, Navigation, ReactiveFormsModule, TooltipDirective],
})
export class UnicodeEscapeUnescapeComponent extends TextToolBase {
  mode: 'encode' | 'decode' = 'encode';

  get modeLabel(): string {
    return this.mode === 'encode' ? 'Escape' : 'Unescape';
  }

  get inputLabel(): string {
    return this.mode === 'encode' ? 'Source text' : 'Unicode escapes';
  }

  get outputLabel(): string {
    return this.mode === 'encode' ? 'Escaped output' : 'Plain text';
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
      ? unicodeEscape(this.inputText)
      : unicodeUnescape(this.inputText);
  }
}
