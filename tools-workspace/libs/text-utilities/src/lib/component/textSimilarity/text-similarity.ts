import { Component } from '@angular/core';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Navigation, TooltipDirective } from '@tools-workspace/features-home';
import { TextToolBase } from '../../shared/text-tool-base';
import { levenshteinDistance, similarityPercent } from '../../shared/text-transform.utils';

@Component({
  selector: 'lib-text-similarity',
  standalone: true,
  templateUrl: './text-similarity.html',
  styleUrls: ['./text-similarity.scss'],
  imports: [FormsModule, CommonModule, Navigation, ReactiveFormsModule, TooltipDirective],
})
export class TextSimilarityComponent extends TextToolBase {
  textB = '';
  similarity = 0;
  distance = 0;

  override get hasOutput(): boolean {
    return !!(this.inputText || this.textB) && !this.errorMessage;
  }

  onTextBChange(): void {
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
    this.similarity = similarityPercent(this.inputText, this.textB);
    this.distance = levenshteinDistance(this.inputText, this.textB);
    this.outputText = [
      `Similarity: ${this.similarity}%`,
      `Levenshtein distance: ${this.distance}`,
      '',
      `Text A length: ${this.inputText.length} chars`,
      `Text B length: ${this.textB.length} chars`,
    ].join('\n');
  }
}
