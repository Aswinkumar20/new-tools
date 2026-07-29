import { Component } from '@angular/core';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Navigation, TooltipDirective } from '@tools-workspace/features-home';
import { TextToolBase } from '../../shared/text-tool-base';
import type { TuRelatedToolLink, TuToolSuggestion } from '../../shared/tu-tool-suggestion.model';
import {
  KEYWORD_DENSITY_DEFAULT_EXCLUDE_STOP_WORDS,
  KEYWORD_DENSITY_DEFAULT_TOP_N,
  KEYWORD_DENSITY_RELATED_TOOLS
} from '../../constants/keyword-density.constants';
import type { KeywordEntry } from '../../types/keyword-density.types';
import {
  clampKeywordTopN,
  computeKeywordDensityAnalysis,
  resolveKeywordDensitySuggestion
} from '../../utils/keyword-density.utils';

@Component({
  selector: 'lib-keyword-density',
  standalone: true,
  templateUrl: './keyword-density.html',
  styleUrls: ['./keyword-density.scss'],
  imports: [FormsModule, CommonModule, RouterLink, Navigation, ReactiveFormsModule, TooltipDirective]
})
export class KeywordDensityComponent extends TextToolBase {
  topN = KEYWORD_DENSITY_DEFAULT_TOP_N;
  excludeStopWords = KEYWORD_DENSITY_DEFAULT_EXCLUDE_STOP_WORDS;
  keywords: KeywordEntry[] = [];

  readonly relatedTools: ReadonlyArray<TuRelatedToolLink> = KEYWORD_DENSITY_RELATED_TOOLS;
  private dismissedSuggestionId: string | null = null;

  get primarySuggestion(): TuToolSuggestion | null {
    const top = this.keywords[0];
    const suggestion = resolveKeywordDensitySuggestion({
      hasInput: this.hasInput,
      keywordCount: this.keywords.length,
      excludeStopWords: this.excludeStopWords,
      topDensity: top?.density ?? 0,
      topWord: top?.word ?? ''
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

  onTopNChange(): void {
    this.topN = clampKeywordTopN(this.topN);
    this.onOptionsChange();
  }

  protected process(): void {
    const result = computeKeywordDensityAnalysis({
      inputText: this.inputText,
      topN: this.topN,
      excludeStopWords: this.excludeStopWords
    });
    this.keywords = result.keywords;
    this.outputText = result.output;
  }

  protected override resetDerivedState(): void {
    this.keywords = [];
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId = suggestionId;
  }
}
