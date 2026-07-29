import { Component } from '@angular/core';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Navigation, TooltipDirective } from '@tools-workspace/features-home';
import { TextToolBase } from '../../shared/text-tool-base';
import type { TuRelatedToolLink, TuToolSuggestion } from '../../shared/tu-tool-suggestion.model';
import {
  HTML_TAG_STRIPPER_DEFAULT_PRESERVE_LINE_BREAKS,
  HTML_TAG_STRIPPER_RELATED_TOOLS
} from '../../constants/html-tag-stripper.constants';
import {
  inputContainsHtmlEntities,
  inputContainsHtmlTags,
  inputContainsScriptOrStyle,
  resolveHtmlTagStripperSuggestion,
  stripHtmlTagText
} from '../../utils/html-tag-stripper.utils';

@Component({
  selector: 'lib-html-tag-stripper',
  standalone: true,
  templateUrl: './html-tag-stripper.html',
  styleUrls: ['./html-tag-stripper.scss'],
  imports: [FormsModule, CommonModule, RouterLink, Navigation, ReactiveFormsModule, TooltipDirective]
})
export class HtmlTagStripperComponent extends TextToolBase {
  preserveLineBreaks = HTML_TAG_STRIPPER_DEFAULT_PRESERVE_LINE_BREAKS;

  readonly relatedTools: ReadonlyArray<TuRelatedToolLink> = HTML_TAG_STRIPPER_RELATED_TOOLS;
  private dismissedSuggestionId: string | null = null;

  get primarySuggestion(): TuToolSuggestion | null {
    const suggestion = resolveHtmlTagStripperSuggestion({
      hasInput: this.hasInput,
      hasOutput: this.hasOutput,
      preserveLineBreaks: this.preserveLineBreaks,
      containsHtmlTags: inputContainsHtmlTags(this.inputText),
      containsHtmlEntities: inputContainsHtmlEntities(this.inputText),
      containsScriptOrStyle: inputContainsScriptOrStyle(this.inputText)
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

  protected process(): void {
    this.outputText = stripHtmlTagText({
      inputText: this.inputText,
      preserveLineBreaks: this.preserveLineBreaks
    }).output;
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId = suggestionId;
  }
}
