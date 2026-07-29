import { Component } from '@angular/core';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Navigation, TooltipDirective } from '@tools-workspace/features-home';
import { TextToolBase } from '../../shared/text-tool-base';
import type { TuRelatedToolLink, TuToolSuggestion } from '../../shared/tu-tool-suggestion.model';
import { READABILITY_RELATED_TOOLS } from '../../constants/readability-analyzer.constants';
import type { ReadabilityResult } from '../../types/readability-analyzer.types';
import {
  computeReadabilityAnalysis,
  resolveReadabilitySuggestion
} from '../../utils/readability-analyzer.utils';

@Component({
  selector: 'lib-readability-analyzer',
  standalone: true,
  templateUrl: './readability-analyzer.html',
  styleUrls: ['./readability-analyzer.scss'],
  imports: [FormsModule, CommonModule, RouterLink, Navigation, ReactiveFormsModule, TooltipDirective]
})
export class ReadabilityAnalyzerComponent extends TextToolBase {
  readability: ReadabilityResult | null = null;

  readonly relatedTools: ReadonlyArray<TuRelatedToolLink> = READABILITY_RELATED_TOOLS;
  private dismissedSuggestionId: string | null = null;

  get primarySuggestion(): TuToolSuggestion | null {
    const suggestion = resolveReadabilitySuggestion({
      hasInput: this.hasInput,
      wordCount: this.readability?.words ?? 0,
      fleschReadingEase: this.readability?.fleschReadingEase ?? 0,
      readingLevel: this.readability?.readingLevel ?? 'N/A'
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

  protected process(): void {
    const result = computeReadabilityAnalysis(this.inputText);
    this.readability = result.readability;
    this.outputText = result.output;
  }

  protected override resetDerivedState(): void {
    this.readability = null;
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId = suggestionId;
  }
}
