import { Component } from '@angular/core';

@Component({
  selector: 'lib-slug-generator',
  standalone: false,
  templateUrl: './slug-generator.html',
  styleUrls: ['./slug-generator.scss'],
})
export class SlugGenerator {
  inputText: string = '';
  slug: string = '';

  onInputChange() {
    this.slug = this.generateSlug(this.inputText);
  }

  private generateSlug(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[\s_]+/g, '-')       // Replace spaces/underscores with -
      .replace(/[^\w-]+/g, '')       // Remove non-word chars
      .replace(/--+/g, '-')          // Replace multiple hyphens
      .replace(/^-+|-+$/g, '');      // Trim leading/trailing hyphens
  }
}
