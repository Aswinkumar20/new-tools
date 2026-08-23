import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { MyComponent } from './my-component';
import { AssetService } from '../../services/asset.service';
import { compareCatalogNames } from '../../config/tools-catalog.helpers';

describe('MyComponent', () => {
  let component: MyComponent;
  const navigateByUrl = jest.fn();

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        MyComponent,
        { provide: Router, useValue: { navigateByUrl } },
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

  it('should create with sorted categories and tools', () => {
    expect(component).toBeTruthy();
    expect(component.toolCategories.length).toBeGreaterThan(0);

    const categoryNames = component.toolCategories.map((category) => category.name);
    expect(categoryNames).toEqual(
      [...categoryNames].sort((left, right) => compareCatalogNames(left, right))
    );

    for (const category of component.toolCategories) {
      const toolNames = (category.subCategories ?? []).map((tool) => tool.name);
      expect(toolNames).toEqual(
        [...toolNames].sort((left, right) => compareCatalogNames(left, right))
      );
    }

    expect(component.featuredCategories.map((category) => category.name)).toEqual(categoryNames);
    expect(component.filteredCategories.map((category) => category.name)).toEqual(categoryNames);
    expect(component.totalTools).toBeGreaterThan(0);
    expect(component.visibleToolCount).toBe(component.totalTools);
  });

  it('filters tools by search query without crashing on missing descriptions', () => {
    component.searchQuery = 'json';
    component.onSearchInput();

    expect(component.catalogMode).toBe('search');
    expect(component.activeCategoryName).toBeNull();
    expect(component.searchResults.length).toBeGreaterThan(0);
    expect(component.catalogListTools.length).toBe(component.searchResults.length);
    expect(component.visibleToolCount).toBe(component.searchResults.length);
    expect(
      component.searchResults.every(
        (tool) =>
          tool.name.toLowerCase().includes('json') ||
          tool.description?.toLowerCase().includes('json') ||
          tool.category.toLowerCase().includes('json')
      )
    ).toBe(true);
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

  it('navigates to the first search result on submit', () => {
    component.searchQuery = 'hash';
    component.onSearch(new Event('submit'));

    expect(navigateByUrl).toHaveBeenCalled();
    const target = navigateByUrl.mock.calls[0][0] as string;
    expect(target.startsWith('/')).toBe(true);
  });

  it('applies try suggestions to existing tools without scrolling away', () => {
    const scrollIntoView = jest.fn();
    jest.spyOn(document, 'getElementById').mockReturnValue({
      scrollIntoView,
    } as unknown as HTMLElement);

    for (const suggestion of component.searchSuggestions) {
      component.applySuggestion(suggestion);
      const tokens = suggestion
        .toLowerCase()
        .replace(/&/g, ' and ')
        .split(/\s+/)
        .filter((token) => token && token !== 'and');
      expect(component.searchResults.length).toBeGreaterThan(0);
      expect(
        component.searchResults.some((tool) => {
          const name = tool.name.toLowerCase().replace(/&/g, ' and ');
          return tokens.every((token) => name.includes(token));
        })
      ).toBe(true);
    }

    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it('clears search and category filters together', () => {
    component.searchQuery = 'pdf';
    component.onSearchInput();
    component.clearAllCatalogFilters();

    expect(component.searchQuery).toBe('');
    expect(component.activeCategoryName).toBeNull();
    expect(component.catalogMode).toBe('browse');
    expect(component.searchResults).toEqual([]);
    expect(component.catalogListTools).toEqual([]);
  });
});
