import { Component, inject } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Navigation, TooltipDirective, AssetService } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-slug-generator',
  standalone: true,
  templateUrl: './slug-generator.html',
  styleUrls: ['./slug-generator.scss'],
  imports: [FormsModule, CommonModule, Navigation, ReactiveFormsModule, TooltipDirective],
})
export class SlugGeneratorComponent {
  readonly assetService = inject(AssetService);

  inputText = '';
  slug = '';
  separator = '-';
  removeNumbers = false;
  slugHistory: string[] = [];

  get hasInput(): boolean {
    return !!this.inputText.trim();
  }

  get separatorLabel(): string {
    if (this.separator === '-') return '-';
    if (this.separator === '_') return '_';
    if (this.separator === '+') return '+';
    return this.separator;
  }

  onInputChange(): void {
    this.slug = this.generateSlug(this.inputText);
    if (this.slug && !this.slugHistory.includes(this.slug)) {
      this.slugHistory.unshift(this.slug);
    }
  }

  private generateSlug(text: string): string {
    let slug = text
      .toLowerCase()
      .trim()
      .replace(/[\s_]+/g, this.separator)
      .replace(/[^\w-]+/g, '')
      .replace(/--+/g, this.separator)
      .replace(/^-+|-+$/g, '');

    if (this.removeNumbers) {
      slug = slug.replace(/[0-9]/g, '');
    }

    return slug;
  }

  copyInput(): void {
    this.copyText(this.inputText, 'Source');
  }

  copySlug(): void {
    this.copyText(this.slug, 'Slug');
  }

  private copyText(text: string, label: string): void {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      alert(`${label} copied to clipboard!`);
    });
  }

  reset(): void {
    this.inputText = '';
    this.slug = '';
  }

  clearHistory(): void {
    this.slugHistory = [];
  }
}
