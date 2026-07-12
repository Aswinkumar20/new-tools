import { Component } from '@angular/core';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Navigation, TooltipDirective } from '@tools-workspace/features-home';
import { TextToolBase } from '../../shared/text-tool-base';
import { findReplace } from '../../shared/text-transform.utils';

@Component({
  selector: 'lib-find-and-replace',
  standalone: true,
  templateUrl: './find-and-replace.html',
  styleUrls: ['./find-and-replace.scss'],
  imports: [FormsModule, CommonModule, Navigation, ReactiveFormsModule, TooltipDirective],
})
export class FindAndReplaceComponent extends TextToolBase {
  findText = '';
  replaceText = '';
  useRegex = false;
  caseSensitive = false;
  replaceAll = true;
  showOptionsPanel = true;

  protected process(): void {
    this.outputText = findReplace(this.inputText, this.findText, this.replaceText, {
      useRegex: this.useRegex,
      caseSensitive: this.caseSensitive,
      replaceAll: this.replaceAll,
    });
  }
}
