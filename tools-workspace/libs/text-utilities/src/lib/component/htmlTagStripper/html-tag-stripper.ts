import { Component } from '@angular/core';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Navigation, TooltipDirective } from '@tools-workspace/features-home';
import { TextToolBase } from '../../shared/text-tool-base';
import { stripHtmlTags } from '../../shared/text-transform.utils';

@Component({
  selector: 'lib-html-tag-stripper',
  standalone: true,
  templateUrl: './html-tag-stripper.html',
  styleUrls: ['./html-tag-stripper.scss'],
  imports: [FormsModule, CommonModule, Navigation, ReactiveFormsModule, TooltipDirective],
})
export class HtmlTagStripperComponent extends TextToolBase {
  preserveLineBreaks = true;

  protected process(): void {
    this.outputText = stripHtmlTags(this.inputText, this.preserveLineBreaks);
  }
}
