import { isPlatformBrowser } from '@angular/common';
import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
import { LanguageService } from './language.service';

export interface Translations {
  [key: string]: string | Translations;
}

@Injectable({
  providedIn: 'root'
})
export class TranslationService {
  private translationsSubject = new BehaviorSubject<Translations>({});
  public translations$: Observable<Translations> = this.translationsSubject.asObservable();

  private translationsCache: Map<string, Translations> = new Map();
  private readonly isBrowser: boolean;

  constructor(
    private http: HttpClient,
    private languageService: LanguageService,
    @Inject(PLATFORM_ID) platformId: object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);

    // Load initial translations (browser only — assets are unavailable during prerender)
    this.loadTranslations(this.languageService.getCurrentLanguage());

    // Reload translations when language changes
    this.languageService.currentLanguage$.subscribe(lang => {
      this.loadTranslations(lang);
    });
  }

  private loadTranslations(languageCode: string): void {
    // Check cache first
    if (this.translationsCache.has(languageCode)) {
      this.translationsSubject.next(this.translationsCache.get(languageCode)!);
      return;
    }

    if (!this.isBrowser) {
      const emptyTranslations: Translations = {};
      this.translationsCache.set(languageCode, emptyTranslations);
      this.translationsSubject.next(emptyTranslations);
      return;
    }

    // Try to load from assets
    const translationPath = `assets/i18n/${languageCode}.json`;

    this.http.get<Translations>(translationPath).pipe(
      map(translations => {
        this.translationsCache.set(languageCode, translations);
        this.translationsSubject.next(translations);
        return translations;
      }),
      catchError((error) => {
        console.warn(`Failed to load translations for ${languageCode}:`, error);
        // Fallback to English if translation file not found
        if (languageCode !== 'en') {
          this.loadTranslations('en');
          return of({});
        }
        // If English also fails, use empty translations
        const emptyTranslations: Translations = {};
        this.translationsCache.set('en', emptyTranslations);
        this.translationsSubject.next(emptyTranslations);
        return of(emptyTranslations);
      })
    ).subscribe();
  }

  translate(key: string, params?: { [key: string]: string | number }): string {
    const translations = this.translationsSubject.value;
    const value = this.getNestedValue(translations, key);

    if (!value || typeof value !== 'string') {
      // Return key if translation not found (for development)
      console.warn(`Translation missing for key: ${key}`);
      return key;
    }

    // Replace parameters in translation
    if (params) {
      return this.replaceParams(value, params);
    }

    return value;
  }

  private getNestedValue(obj: any, path: string): string | undefined {
    return path.split('.').reduce((current, prop) => {
      return current && current[prop] !== undefined ? current[prop] : undefined;
    }, obj);
  }

  private replaceParams(text: string, params: { [key: string]: string | number }): string {
    return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return params[key] !== undefined ? String(params[key]) : match;
    });
  }

  getTranslations(): Translations {
    return this.translationsSubject.value;
  }
}
