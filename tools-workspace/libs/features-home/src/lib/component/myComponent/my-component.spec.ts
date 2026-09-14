import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { MyComponent } from './my-component';
import { AssetService } from '../../services/asset.service';
import { HOME_CATEGORY_ORDER, PRIMARY_HOME_CATEGORY_ORDER } from '../../config/tools-popularity.config';

describe('MyComponent', () => {
  let component: MyComponent;
  const navigateByUrl = jest.fn();

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        MyComponent,
        { provide: Router, useValue: { navigateByUrl } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: { get: () => null } } },
        },
        {
          provide: AssetService,
          useValue: { getAssetPath: (path: string) => `/assets/${path}` },
        },
      ],
    });

    component = TestBed.inject(MyComponent);
    component.ngOnInit();
  });

  afterEach(() => {
    component.ngOnDestroy();
    navigateByUrl.mockReset();
  });

  it('should create with popularity-ordered categories and tools', () => {
    expect(component).toBeTruthy();
    expect(component.toolCategories.length).toBeGreaterThan(0);

    const categoryPaths = component.toolCategories.map((category) => category.path);
    const expectedOrder = HOME_CATEGORY_ORDER.filter((path) => categoryPaths.includes(path));
    expect(categoryPaths.slice(0, expectedOrder.length)).toEqual(expectedOrder);

    const pdfCategory = component.toolCategories.find((category) => category.path === 'pdf-tools');
    expect(pdfCategory?.subCategories?.[0]?.path).toBe('/pdf-tools/merge-pdfs');

    const textCategory = component.toolCategories.find((category) => category.path === 'text-utilities');
    expect(textCategory?.subCategories?.[0]?.path).toBe('/text-utilities/character-counter');

    expect(component.heroCategories[0]?.path).toBe('pdf-tools');
    expect(component.browsePrimaryCategories[0]?.path).toBe('pdf-tools');
    expect(component.heroCategories.some((category) => category.path === 'cad-viewers')).toBe(false);
    expect(component.specialistCategories.some((category) => category.path === 'cad-viewers')).toBe(true);
    expect(component.browsePrimaryCategories.length).toBeGreaterThan(0);
    expect(component.browseSpecialistCategories.some((category) => category.path === 'cad-viewers')).toBe(true);
    expect(component.browseCategories.length).toBe(
      component.browsePrimaryCategories.length + component.browseSpecialistCategories.length
    );
    const cadIndex = component.browseCategories.findIndex((category) => category.path === 'cad-viewers');
    const mediaIndex = component.browseCategories.findIndex((category) => category.path === 'media-tools');
    expect(cadIndex).toBeGreaterThan(mediaIndex);

    expect(component.featuredCategories.map((category) => category.path)).toEqual(
      component.toolCategories.map((category) => category.path)
    );
    expect(component.totalTools).toBeGreaterThan(0);
    expect(component.visibleToolCount).toBe(component.totalTools);
    expect(component.popularTools[0]?.path).toBe('/text-utilities/character-counter');
  });

  it('enters search mode and surfaces a primary match', () => {
    component.searchQuery = 'json';
    component.filterCategories();

    expect(component.isSearchMode).toBe(true);
    expect(component.catalogMode).toBe('search');
    expect(component.activeCategoryName).toBeNull();
    expect(component.searchResults.length).toBeGreaterThan(0);
    expect(component.primarySearchResult?.name.toLowerCase()).toContain('json');
    expect(component.displayedSearchResults.length).toBeGreaterThan(0);
    expect(component.displayedSearchResults.length).toBeLessThanOrEqual(1 + component.maxSecondarySearchResults);
  });

  it('toggles a category filter and clears it', () => {
    const category = component.toolCategories[0];
    component.exploreCategory(category);

    expect(component.catalogMode).toBe('category');
    expect(component.activeCategoryName).toBe(category.name);
    expect(component.searchQuery).toBe('');
    expect(component.catalogListTools.length).toBe(category.subCategories?.length ?? 0);
    expect(component.visibleToolCount).toBe(category.subCategories?.length ?? 0);

    component.exploreCategory(category);
    expect(component.catalogMode).toBe('browse');
    expect(component.activeCategoryName).toBeNull();
    expect(component.filteredCategories.length).toBe(component.toolCategories.length);
  });

  it('opens the best match on submit when confidence is high', () => {
    component.searchQuery = 'merge pdfs';
    component.filterCategories();
    expect(component.searchConfidence).toBe('high');

    component.onSearch(new Event('submit'));

    expect(navigateByUrl).toHaveBeenCalled();
    const target = navigateByUrl.mock.calls[0][0] as string;
    expect(target).toBe('/pdf-tools/merge-pdfs');
  });

  it('does not auto-open on submit when confidence is low', () => {
    const scrollIntoView = jest.fn();
    jest.spyOn(document, 'getElementById').mockReturnValue({
      scrollIntoView,
    } as unknown as HTMLElement);

    component.searchQuery = 'asdfghjkl';
    component.filterCategories();
    component.onSearch(new Event('submit'));

    expect(navigateByUrl).not.toHaveBeenCalled();
  });

  it('opens after arrow-key selection even when confidence is not high', () => {
    component.searchQuery = 'compress';
    component.filterCategories();
    expect(component.displayedSearchResults.length).toBeGreaterThan(0);

    component.searchSelectionTouched = true;
    component.activeResultIndex = 0;
    component.activateHighlightedSearchResult();

    expect(navigateByUrl).toHaveBeenCalled();
  });

  it('applies try suggestions to existing tools without scrolling away', () => {
    const scrollIntoView = jest.fn();
    jest.spyOn(document, 'getElementById').mockReturnValue({
      scrollIntoView,
    } as unknown as HTMLElement);

    for (const suggestion of component.searchSuggestions) {
      component.applySuggestion(suggestion);
      expect(component.isSearchMode).toBe(true);
      expect(component.searchResults.length).toBeGreaterThan(0);
      expect(component.primarySearchResult?.path).toBeTruthy();
    }

    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it('keeps specialist categories visible in browse mode', () => {
    expect(component.browseSpecialistCategories.some((category) => category.path === 'cad-viewers')).toBe(true);

    component.clearAllCatalogFilters();
    expect(component.browseSpecialistCategories.some((category) => category.path === 'cad-viewers')).toBe(true);
  });

  it('clears search and category filters together', () => {
    component.searchQuery = 'pdf';
    component.filterCategories();
    component.clearAllCatalogFilters();

    expect(component.searchQuery).toBe('');
    expect(component.activeCategoryName).toBeNull();
    expect(component.catalogMode).toBe('browse');
    expect(component.searchResults).toEqual([]);
    expect(component.catalogListTools).toEqual([]);
  });
});
