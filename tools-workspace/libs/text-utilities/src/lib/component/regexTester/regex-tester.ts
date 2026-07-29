import { Component } from '@angular/core';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Navigation, TooltipDirective } from '@tools-workspace/features-home';
import { TextToolBase } from '../../shared/text-tool-base';
import type { TuRelatedToolLink, TuToolSuggestion } from '../../shared/tu-tool-suggestion.model';
import {
  REGEX_TESTER_DEFAULT_FLAGS,
  REGEX_TESTER_RELATED_TOOLS
} from '../../constants/regex-tester.constants';
import {
  buildRegexFlagsString,
  resolveRegexTesterSuggestion,
  runRegexTester
} from '../../utils/regex-tester.utils';

@Component({
  selector: 'lib-regex-tester',
  standalone: true,
  templateUrl: './regex-tester.html',
  styleUrls: ['./regex-tester.scss'],
  imports: [FormsModule, CommonModule, RouterLink, Navigation, ReactiveFormsModule, TooltipDirective]
})
export class RegexTesterComponent extends TextToolBase {
  pattern = '';
  flagGlobal = REGEX_TESTER_DEFAULT_FLAGS.global;
  flagIgnoreCase = REGEX_TESTER_DEFAULT_FLAGS.ignoreCase;
  flagMultiline = REGEX_TESTER_DEFAULT_FLAGS.multiline;
  flagDotAll = REGEX_TESTER_DEFAULT_FLAGS.dotAll;
  flagUnicode = REGEX_TESTER_DEFAULT_FLAGS.unicode;
  matchCount = 0;

  readonly relatedTools: ReadonlyArray<TuRelatedToolLink> = REGEX_TESTER_RELATED_TOOLS;
  private dismissedSuggestionId: string | null = null;

  get flagsString(): string {
    return buildRegexFlagsString({
      global: this.flagGlobal,
      ignoreCase: this.flagIgnoreCase,
      multiline: this.flagMultiline,
      dotAll: this.flagDotAll,
      unicode: this.flagUnicode
    });
  }

  get primarySuggestion(): TuToolSuggestion | null {
    const suggestion = resolveRegexTesterSuggestion({
      hasInput: this.hasInput,
      hasPattern: !!this.pattern,
      hasOutput: this.hasOutput,
      errorMessage: this.errorMessage,
      matchCount: this.matchCount,
      flagGlobal: this.flagGlobal
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

  onPatternChange(): void {
    this.onOptionsChange();
  }

  onFlagChange(): void {
    this.onOptionsChange();
  }

  protected process(): void {
    const result = runRegexTester({
      inputText: this.inputText,
      pattern: this.pattern,
      flags: {
        global: this.flagGlobal,
        ignoreCase: this.flagIgnoreCase,
        multiline: this.flagMultiline,
        dotAll: this.flagDotAll,
        unicode: this.flagUnicode
      }
    });

    if (result.errorMessage) {
      this.matchCount = 0;
      this.outputText = '';
      throw new Error(result.errorMessage);
    }

    this.matchCount = result.matchCount;
    this.outputText = result.output;
  }

  protected override resetDerivedState(): void {
    this.matchCount = 0;
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId = suggestionId;
  }
}
