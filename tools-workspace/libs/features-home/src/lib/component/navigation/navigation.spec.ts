import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { Navigation } from './navigation';
import { AssetService } from '../../services/asset.service';
import { LanguageService } from '../../services/language.service';
import { TranslationService } from '../../services/translation.service';
import { compareCatalogNames } from '../../config/tools-catalog.helpers';

describe('Navigation', () => {
  let component: Navigation;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        Navigation,
        {
          provide: Router,
          useValue: { navigateByUrl: jest.fn(), events: of(), url: '/tools/home' },
        },
        { provide: AssetService, useValue: { getAssetPath: (path: string) => `/assets/${path}` } },
        {
          provide: LanguageService,
          useValue: {
            getSupportedLanguages: () => [{ code: 'en', name: 'English', nativeName: 'English' }],
            getCurrentLanguage: () => 'en',
            getLanguageByCode: () => ({ code: 'en', name: 'English', nativeName: 'English' }),
            currentLanguage$: of('en'),
            setLanguage: jest.fn(),
          },
        },
        { provide: TranslationService, useValue: {} },
      ],
    });

    component = TestBed.inject(Navigation);
    component.ngOnInit();
  });

  afterEach(() => {
    component.ngOnDestroy();
  });

  it('should create with categories sorted ascending', () => {
    expect(component).toBeTruthy();
    const names = component.categoriesList.map((category) => category.name);
    expect(names).toEqual([...names].sort((left, right) => compareCatalogNames(left, right)));
  });
});
