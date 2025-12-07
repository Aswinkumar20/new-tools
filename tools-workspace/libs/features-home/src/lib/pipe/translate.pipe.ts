import { Pipe, PipeTransform, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Subscription } from 'rxjs';
import { TranslationService } from '../services/translation.service';
import { LanguageService } from '../services/language.service';

@Pipe({
  name: 'translate',
  standalone: true,
  pure: false // Make it impure to react to language changes
})
export class TranslatePipe implements PipeTransform, OnDestroy {
  private lastKey?: string;
  private lastParams?: { [key: string]: string | number };
  private lastValue?: string;
  private subscription?: Subscription;

  constructor(
    private translationService: TranslationService,
    private languageService: LanguageService,
    private changeDetector: ChangeDetectorRef
  ) {
    // Subscribe to language changes
    this.languageService.currentLanguage$.subscribe(() => {
      this.lastKey = undefined; // Reset cache
      this.lastValue = undefined;
      this.changeDetector.markForCheck();
    });

    // Also subscribe to translation updates
    this.translationService.translations$.subscribe(() => {
      this.lastKey = undefined; // Reset cache
      this.lastValue = undefined;
      this.changeDetector.markForCheck();
    });
  }

  transform(key: string, params?: { [key: string]: string | number }): string {
    // Always get fresh translation (since pipe is impure)
    const currentValue = this.translationService.translate(key, params);
    
    // Update cache
    this.lastKey = key;
    this.lastParams = params;
    this.lastValue = currentValue;

    return currentValue;
  }

  ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }
}

