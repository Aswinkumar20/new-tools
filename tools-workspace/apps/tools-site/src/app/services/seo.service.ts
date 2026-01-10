import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Title, Meta } from '@angular/platform-browser';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

export interface SeoMetadata {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  url?: string;
  type?: string;
  author?: string;
  structuredData?: any;
}

@Injectable({
  providedIn: 'root',
})
export class SeoService {
  private readonly baseUrl = 'https://easytoolhub.com';
  private readonly defaultImage = 'https://easytoolhub.com/assets/og-image.svg';
  private readonly siteName = 'EasyToolHub';

  private get document(): Document {
    if (isPlatformBrowser(this.platformId)) {
      return document;
    }
    // Return a mock document for SSR - Title and Meta services handle SSR
    return {} as Document;
  }

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private titleService: Title,
    private metaService: Meta,
    private router: Router
  ) {
    if (isPlatformBrowser(this.platformId)) {
      this.router.events
        .pipe(filter((event) => event instanceof NavigationEnd))
        .subscribe(() => {
          // Update canonical URL on route change
          this.updateCanonicalUrl();
        });
    }
  }

  /**
   * Update SEO metadata for the current page
   */
  updateMetadata(metadata: SeoMetadata): void {
    const url = metadata.url || this.getCurrentUrl();
    const fullUrl = url.startsWith('http') ? url : `${this.baseUrl}${url}`;
    const image = metadata.image || this.defaultImage;
    const type = metadata.type || 'website';

    // Update page title
    if (metadata.title) {
      const fullTitle = metadata.title.includes(this.siteName)
        ? metadata.title
        : `${metadata.title} | ${this.siteName}`;
      this.titleService.setTitle(fullTitle);
    }

    // Update or create meta tags
    this.updateMetaTag('name', 'title', metadata.title || '');
    this.updateMetaTag('name', 'description', metadata.description || '');
    this.updateMetaTag('name', 'keywords', metadata.keywords || '');
    if (metadata.author) {
      this.updateMetaTag('name', 'author', metadata.author);
    }

    // Open Graph tags
    this.updateMetaTag('property', 'og:title', metadata.title || '');
    this.updateMetaTag('property', 'og:description', metadata.description || '');
    this.updateMetaTag('property', 'og:image', image);
    this.updateMetaTag('property', 'og:url', fullUrl);
    this.updateMetaTag('property', 'og:type', type);
    this.updateMetaTag('property', 'og:site_name', this.siteName);

    // Twitter Card tags
    this.updateMetaTag('name', 'twitter:card', 'summary_large_image');
    this.updateMetaTag('name', 'twitter:title', metadata.title || '');
    this.updateMetaTag('name', 'twitter:description', metadata.description || '');
    this.updateMetaTag('name', 'twitter:image', image);
    this.updateMetaTag('name', 'twitter:url', fullUrl);

    // Update canonical URL
    this.updateCanonicalUrl(fullUrl);

    // Add structured data if provided
    if (metadata.structuredData) {
      this.addStructuredData(metadata.structuredData);
    }
  }

  /**
   * Update or create a meta tag
   */
  private updateMetaTag(attr: 'name' | 'property', selector: string, content: string): void {
    if (!content) return;

    // Use Angular's Meta service which handles SSR
    if (attr === 'name') {
      this.metaService.updateTag({ name: selector, content });
    } else {
      this.metaService.updateTag({ property: selector, content });
    }
  }

  /**
   * Update canonical URL
   */
  private updateCanonicalUrl(url?: string): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const canonicalUrl = url || this.getCurrentUrl();
    const fullCanonicalUrl = canonicalUrl.startsWith('http')
      ? canonicalUrl
      : `${this.baseUrl}${canonicalUrl}`;

    let canonicalLink = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    if (canonicalLink) {
      canonicalLink.setAttribute('href', fullCanonicalUrl);
    } else {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      canonicalLink.setAttribute('href', fullCanonicalUrl);
      document.head.appendChild(canonicalLink);
    }
  }

  /**
   * Add structured data (JSON-LD)
   */
  private addStructuredData(data: any): void {
    if (!isPlatformBrowser(this.platformId)) return;

    // Remove existing structured data scripts (keep the ones from index.html)
    const existingScripts = document.querySelectorAll('script[type="application/ld+json"]');
    // Remove all but the first two (website and organization schemas from index.html)
    if (existingScripts.length > 2) {
      for (let i = 2; i < existingScripts.length; i++) {
        existingScripts[i].remove();
      }
    }

    // Add new structured data
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.text = JSON.stringify(data);
    document.head.appendChild(script);
  }

  /**
   * Get current URL path
   */
  private getCurrentUrl(): string {
    if (isPlatformBrowser(this.platformId)) {
      return this.router.url.split('?')[0];
    }
    return '/';
  }

  /**
   * Generate structured data for a tool page
   */
  generateToolStructuredData(toolName: string, description: string, url: string): any {
    return {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: toolName,
      description: description,
      url: url.startsWith('http') ? url : `${this.baseUrl}${url}`,
      applicationCategory: 'UtilityApplication',
      operatingSystem: 'Web',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
      },
      provider: {
        '@type': 'Organization',
        name: this.siteName,
        url: this.baseUrl,
      },
    };
  }

  /**
   * Generate structured data for the website
   */
  generateWebsiteStructuredData(): any {
    return {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: this.siteName,
      url: this.baseUrl,
      description:
        'Streamline your daily tasks with powerful, easy-to-use tools for text, files, development, and more. Free online tools for everyone.',
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: `${this.baseUrl}/tools?search={search_term_string}`,
        },
        'query-input': 'required name=search_term_string',
      },
    };
  }

  /**
   * Generate structured data for organization
   */
  generateOrganizationStructuredData(): any {
    return {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: this.siteName,
      url: this.baseUrl,
      logo: this.defaultImage,
      sameAs: [
        // Add your social media profiles here when available
        // 'https://twitter.com/easytoolhub',
        // 'https://facebook.com/easytoolhub',
      ],
    };
  }
}

