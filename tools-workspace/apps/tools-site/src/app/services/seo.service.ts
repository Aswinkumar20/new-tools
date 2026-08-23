import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
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
  robots?: string;
  structuredData?: unknown | unknown[];
}

export interface BreadcrumbItem {
  name: string;
  url: string;
}

@Injectable({
  providedIn: 'root',
})
export class SeoService {
  private readonly baseUrl = 'https://easytoolhub.com';
  private readonly defaultImage = 'https://easytoolhub.com/assets/og-image.svg';
  private readonly siteName = 'EasyToolHub';
  private readonly staticJsonLdScriptCount = 2;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    @Inject(DOCUMENT) private document: Document,
    private titleService: Title,
    private metaService: Meta,
    private router: Router
  ) {
    if (isPlatformBrowser(this.platformId)) {
      this.router.events
        .pipe(filter((event) => event instanceof NavigationEnd))
        .subscribe(() => {
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
    const title = metadata.title || this.siteName;

    const fullTitle = title.includes(this.siteName) ? title : `${title} | ${this.siteName}`;
    this.titleService.setTitle(fullTitle);

    this.updateMetaTag('name', 'title', title);
    this.updateMetaTag('name', 'description', metadata.description || '');
    this.updateMetaTag('name', 'keywords', metadata.keywords || '');
    this.updateMetaTag('name', 'robots', metadata.robots || 'index, follow');
    if (metadata.author) {
      this.updateMetaTag('name', 'author', metadata.author);
    }

    this.updateMetaTag('property', 'og:title', title);
    this.updateMetaTag('property', 'og:description', metadata.description || '');
    this.updateMetaTag('property', 'og:image', image);
    this.updateMetaTag('property', 'og:url', fullUrl);
    this.updateMetaTag('property', 'og:type', type);
    this.updateMetaTag('property', 'og:site_name', this.siteName);

    this.updateMetaTag('name', 'twitter:card', 'summary_large_image');
    this.updateMetaTag('name', 'twitter:title', title);
    this.updateMetaTag('name', 'twitter:description', metadata.description || '');
    this.updateMetaTag('name', 'twitter:image', image);
    this.updateMetaTag('name', 'twitter:url', fullUrl);

    this.updateCanonicalUrl(fullUrl);

    if (metadata.structuredData) {
      this.addStructuredData(metadata.structuredData);
    }
  }

  private updateMetaTag(attr: 'name' | 'property', selector: string, content: string): void {
    if (!content) return;

    if (attr === 'name') {
      this.metaService.updateTag({ name: selector, content });
    } else {
      this.metaService.updateTag({ property: selector, content });
    }
  }

  private updateCanonicalUrl(url?: string): void {
    const canonicalUrl = url || this.getCurrentUrl();
    const fullCanonicalUrl = canonicalUrl.startsWith('http')
      ? canonicalUrl
      : `${this.baseUrl}${canonicalUrl}`;

    let canonicalLink = this.document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (canonicalLink) {
      canonicalLink.setAttribute('href', fullCanonicalUrl);
    } else {
      canonicalLink = this.document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      canonicalLink.setAttribute('href', fullCanonicalUrl);
      this.document.head.appendChild(canonicalLink);
    }
  }

  private addStructuredData(data: unknown | unknown[]): void {
    const existingScripts = this.document.querySelectorAll('script[type="application/ld+json"]');
    for (let i = this.staticJsonLdScriptCount; i < existingScripts.length; i++) {
      existingScripts[i].remove();
    }

    const items = Array.isArray(data) ? data : [data];
    for (const item of items) {
      const script = this.document.createElement('script');
      script.type = 'application/ld+json';
      script.text = JSON.stringify(item);
      this.document.head.appendChild(script);
    }
  }

  private getCurrentUrl(): string {
    return this.router.url.split('?')[0] || '/tools/home';
  }

  generateToolStructuredData(toolName: string, description: string, url: string): unknown {
    return {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: toolName,
      description,
      url: url.startsWith('http') ? url : `${this.baseUrl}${url}`,
      applicationCategory: 'UtilityApplication',
      operatingSystem: 'Web',
      browserRequirements: 'Requires JavaScript',
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

  generateBreadcrumbStructuredData(items: BreadcrumbItem[]): unknown {
    return {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: items.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
        item: item.url.startsWith('http') ? item.url : `${this.baseUrl}${item.url}`,
      })),
    };
  }

  generateWebsiteStructuredData(): unknown {
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
          urlTemplate: `${this.baseUrl}/tools/home?search={search_term_string}`,
        },
        'query-input': 'required name=search_term_string',
      },
    };
  }

  generateOrganizationStructuredData(): unknown {
    return {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: this.siteName,
      url: this.baseUrl,
      logo: this.defaultImage,
      sameAs: [],
    };
  }
}
