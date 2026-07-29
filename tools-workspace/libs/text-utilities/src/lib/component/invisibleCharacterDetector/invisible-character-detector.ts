import { Component } from '@angular/core';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Navigation, TooltipDirective } from '@tools-workspace/features-home';
import { TextToolBase } from '../../shared/text-tool-base';
import type { TuRelatedToolLink, TuToolSuggestion } from '../../shared/tu-tool-suggestion.model';
import { INVISIBLE_CHARACTER_DETECTOR_RELATED_TOOLS } from '../../constants/invisible-character-detector.constants';
import type { InvisibleCharHit } from '../../types/invisible-character-detector.types';
import {
  detectAndAnnotateInvisibleChars,
  formatInvisibleCodePoint,
  resolveInvisibleCharacterSuggestion,
  summarizeInvisibleHits
} from '../../utils/invisible-character-detector.utils';

@Component({
  selector: 'lib-invisible-character-detector',
  standalone: true,
  templateUrl: './invisible-character-detector.html',
  styleUrls: ['./invisible-character-detector.scss'],
  imports: [FormsModule, CommonModule, RouterLink, Navigation, ReactiveFormsModule, TooltipDirective]
})
export class InvisibleCharacterDetectorComponent extends TextToolBase {
  invisibleHits: InvisibleCharHit[] = [];

  readonly relatedTools: ReadonlyArray<TuRelatedToolLink> = INVISIBLE_CHARACTER_DETECTOR_RELATED_TOOLS;
  private dismissedSuggestionId: string | null = null;

  get invisibleCount(): number {
    return this.invisibleHits.length;
  }

  get primarySuggestion(): TuToolSuggestion | null {
    const summary = summarizeInvisibleHits(this.invisibleHits);
    const suggestion = resolveInvisibleCharacterSuggestion({
      hasInput: this.hasInput,
      hitCount: summary.hitCount,
      hasZeroWidth: summary.hasZeroWidth,
      hasBom: summary.hasBom,
      hasNbspOrSoftHyphen: summary.hasNbspOrSoftHyphen
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
    const result = detectAndAnnotateInvisibleChars(this.inputText);
    this.invisibleHits = result.hits;
    this.outputText = result.output;
  }

  protected override resetDerivedState(): void {
    this.invisibleHits = [];
  }

  formatHitCodePoint(codePoint: number): string {
    return formatInvisibleCodePoint(codePoint);
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId = suggestionId;
  }
}
