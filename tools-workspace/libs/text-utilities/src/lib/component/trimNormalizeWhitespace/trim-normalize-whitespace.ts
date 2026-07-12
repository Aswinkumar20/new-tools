import { Component } from '@angular/core';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Navigation, TooltipDirective } from '@tools-workspace/features-home';
import { TextToolBase } from '../../shared/text-tool-base';
import { trimNormalize } from '../../shared/text-transform.utils';

@Component({
  selector: 'lib-trim-normalize-whitespace',
  standalone: true,
  templateUrl: './trim-normalize-whitespace.html',
  styleUrls: ['./trim-normalize-whitespace.scss'],
  imports: [FormsModule, CommonModule, Navigation, ReactiveFormsModule, TooltipDirective],
})
export class TrimNormalizeWhitespaceComponent extends TextToolBase {
  trimLines = true;
  collapseSpaces = false;
  removeEmptyLines = false;
  normalizeLineEndings = false;
  showOptionsPanel = true;

  get activeOptionCount(): number {
    return [this.trimLines, this.collapseSpaces, this.removeEmptyLines, this.normalizeLineEndings].filter(Boolean).length;
  }

  protected process(): void {
    this.outputText = trimNormalize(this.inputText, {
      trimLines: this.trimLines,
      collapseSpaces: this.collapseSpaces,
      removeEmptyLines: this.removeEmptyLines,
      normalizeLineEndings: this.normalizeLineEndings,
    });
  }
}
