import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Navigation } from '../navigation/navigation';
import { AssetService } from '../../services/asset.service';
import { TooltipDirective } from '../../directive/tooltip.directive';
import { TOOL_CATEGORIES } from '../../config/tools-catalog.generated';
import { toHomeToolCategories } from '../../config/tools-catalog.helpers';

@Component({
  selector: 'lib-my-component',
  standalone: true,
  templateUrl: './my-component.html',
  styleUrl: './my-component.scss',
  imports: [
    CommonModule,
    FormsModule,
    Navigation,
    RouterModule,
    TooltipDirective,
  ],
})
export class MyComponent implements OnInit, AfterViewInit, OnDestroy {
  title = 'My Component';
  toolCategories = toHomeToolCategories(TOOL_CATEGORIES);

  searchQuery: string = '';
  filteredCategories: any[] = [];
  popularTools: Array<{ name: string; path: string; category: string; iconUrl: string }> = [];
  highlights: Array<{ title: string; description: string }> = [
    {
      title: 'Lightning Fast Processing',
      description: 'Launch any tool in under a second with zero install overhead and smart caching built for the browser.'
    },
    {
      title: 'Privacy First Design',
      description: 'Your data stays on your device. No silent syncs, no tracking pixels, and no surprise pop-ups.'
    },
    {
      title: 'Built for Everyone',
      description: 'Intuitive enough for beginners, yet powerful enough for professionals and development teams.'
    },
    {
      title: 'Fully Accessible',
      description: 'Keyboard-friendly navigation, high-contrast themes, and screen-reader aware markup across the board.'
    }
  ];
  totalTools = 0;
  weeklyHighlights = 0;
  isDarkMode = false;
  searchIconUrl = '';
  /** Categories whose tool list is scrolled past the top (button shows "Show less"). */
  scrolledCategoryNames = new Set<string>();
  featuredCategories: Array<{
    name: string;
    description?: string;
    iconUrl?: string;
    path: string;
    subCategories?: Array<{ path: string }>;
  }> = [];
  activeCategoryName: string | null = null;
  pageReady = false;
  readonly skeletonChipSlots = [0, 1, 2, 3, 4, 5];
  readonly skeletonCategorySlots = [0, 1, 2, 3, 4, 5];
  readonly skeletonPopularSlots = [0, 1, 2, 3, 4];
  readonly skeletonStatSlots = [0, 1, 2, 3];
  readonly skeletonCardSlots = [0, 1, 2, 3, 4, 5, 6, 7];
  readonly skeletonToolLineSlots = [0, 1, 2, 3, 4];
  readonly maxToolsPreview = 8;
  readonly featuredToolPaths = [
    'text-utilities/character-counter',
    'text-utilities/base64-encode-and-decode',
    'text-utilities/slug-generator',
    'data-converters/json-formatter-beautifier-validator',
    'pdf-tools/merge-pdfs',
    'security-tools/hash-generator',
    'fun-tools/qr-code-generator',
  ];
  @ViewChild('homepageSearch') homepageSearch?: ElementRef<HTMLInputElement>;
  readonly searchSuggestions = [
    'URL encoder',
    'Pako compress',
    'regex tester',
    'find and replace',
    'PDF merge',
    'JSON formatter',
    'password generator',
    'text case converter',
  ];
  suggestionIndex = 0;
  private suggestionTimer: ReturnType<typeof setInterval> | null = null;
  private readonly themeStorageKey = 'easytoolhub.theme';
  private readonly assetService = inject(AssetService);

  /** Maps category names to SVG filenames in assets/icons/categories/ */
  private readonly categoryIconFiles: Record<string, string> = {
    'Text & Utilities': 'text-utilities.svg',
    'File Viewers': 'file-viewers.svg',
    'JSON / Data Converters': 'json-data-converters.svg',
    'Number & Date Tools': 'number-date-tools.svg',
    'PDF Tools': 'pdf-tools.svg',
    'Image & Color Tools': 'image-color-tools.svg',
    'File & Code Tools': 'file-code-tools.svg',
    'Design & Web Dev Tools': 'dev-design-tools.svg',
    'Validation & Testing Tools': 'validation-testing-tools.svg',
    'Security & Crypto Tools': 'security-crypto-tools.svg',
    'Media & Audio Tools': 'media-audio-tools.svg',
    'System / Browser Utilities': 'system-browser-utilities.svg',
    'Fun & Productivity Tools': 'fun-productivity-tools.svg',
  };

  constructor(private readonly router: Router) {
    this.filteredCategories = this.toolCategories;
  }

  ngOnInit(): void {
    this.searchIconUrl = this.assetService.getAssetPath('icons/search.svg');
    this.attachIconPaths();
    this.featuredCategories = this.toolCategories;
    this.totalTools = this.computeTotalToolCount();
    this.popularTools = this.computePopularTools(8);
    this.weeklyHighlights = this.estimateWeeklyHighlights();
    this.hydrateThemePreference();
    this.startSuggestionRotation();
  }

  ngAfterViewInit(): void {
    this.focusSearchOnDesktop();
    // Defer so entrance animations run after first paint
    requestAnimationFrame(() => {
      this.pageReady = true;
    });
  }

  ngOnDestroy(): void {
    this.stopSuggestionRotation();
  }

  get currentSuggestion(): string {
    return this.searchSuggestions[this.suggestionIndex] ?? this.searchSuggestions[0];
  }

  get searchPlaceholder(): string {
    return `Search tools — try “${this.currentSuggestion}”…`;
  }

  get catalogMode(): 'browse' | 'category' | 'search' {
    if (this.searchQuery.trim()) {
      return 'search';
    }
    if (this.activeCategoryName) {
      return 'category';
    }
    return 'browse';
  }

  get hasActiveCatalogFilter(): boolean {
    return !!this.searchQuery.trim() || !!this.activeCategoryName;
  }

  navigateTo(path: string) {
    const normalized = path.startsWith('/') ? path : `/${path}`;
    this.router.navigateByUrl(normalized);
  }

  navigateToCategory(category: { path: string; subCategories?: Array<{ path: string }> }) {
    const first = category.subCategories?.[0];
    if (first?.path) {
      this.navigateTo(first.path);
      return;
    }
    this.router.navigateByUrl(`/${category.path}`);
  }

  exploreCategory(category: { name: string }) {
    if (this.activeCategoryName === category.name) {
      this.clearCategoryFilter();
      return;
    }
    this.activeCategoryName = category.name;
    this.searchQuery = '';
    this.filterCategories();
    this.scrollToCatalog();
  }

  applySuggestion(term?: string) {
    this.activeCategoryName = null;
    this.searchQuery = term?.trim() || this.currentSuggestion;
    this.filterCategories();
  }

  onSearchInput() {
    if (this.searchQuery.trim()) {
      this.activeCategoryName = null;
    }
    this.filterCategories();
  }

  scrollToCatalog() {
    const catalog = document.getElementById('catalog-title');
    catalog?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  clearSearch() {
    this.searchQuery = '';
    this.activeCategoryName = null;
    this.filterCategories();
  }

  clearCategoryFilter() {
    this.activeCategoryName = null;
    this.filterCategories();
  }

  private focusSearchOnDesktop() {
    if (typeof globalThis === 'undefined' || typeof globalThis.matchMedia !== 'function') {
      return;
    }
    const isDesktop = globalThis.matchMedia('(min-width: 768px)').matches;
    if (!isDesktop) {
      return;
    }
    queueMicrotask(() => this.homepageSearch?.nativeElement?.focus({ preventScroll: true }));
  }

  private startSuggestionRotation() {
    this.stopSuggestionRotation();
    if (typeof globalThis === 'undefined' || typeof globalThis.setInterval !== 'function') {
      return;
    }
    this.suggestionTimer = globalThis.setInterval(() => {
      if (this.searchQuery.trim()) {
        return;
      }
      this.suggestionIndex = (this.suggestionIndex + 1) % this.searchSuggestions.length;
    }, 2800);
  }

  private stopSuggestionRotation() {
    if (this.suggestionTimer != null) {
      globalThis.clearInterval(this.suggestionTimer);
      this.suggestionTimer = null;
    }
  }

  getDisplayTools(category: { name: string; subCategories?: Array<{ name: string; path: string; description?: string }> }) {
    return category.subCategories ?? [];
  }

  getToolPreviewRows(category: { subCategories?: unknown[] }): number {
    const count = category.subCategories?.length ?? 0;
    return Math.min(count, this.maxToolsPreview);
  }

  getPreviewLimit(category: { subCategories?: unknown[] }): number {
    return this.getToolPreviewRows(category);
  }

  isCategoryScrolled(category: { name: string }): boolean {
    return this.scrolledCategoryNames.has(category.name);
  }

  onCategoryToolsScroll(category: { name: string }, event: Event): void {
    const toolsList = event.currentTarget as HTMLElement | null;
    if (!toolsList) {
      return;
    }
    const scrolled = toolsList.scrollTop > 4;
    if (scrolled === this.scrolledCategoryNames.has(category.name)) {
      return;
    }
    if (scrolled) {
      this.scrolledCategoryNames.add(category.name);
    } else {
      this.scrolledCategoryNames.delete(category.name);
    }
    this.scrolledCategoryNames = new Set(this.scrolledCategoryNames);
  }

  scrollCategoryTools(category: { name: string }, event: Event): void {
    const toolsList = (event.currentTarget as HTMLElement | null)
      ?.closest('.home-card')
      ?.querySelector('.home-card__tools') as HTMLElement | null;
    if (!toolsList) {
      return;
    }
    const maxScroll = toolsList.scrollHeight - toolsList.clientHeight;
    if (maxScroll <= 0) {
      return;
    }
    const showingMore = toolsList.scrollTop > 4;
    toolsList.scrollTo({
      top: showingMore ? 0 : Math.min(toolsList.scrollTop + toolsList.clientHeight, maxScroll),
      behavior: 'smooth',
    });
    if (showingMore) {
      this.scrolledCategoryNames.delete(category.name);
    } else {
      this.scrolledCategoryNames.add(category.name);
    }
    this.scrolledCategoryNames = new Set(this.scrolledCategoryNames);
  }

  getRemainingToolCount(category: { subCategories?: unknown[] }): number {
    const total = category.subCategories?.length ?? 0;
    return Math.max(0, total - this.getPreviewLimit(category));
  }

  getVisibleToolCount(): number {
    return this.filteredCategories.reduce(
      (total, category) => total + (category.subCategories?.length ?? 0),
      0
    );
  }

  getSearchResults(): Array<{ name: string; path: string; category: string; description?: string }> {
    if (!this.searchQuery.trim()) {
      return [];
    }
    return this.filteredCategories.flatMap(category =>
      (category.subCategories ?? []).map((tool: { name: string; path: string; description?: string }) => ({
        name: tool.name,
        path: tool.path,
        category: category.name,
        description: tool.description,
      }))
    );
  }

  getCatalogListTools(): Array<{ name: string; path: string; category: string; description?: string }> {
    if (this.catalogMode === 'search') {
      return this.getSearchResults();
    }
    if (this.catalogMode === 'category') {
      const category = this.filteredCategories[0];
      if (!category) {
        return [];
      }
      return (category.subCategories ?? []).map((tool: { name: string; path: string; description?: string }) => ({
        name: tool.name,
        path: tool.path,
        category: category.name,
        description: tool.description,
      }));
    }
    return [];
  }

  clearAllCatalogFilters(): void {
    this.clearSearch();
  }

  toolInitial(name: string): string {
    return this.shortToolName(name).charAt(0).toUpperCase();
  }

  shortToolName(name: string): string {
    const parenIndex = name.indexOf('(');
    const trimmed = parenIndex > 0 ? name.slice(0, parenIndex).trim() : name;
    return trimmed.length > 36 ? `${trimmed.slice(0, 33)}…` : trimmed;
  }

  shortCategoryName(name: string): string {
    const shortNames: Record<string, string> = {
      'Text & Utilities': 'Text',
      'File Viewers': 'Files',
      'JSON / Data Converters': 'Data',
      'Number & Date Tools': 'Numbers',
      'PDF Tools': 'PDF',
      'Image & Color Tools': 'Image',
      'File & Code Tools': 'Code',
      'Design & Web Dev Tools': 'Dev',
      'Validation & Testing Tools': 'Validate',
      'Security & Crypto Tools': 'Security',
      'Media & Audio Tools': 'Media',
      'System / Browser Utilities': 'Browser',
      'Fun & Productivity Tools': 'Fun',
    };
    return shortNames[name] ?? (name.length > 12 ? `${name.slice(0, 10)}…` : name);
  }

  filterCategories() {
    const query = this.searchQuery.toLowerCase().trim();
    if (!query && this.activeCategoryName) {
      this.filteredCategories = this.toolCategories.filter(
        category => category.name === this.activeCategoryName
      );
      return;
    }

    if (!query) {
      this.filteredCategories = this.toolCategories;
      return;
    }

    this.filteredCategories = this.toolCategories
      .map(category => {
        const matchingTools = category.subCategories.filter((tool: any) =>
          tool.name.toLowerCase().includes(query) || tool.description.toLowerCase().includes(query)
        );
        if (
          category.name.toLowerCase().includes(query) ||
          category.description.toLowerCase().includes(query) ||
          matchingTools.length > 0
        ) {
          return { ...category, subCategories: matchingTools.length > 0 ? matchingTools : category.subCategories };
        }
        return null;
      })
      .filter((cat: any) => cat !== null);
  }

  onSearch(event: Event) {
    event.preventDefault();
    this.filterCategories();
    const first = this.getSearchResults()[0];
    if (first?.path) {
      this.navigateTo(first.path);
    }
  }

  toggleTheme() {
    this.isDarkMode = !this.isDarkMode;
    const storage = this.getLocalStorage();
    storage?.setItem(this.themeStorageKey, this.isDarkMode ? 'dark' : 'light');
  }

  trackByCategory = (_: number, category: any) => category?.name;
  trackByTool = (_: number, tool: any) => tool?.path ?? tool?.name;
  trackByHighlight = (_: number, highlight: any) => highlight?.title;
  
  private computeTotalToolCount(): number {
    return this.toolCategories.reduce((total, category) => {
      const toolsCount = Array.isArray(category.subCategories) ? category.subCategories.length : 0;
      return total + toolsCount;
    }, 0);
  }

  private computePopularTools(limit = 8): Array<{ name: string; path: string; category: string; iconUrl: string }> {
    const all = this.toolCategories.flatMap(category =>
      (category.subCategories ?? []).map((tool: { name: string; path: string; iconUrl?: string }) => ({
        name: tool.name,
        path: tool.path,
        category: category.name,
        iconUrl: tool.iconUrl ?? this.buildIconPath(tool.name),
      })),
    );
    const normalize = (path: string) => (path.startsWith('/') ? path.slice(1) : path);
    const featured = this.featuredToolPaths
      .map((fp) => all.find((tool) => normalize(tool.path) === fp))
      .filter((tool): tool is (typeof all)[number] => !!tool);
    const featuredPaths = new Set(featured.map((tool) => normalize(tool.path)));
    const rest = all.filter((tool) => !featuredPaths.has(normalize(tool.path)));
    return [...featured, ...rest].slice(0, limit);
  }

  private attachIconPaths(): void {
    this.toolCategories = this.toolCategories.map(category => {
      const iconUrl = this.buildIconPath(category.name);
      const subCategories = (category.subCategories ?? []).map((tool: any) => ({
        ...tool,
        iconUrl: tool.iconUrl ?? this.buildIconPath(tool.name)
      }));
      return { ...category, iconUrl, subCategories };
    });
    this.filteredCategories = this.toolCategories;
  }

  private buildIconPath(name: string): string {
    const categoryFile = this.categoryIconFiles[name];
    if (categoryFile) {
      return this.assetService.getAssetPath(`icons/categories/${categoryFile}`);
    }
    const segments = name.toLowerCase().match(/[a-z0-9]+/g);
    const slug = segments?.join('-') ?? 'icon';
    return this.assetService.getAssetPath(`icons/categories/${slug}.svg`);
  }

   private estimateWeeklyHighlights(): number {
    return Math.max(3, Math.round(this.toolCategories.length * 0.6));
  }

  private hydrateThemePreference() {
    const storage = this.getLocalStorage();
    const storedTheme = storage?.getItem(this.themeStorageKey);
    if (storedTheme === 'dark' || storedTheme === 'light') {
      this.isDarkMode = storedTheme === 'dark';
      return;
    }
    const matchMediaFn = this.getMatchMedia();
    const mediaQuery = matchMediaFn ? matchMediaFn('(prefers-color-scheme: dark)') : null;
    this.isDarkMode = mediaQuery?.matches ?? false;
  }

  private getLocalStorage(): Storage | null {
    if (typeof globalThis === 'undefined') {
      return null;
    }
    const globalObject = globalThis as typeof globalThis & { localStorage?: Storage };
    return globalObject.localStorage ?? null;
  }

  private getMatchMedia(): ((query: string) => MediaQueryList) | null {
    if (typeof globalThis === 'undefined') {
      return null;
    }
    const globalObject = globalThis as typeof globalThis & { matchMedia?: (query: string) => MediaQueryList };
    return typeof globalObject.matchMedia === 'function' ? globalObject.matchMedia.bind(globalObject) : null;
  }
}