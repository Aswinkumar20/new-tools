import { Component } from '@angular/core';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Navigation, TooltipDirective } from '@tools-workspace/features-home';
import { TextToolBase } from '../../shared/text-tool-base';
import { keywordDensity, KeywordEntry } from '../../shared/text-transform.utils';

@Component({
  selector: 'lib-keyword-density',
  standalone: true,
  templateUrl: './keyword-density.html',
  styleUrls: ['./keyword-density.scss'],
  imports: [FormsModule, CommonModule, Navigation, ReactiveFormsModule, TooltipDirective],
})
export class KeywordDensityComponent extends TextToolBase {
  topN = 20;
  excludeStopWords = true;
  keywords: KeywordEntry[] = [];

  onTopNChange(): void {
    const n = Math.max(1, Math.min(100, Math.round(this.topN || 20)));
    this.topN = n;
    this.onOptionsChange();
  }

  protected process(): void {
    this.keywords = keywordDensity(this.inputText, this.topN, this.excludeStopWords);
    if (!this.keywords.length) {
      this.outputText = '';
      return;
    }
    const header = 'Rank  Keyword              Count   Density %';
    const divider = '----  -------------------- -----   -----------';
    const rows = this.keywords.map(
      (entry, i) =>
        `${String(i + 1).padStart(4)}  ${entry.word.padEnd(20).slice(0, 20)} ${String(entry.count).padStart(5)}   ${entry.density.toFixed(2).padStart(9)}%`,
    );
    this.outputText = [header, divider, ...rows].join('\n');
  }

  protected override resetDerivedState(): void {
    this.keywords = [];
  }
}
