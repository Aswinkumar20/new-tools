import { Component } from '@angular/core';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Navigation, TooltipDirective } from '@tools-workspace/features-home';
import { TextToolBase } from '../../shared/text-tool-base';
import type { TuRelatedToolLink, TuToolSuggestion } from '../../shared/tu-tool-suggestion.model';
import {
  EXTRACT_EMAILS_URLS_DEFAULT_TYPE,
  EXTRACT_EMAILS_URLS_OPTIONS,
  EXTRACT_EMAILS_URLS_RELATED_TOOLS
} from '../../constants/extract-emails-urls.constants';
import type {
  ExtractEmailsUrlsOption,
  ExtractEmailsUrlsType
} from '../../types/extract-emails-urls.types';
import {
  extractEmailsAndUrls,
  resolveExtractEmailsUrlsSuggestion
} from '../../utils/extract-emails-urls.utils';

@Component({
  selector: 'lib-extract-emails-urls',
  standalone: true,
  templateUrl: './extract-emails-urls.html',
  styleUrls: ['./extract-emails-urls.scss'],
  imports: [FormsModule, CommonModule, RouterLink, Navigation, ReactiveFormsModule, TooltipDirective]
})
export class ExtractEmailsUrlsComponent extends TextToolBase {
  extractType: ExtractEmailsUrlsType = EXTRACT_EMAILS_URLS_DEFAULT_TYPE;
  extractedCount = 0;
  private lastEmailCount = 0;
  private lastUrlCount = 0;
  private dismissedSuggestionId: string | null = null;

  readonly extractOptions: ReadonlyArray<ExtractEmailsUrlsOption> = EXTRACT_EMAILS_URLS_OPTIONS;
  readonly relatedTools: ReadonlyArray<TuRelatedToolLink> = EXTRACT_EMAILS_URLS_RELATED_TOOLS;

  get primarySuggestion(): TuToolSuggestion | null {
    const suggestion = resolveExtractEmailsUrlsSuggestion({
      hasInput: this.hasInput,
      extractType: this.extractType,
      extractedCount: this.extractedCount,
      emailCount: this.lastEmailCount,
      urlCount: this.lastUrlCount
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

  setExtractType(type: ExtractEmailsUrlsType): void {
    if (this.extractType === type) return;
    this.extractType = type;
    this.onOptionsChange();
  }

  protected process(): void {
    const result = extractEmailsAndUrls(this.inputText, this.extractType);
    this.extractedCount = result.items.length;
    this.lastEmailCount = result.emailCount;
    this.lastUrlCount = result.urlCount;
    this.outputText = result.outputText;
  }

  protected override resetDerivedState(): void {
    this.extractedCount = 0;
    this.lastEmailCount = 0;
    this.lastUrlCount = 0;
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId = suggestionId;
  }
}
