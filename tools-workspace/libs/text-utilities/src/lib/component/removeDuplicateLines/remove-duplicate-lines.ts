import { Component, inject } from '@angular/core';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Navigation, TooltipDirective, AssetService } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-remove-duplicate-lines',
  standalone: true,
  templateUrl: './remove-duplicate-lines.html',
  styleUrls: ['./remove-duplicate-lines.scss'],
  imports: [FormsModule, CommonModule, Navigation, ReactiveFormsModule, TooltipDirective],
})
export class RemoveDuplicateLinesComponent {
  readonly assetService = inject(AssetService);

  inputText = '';
  outputText = '';
  highlightedInput = '';
  duplicateCount = 0;

  get hasInput(): boolean {
    return !!this.inputText.trim();
  }

  get wordCount(): number {
    return this.inputText
      ? this.inputText.trim().split(/\s+/).filter(w => w).length
      : 0;
  }

  private processInput(): void {
    if (!this.hasInput) {
      this.outputText = '';
      this.highlightedInput = '';
      this.duplicateCount = 0;
      return;
    }

    const words = this.inputText.split(/\s+/).filter(w => w !== undefined && w !== null && w !== '');
    const seen = new Set<string>();
    const duplicates = new Set<string>();

    this.outputText = words
      .filter(word => {
        const lower = word.toLowerCase();
        if (seen.has(lower)) {
          duplicates.add(lower);
          return false;
        }
        seen.add(lower);
        return true;
      })
      .join(' ');

    this.duplicateCount = duplicates.size;
    this.highlightedInput = words
      .map(word => (duplicates.has(word.toLowerCase()) ? `<mark>${word}</mark>` : word))
      .join(' ');
  }

  removeDuplicates(): void {
    this.processInput();
  }

  onInputChange(value: string): void {
    this.inputText = value;
    this.processInput();
  }

  copyInput(): void {
    this.copyText(this.inputText, 'Source');
  }

  copyOutput(): void {
    this.copyText(this.outputText, 'Clean output');
  }

  private copyText(text: string, label: string): void {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      alert(`${label} copied to clipboard!`);
    });
  }

  clear(): void {
    this.inputText = '';
    this.outputText = '';
    this.highlightedInput = '';
    this.duplicateCount = 0;
  }
}
