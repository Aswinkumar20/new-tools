import { Component } from '@angular/core';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Navigation, TooltipDirective } from '@tools-workspace/features-home';
import { TextToolBase } from '../../shared/text-tool-base';
import { testRegex } from '../../shared/text-transform.utils';

@Component({
  selector: 'lib-regex-tester',
  standalone: true,
  templateUrl: './regex-tester.html',
  styleUrls: ['./regex-tester.scss'],
  imports: [FormsModule, CommonModule, Navigation, ReactiveFormsModule, TooltipDirective],
})
export class RegexTesterComponent extends TextToolBase {
  pattern = '';
  flagGlobal = true;
  flagIgnoreCase = false;
  flagMultiline = false;
  flagDotAll = false;
  flagUnicode = false;
  matchCount = 0;

  get flagsString(): string {
    let flags = '';
    if (this.flagGlobal) flags += 'g';
    if (this.flagIgnoreCase) flags += 'i';
    if (this.flagMultiline) flags += 'm';
    if (this.flagDotAll) flags += 's';
    if (this.flagUnicode) flags += 'u';
    return flags;
  }

  onPatternChange(): void {
    this.onOptionsChange();
  }

  onFlagChange(): void {
    this.onOptionsChange();
  }

  protected process(): void {
    if (!this.pattern) {
      this.matchCount = 0;
      this.outputText = '';
      return;
    }

    const result = testRegex(this.inputText, this.pattern, this.flagsString);
    if (result.error) {
      this.matchCount = 0;
      this.outputText = '';
      throw new Error(result.error);
    }

    this.matchCount = result.matches.length;
    this.outputText = result.matches
      .map((match, i) => {
        const start = match.index ?? 0;
        const end = start + match[0].length;
        const groups =
          match.length > 1
            ? ` groups: [${match.slice(1).map((g) => JSON.stringify(g ?? '')).join(', ')}]`
            : '';
        return `#${i + 1} [${start}–${end}] "${match[0]}"${groups}`;
      })
      .join('\n');
  }

  protected override resetDerivedState(): void {
    this.matchCount = 0;
  }
}
