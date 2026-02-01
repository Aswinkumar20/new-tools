import { Component, inject } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Navigation, AssetService } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-slug-generator',
  standalone: true,
  templateUrl: './slug-generator.html',
  styleUrls: ['./slug-generator.scss'],
  imports: [FormsModule, CommonModule, Navigation, ReactiveFormsModule],
})
export class SlugGeneratorComponent {
  readonly assetService = inject(AssetService);
  
  inputText: string = '';
  slug: string = '';
  separator: string = '-';
  removeNumbers: boolean = false;
  slugHistory: string[] = [];
  copied = false;

  onInputChange() {
    this.slug = this.generateSlug(this.inputText);
    if (this.slug && !this.slugHistory.includes(this.slug)) {
      this.slugHistory.unshift(this.slug);
    }
  }

  private generateSlug(text: string): string {
    let slug = text
      .toLowerCase()
      .trim()
      .replace(/[\s_]+/g, this.separator) // Replace spaces/underscores with separator
      .replace(/[^\w-]+/g, '') // Remove non-word chars
      .replace(/--+/g, this.separator) // Replace multiple hyphens
      .replace(/^-+|-+$/g, ''); // Trim leading/trailing hyphens

    if (this.removeNumbers) {
      slug = slug.replace(/[0-9]/g, '');
    }

    return slug;
  }

  copySlug() {
    if (!this.slug) return;
    navigator.clipboard.writeText(this.slug).then(() => {
      this.copied = true;
      setTimeout(() => (this.copied = false), 2000);
    });
  }

  reset() {
    this.inputText = '';
    this.slug = '';
    this.copied = false;
  }

  clearHistory() {
    this.slugHistory = [];
  }
}
