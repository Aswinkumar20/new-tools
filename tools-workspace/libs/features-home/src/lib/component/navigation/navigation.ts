import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'lib-navigation',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './navigation.html',
  styleUrls: ['./navigation.scss'],
})
export class NavigationComponent implements OnInit {
  title = 'My Component';
  categoriesList: any = [
    {
      name: 'Text & Utilities',
      description: 'Useful tools for editing and analyzing text',
      icon: 'text_fields',
      path: 'text-utilities',
      subCategories: [
        {
          name: 'Word & Character Counter',
          path: '/text-utilities/character-counter',
          description: 'Count words, characters, and spaces in your text instantly.'
        },
        {
          name: 'Text Case Changer',
          path: 'text-utilities/text-case-convertor',
          description: 'Convert text to UPPERCASE, lowercase, or Capitalized formats.'
        },
        {
          name: 'Convert Text to ASCII',
          path: 'text-utilities/text-to-ascii',
          description: 'Convert characters to their ASCII values and back.'
        },
        {
          name: 'Remove Duplicate Lines',
          path: 'text-utilities/remove-duplicate-lines',
          description: 'Eliminate repeated lines from your text quickly.'
        },
        {
          name: 'Reverse Text & Check Palindrome',
          path: 'text-utilities/text-reversal-and-palindrome-checker',
          description: 'Reverse text or check if a string is a palindrome.'
        },
        {
          name: 'Base64 Encoder & Decoder',
          path: 'text-utilities/base64-encode-and-decode',
          description: 'Encode or decode text using Base64 format.'
        },
        {
          name: 'Create URL Slugs',
          path: 'text-utilities/slug-generator',
          description: 'Generate clean, SEO-friendly slugs from your text.'
        },
        {
          name: 'Compare Text Differences',
          path: 'text-utilities/text-difference',
          description: 'Find and highlight differences between two text blocks.'
        },
        {
          name: 'Merge Code Snippets',
          path: 'text-utilities/code-merge',
          description: 'Merge and review differences in code or text snippets.'
        }
      ]
    }
  ];
  logoUrl:any= '';

  isDropdownOpen = false;
  hoveredCategory: any = null;
  activeLink: string = 'home';
  isMobileMenuOpen = false;
  expandedMobileCategory: string | null = null;
  private isDesktop = false;

  constructor(private readonly router: Router) { }

  ngOnInit(): void {
    this.logoUrl = 'assets/icons/logo-icon.svg'; // Update with your actual logo path
    this.evaluateViewport();
  }

  @HostListener('window:resize')
  onResize(): void {
    this.evaluateViewport();
  }
  
  navigateTo(path: string, activeKey: string = path) {
    this.activeLink = activeKey === '../text-utilities' ? 'categories' : activeKey;
    if (activeKey === 'categories' && this.isDesktop) {
      this.isDropdownOpen = false;
    }
    if (!this.isDesktop) {
      this.closeMobileMenu();
    }
    if (path === 'home') {
      this.router.navigate(['/product-home']);
      return;
    }
    this.router.navigate([path]);
  }

  onDropdownEnter(): void {
    if (!this.isDesktop) {
      return;
    }
    this.isDropdownOpen = true;
    this.hoveredCategory = this.categoriesList?.[0] ?? null;
  }

  onDropdownLeave(): void {
    if (!this.isDesktop) {
      return;
    }
    this.isDropdownOpen = false;
  }

  toggleCategoriesDropdown(): void {
    if (!this.isDesktop) {
      return;
    }
    this.isDropdownOpen = !this.isDropdownOpen;
    if (this.isDropdownOpen) {
      this.hoveredCategory = this.categoriesList?.[0] ?? null;
    }
  }

  hoverMegaCategory(category: any): void {
    this.hoveredCategory = category;
  }

  toggleMobileMenu(): void {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
    if (!this.isMobileMenuOpen) {
      this.expandedMobileCategory = null;
    }
  }

  closeMobileMenu(): void {
    this.isMobileMenuOpen = false;
    this.expandedMobileCategory = null;
  }

  toggleMobileCategory(categoryName: string): void {
    this.expandedMobileCategory =
      this.expandedMobileCategory === categoryName ? null : categoryName;
  }

  private evaluateViewport(): void {
    const globalObject = globalThis as typeof globalThis & {
      matchMedia?: (query: string) => MediaQueryList;
    };
    this.isDesktop = globalObject.matchMedia?.('(min-width: 1024px)')?.matches ?? false;
    if (this.isDesktop) {
      this.isMobileMenuOpen = false;
      this.expandedMobileCategory = null;
    } else {
      this.isDropdownOpen = false;
    }
  }
}

export { NavigationComponent as Navigation };
