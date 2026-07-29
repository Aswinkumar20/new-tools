import { Component } from '@angular/core';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Navigation, TooltipDirective } from '@tools-workspace/features-home';
import { TextToolBase } from '../../shared/text-tool-base';
import type { TuRelatedToolLink, TuToolSuggestion } from '../../shared/tu-tool-suggestion.model';
import { TEXT_SIMILARITY_RELATED_TOOLS } from '../../constants/text-similarity.constants';
import {
  computeTextSimilarity,
  resolveTextSimilaritySuggestion,
} from '../../utils/text-similarity.utils';

@Component({
  selector: 'lib-text-similarity',
  standalone: true,
  templateUrl: './text-similarity.html',
  styleUrls: ['./text-similarity.scss'],
  imports: [FormsModule, CommonModule, RouterLink, Navigation, ReactiveFormsModule, TooltipDirective],
})
export class TextSimilarityComponent extends TextToolBase {
  textB = '';
  similarity = 0;
  distance = 0;

  readonly relatedTools: ReadonlyArray<TuRelatedToolLink> = TEXT_SIMILARITY_RELATED_TOOLS;
  private dismissedSuggestionId: string | null = null;

  override get hasOutput(): boolean {
    return !!(this.inputText || this.textB) && !this.errorMessage;
  }

  get hasTextB(): boolean {
    return !!this.textB?.trim();
  }

  get primarySuggestion(): TuToolSuggestion | null {
    const suggestion = resolveTextSimilaritySuggestion({
      hasTextA: this.hasInput,
      hasTextB: this.hasTextB,
      similarity: this.similarity,
      distance: this.distance,
      lengthA: this.inputText.length,
      lengthB: this.textB.length,
    });
    if (!suggestion || this.dismissedSuggestionId === suggestion.id) {
      return null;
    }
    return suggestion;
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId = suggestionId;
  }

  override onInputChange(): void {
    this.dismissedSuggestionId = null;
    super.onInputChange();
  }

  onTextBChange(): void {
    this.dismissedSuggestionId = null;
    this.runProcess();
  }

  copyTextB(): void {
    this.copyText(this.textB, 'Text B');
  }

  override clear(): void {
    super.clear();
    this.textB = '';
    this.similarity = 0;
    this.distance = 0;
    this.dismissedSuggestionId = null;
  }

  override downloadText(): void {
    if (!this.hasOutput) return;
    const blob = new Blob([this.outputText], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'similarity-report.txt';
    link.click();
    URL.revokeObjectURL(link.href);
    this.toastService.info('Download started');
  }

  protected override runProcess(): void {
    this.errorMessage = '';
    if (!this.inputText && !this.textB) {
      this.outputText = '';
      this.similarity = 0;
      this.distance = 0;
      return;
    }
    try {
      this.process();
    } catch (e) {
      this.outputText = '';
      this.errorMessage = (e as Error).message || 'Processing failed.';
    }
  }

  protected process(): void {
    const result = computeTextSimilarity(this.inputText, this.textB);
    this.similarity = result.similarity;
    this.distance = result.distance;
    this.outputText = result.report;
  }
}
