# Internationalization (i18n) System

This directory contains the internationalization system for the application, providing support for multiple languages across all components.

## Services

### LanguageService
Manages the current language state and provides language switching functionality.

**Usage:**
```typescript
import { LanguageService } from '@libs/features-home/services/language.service';

constructor(private languageService: LanguageService) {}

// Get current language
const currentLang = this.languageService.getCurrentLanguage(); // Returns 'en', 'es', etc.

// Set language
this.languageService.setLanguage('es');

// Get supported languages
const languages = this.languageService.getSupportedLanguages();

// Subscribe to language changes
this.languageService.currentLanguage$.subscribe(lang => {
  console.log('Language changed to:', lang);
});
```

### TranslationService
Handles loading and providing translations for the current language.

**Usage:**
```typescript
import { TranslationService } from '@libs/features-home/services/translation.service';

constructor(private translationService: TranslationService) {}

// Translate a key
const translated = this.translationService.translate('common.home');

// Translate with parameters
const translated = this.translationService.translate('welcome.message', { name: 'John' });
// Translation: "Welcome {{name}}" -> "Welcome John"
```

## Directives and Pipes

### TranslatePipe
Use in templates to translate text.

**Usage in Template:**
```html
<h1>{{ 'common.home' | translate }}</h1>
<p>{{ 'welcome.message' | translate: {name: 'John'} }}</p>
```

### TranslateDirective
Use as an attribute directive for automatic translation.

**Usage in Template:**
```html
<h1 appTranslate="common.home"></h1>
<p [appTranslate]="'welcome.message'" [translateParams]="{name: 'John'}"></p>
```

## Translation Files

Translation files are located in `apps/tools-site/src/assets/i18n/` as JSON files named by language code (e.g., `en.json`, `es.json`).

**Translation File Structure:**
```json
{
  "common": {
    "home": "Home",
    "search": "Search"
  },
  "navigation": {
    "home": "Home",
    "about": "About"
  }
}
```

**Accessing nested keys:**
- Use dot notation: `'common.home'` or `'navigation.about'`

**Parameters in translations:**
```json
{
  "welcome": {
    "message": "Welcome {{name}}!"
  }
}
```

## Adding Translations to Components

1. **Import the TranslatePipe:**
```typescript
import { TranslatePipe } from '@libs/features-home/pipe/translate.pipe';

@Component({
  imports: [TranslatePipe],
  // ...
})
```

2. **Use in template:**
```html
<button>{{ 'common.search' | translate }}</button>
```

3. **Or use the directive:**
```html
<button appTranslate="common.search"></button>
```

## Supported Languages

The system supports 30+ languages including:
- English (en)
- Spanish (es)
- French (fr)
- German (de)
- Italian (it)
- Portuguese (pt)
- Russian (ru)
- Chinese (zh)
- Japanese (ja)
- Korean (ko)
- Arabic (ar)
- Hindi (hi)
- And many more...

## Language Persistence

The selected language is automatically saved to `localStorage` and persists across sessions. The system also detects the browser's preferred language on first visit.

## Best Practices

1. **Use translation keys consistently:** Always use the same key structure across components
2. **Organize translations:** Group related translations under common namespaces (e.g., `common`, `navigation`, `errors`)
3. **Provide fallbacks:** Always include English translations as a fallback
4. **Test translations:** Verify that all translations load correctly and display properly
5. **Keep keys descriptive:** Use clear, descriptive keys that indicate their purpose

## Adding New Languages

1. Create a new JSON file in `apps/tools-site/src/assets/i18n/` (e.g., `pt.json`)
2. Add the language to `SUPPORTED_LANGUAGES` in `language.service.ts`
3. Copy the structure from `en.json` and translate all values
4. The system will automatically load the new language when selected

