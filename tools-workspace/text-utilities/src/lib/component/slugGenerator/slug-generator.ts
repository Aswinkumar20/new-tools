import { Component } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Navigation } from '@tools-workspace/features-home';

@Component({
  selector: 'lib-slug-generator',
  standalone: true,
  templateUrl: './slug-generator.html',
  styleUrls: ['./slug-generator.scss'],
  imports: [FormsModule, CommonModule, Navigation, ReactiveFormsModule],
})
export class SlugGeneratorComponent {
  inputText: string = '';
  slug: string = '';
  separator: string = '-';
  removeNumbers: boolean = false;
  slugHistory: string[] = [];

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
      this.showCopiedMessage();
    });
  }

  private showCopiedMessage() {
    const existing = document.querySelector('.copied-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.textContent = '✅ Slug copied to clipboard!';
    toast.className = 'copied-toast';
    document.body.appendChild(toast);

    Object.assign(toast.style, {
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      background: '#2196f3',
      color: 'white',
      padding: '10px 16px',
      borderRadius: '6px',
      boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
      zIndex: '9999',
      transition: 'opacity 0.3s ease',
    });

    setTimeout(() => (toast.style.opacity = '0'), 1800);
    setTimeout(() => toast.remove(), 2100);
  }
}
