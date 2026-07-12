import { Component } from '@angular/core';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Navigation, TooltipDirective } from '@tools-workspace/features-home';
import { TextToolBase } from '../../shared/text-tool-base';
import { addLineNumbers, removeLineNumbers } from '../../shared/text-transform.utils';

@Component({
  selector: 'lib-line-number-tool',
  standalone: true,
  templateUrl: './line-number-tool.html',
  styleUrls: ['./line-number-tool.scss'],
  imports: [FormsModule, CommonModule, Navigation, ReactiveFormsModule, TooltipDirective],
})
export class LineNumberToolComponent extends TextToolBase {
  mode: 'add' | 'remove' = 'add';
  startNumber = 1;
  separator = '. ';
  showOptionsPanel = false;

  get modeLabel(): string {
    return this.mode === 'add' ? 'Add numbers' : 'Remove numbers';
  }

  get lineCount(): number {
    if (!this.inputText) return 0;
    return this.inputText.split('\n').length;
  }

  setMode(mode: 'add' | 'remove'): void {
    if (this.mode === mode) return;
    this.mode = mode;
    this.onOptionsChange();
  }

  onStartNumberChange(): void {
    this.startNumber = Math.max(0, Math.round(this.startNumber ?? 1));
    this.onOptionsChange();
  }

  protected process(): void {
    this.outputText =
      this.mode === 'add'
        ? addLineNumbers(this.inputText, this.startNumber, this.separator)
        : removeLineNumbers(this.inputText);
  }
}
