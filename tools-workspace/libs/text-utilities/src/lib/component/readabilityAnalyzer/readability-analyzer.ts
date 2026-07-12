import { Component } from '@angular/core';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Navigation, TooltipDirective } from '@tools-workspace/features-home';
import { TextToolBase } from '../../shared/text-tool-base';
import { analyzeReadability, ReadabilityResult } from '../../shared/text-transform.utils';

@Component({
  selector: 'lib-readability-analyzer',
  standalone: true,
  templateUrl: './readability-analyzer.html',
  styleUrls: ['./readability-analyzer.scss'],
  imports: [FormsModule, CommonModule, Navigation, ReactiveFormsModule, TooltipDirective],
})
export class ReadabilityAnalyzerComponent extends TextToolBase {
  readability: ReadabilityResult | null = null;

  protected process(): void {
    this.readability = analyzeReadability(this.inputText);
    const r = this.readability;
    if (!r.words) {
      this.outputText = '';
      return;
    }
    this.outputText = [
      'Readability Report',
      '==================',
      '',
      `Words: ${r.words}`,
      `Sentences: ${r.sentences}`,
      `Syllables: ${r.syllables}`,
      '',
      `Flesch Reading Ease: ${r.fleschReadingEase}`,
      `Flesch-Kincaid Grade: ${r.fleschKincaidGrade}`,
      `Reading Level: ${r.readingLevel}`,
      '',
      `Avg words per sentence: ${r.avgWordsPerSentence}`,
      `Avg syllables per word: ${r.avgSyllablesPerWord}`,
    ].join('\n');
  }

  protected override resetDerivedState(): void {
    this.readability = null;
  }
}
