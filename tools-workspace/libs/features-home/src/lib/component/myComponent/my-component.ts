import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  ViewChild,
  inject,
} from '@angular/core';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Navigation } from '../navigation/navigation';
import { AssetService } from '../../services/asset.service';
import { TooltipDirective } from '../../directive/tooltip.directive';
import { TOOL_CATEGORIES } from '../../config/tools-catalog.generated';
import { pickGlobalPopularTools, splitHomeCategories, toHomeToolCategories } from '../../config/tools-catalog.helpers';
import { isSpecialistHomeCategory } from '../../config/tools-popularity.config';
import { ROUTE_PREFETCH } from '../../tokens/route-prefetch.token';
import {
  getToolSearchEngine,
  SEARCH_LIMITS,
  type SearchClarification,
  type SearchConfidence,
  type ToolSearchEngine,
  type ToolSearchResult,
} from '../../search';

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

  searchQuery = '';
  filteredCategories: any[] = this.toolCategories;
  searchResults: ToolSearchResult[] = [];
  relatedSearchResults: ToolSearchResult[] = [];
  searchConfidence: SearchConfidence = 'low';
  searchClarification: SearchClarification | null = null;
  searchRecoveryHint: string | null = null;
  activeResultIndex = -1;
  /** True after ArrowUp/ArrowDown — Enter may open even on medium/low confidence. */
  searchSelectionTouched = false;
  catalogListTools: Array<{ name: string; path: string; category: string; description?: string }> = [];
  visibleToolCount = 0;
  readonly searchReformulationHints = [
    'make photo smaller',
    'compress pdf',
    'combine PDF files',
    'format JSON',
    'make a QR code',
    'count words',
  ];
  readonly maxSecondarySearchResults = 7;
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
  primaryCategories: Array<{
    name: string;
    description?: string;
    iconUrl?: string;
    path: string;
    subCategories?: Array<{ path: string; name: string; description?: string }>;
  }> = [];
  specialistCategories: Array<{
    name: string;
    description?: string;
    iconUrl?: string;
    path: string;
    subCategories?: Array<{ path: string; name: string; description?: string }>;
  }> = [];
  /** Hero chips + default catalog — everyday tools only. */
  heroCategories: Array<{
    name: string;
    description?: string;
    iconUrl?: string;
    path: string;
    subCategories?: Array<{ path: string }>;
  }> = [];
  browsePrimaryCategories: typeof this.primaryCategories = [];
  browseSpecialistCategories: typeof this.specialistCategories = [];
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
  @ViewChild('homepageSearch') homepageSearch?: ElementRef<HTMLInputElement>;
  readonly searchSuggestions = [
    'make photo smaller',
    'combine PDF files',
    'format JSON',
    'make a QR code',
    'count words',
    'compress PDF',
    'resize image',
    'change text case',
  ];
  suggestionIndex = 0;
  animatedSuggestionText = '';
  private suggestionAnimTimer: ReturnType<typeof setTimeout> | null = null;
  private suggestionInterval: ReturnType<typeof setInterval> | null = null;
  private suggestionCharIndex = 0;
  private suggestionMode: 'type' | 'hold' | 'delete' = 'type';
  private prefersReducedMotion = false;
  private readonly suggestionTypeMs = 58;
  private readonly suggestionDeleteMs = 32;
  private readonly suggestionHoldMs = 2400;
  private readonly suggestionGapMs = 320;
  private readonly themeStorageKey = 'theme';
  private readonly assetService = inject(AssetService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly prefetchRoute = inject(ROUTE_PREFETCH, { optional: true });
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly searchEngine: ToolSearchEngine = getToolSearchEngine(TOOL_CATEGORIES);
  private searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

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
    'CAD & Engineering Viewers': 'cad-viewers.svg',
    'GIS & Mapping Viewers': 'gis-viewers.svg',
    'Medical & Healthcare Viewers': 'medical-viewers.svg',
    'Scientific Data Viewers': 'science-viewers.svg',
    'Network & Traffic Viewers': 'network-viewers.svg',
    'Process & Workflow Viewers': 'process-viewers.svg',
    'Diagram & Graph Viewers': 'diagram-viewers.svg',
    'Data Explorers': 'data-explorers.svg',
    'ML Model Viewers': 'ml-viewers.svg',
  };

  ngOnInit(): void {
    this.searchIconUrl = this.assetService.getAssetPath('icons/search.svg');
    this.attachIconPaths();
    const { primary, specialist } = splitHomeCategories(this.toolCategories);
    this.primaryCategories = primary;
    this.specialistCategories = specialist;
    this.heroCategories = primary;
    this.featuredCategories = [...primary, ...specialist];
    this.totalTools = this.computeTotalToolCount();
    this.popularTools = this.computePopularTools(8);
    this.weeklyHighlights = this.estimateWeeklyHighlights();

    const searchParam = this.route.snapshot.queryParamMap.get('search');
    if (searchParam?.trim()) {
      this.searchQuery = searchParam.trim();
    }
    this.filterCategories();

    if (this.isBrowser) {
      this.hydrateThemePreference();
      this.prefersReducedMotion =
        globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
      this.startSuggestionAnimation();
    }
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser) {
      this.pageReady = true;
      return;
    }
    // Defer so entrance animations run after first paint (browser only)
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => {
        this.pageReady = true;
        globalThis.setTimeout(() => this.focusHomeSearch(), 680);
      });
    } else {
      this.pageReady = true;
      this.focusHomeSearch();
    }
  }

  ngOnDestroy(): void {
    this.stopSuggestionAnimation();
    if (this.searchDebounceTimer != null) {
      clearTimeout(this.searchDebounceTimer);
      this.searchDebounceTimer = null;
    }
  }

  get currentSuggestion(): string {
    return this.searchSuggestions[this.suggestionIndex] ?? this.searchSuggestions[0];
  }

  get showAnimatedSearchPlaceholder(): boolean {
    return !this.searchQuery.trim();
  }

  /** Option B: homepage is in dedicated search mode (hero compact, results own the page). */
  get isSearchMode(): boolean {
    return !!this.searchQuery.trim();
  }

  get primarySearchResult(): ToolSearchResult | null {
    return this.searchResults[0] ?? null;
  }

  get secondarySearchResults(): ToolSearchResult[] {
    return this.searchResults.slice(1, 1 + this.maxSecondarySearchResults);
  }

  /** Results shown in search mode (best + capped others) for keyboard nav. */
  get displayedSearchResults(): ToolSearchResult[] {
    if (!this.searchResults.length) {
      return [];
    }
    return [this.searchResults[0], ...this.secondarySearchResults];
  }

  get searchResultsHeading(): string {
    if (this.searchClarification) {
      return 'Refine your search';
    }
    if (this.searchConfidence === 'high') {
      return 'Best match';
    }
    if (this.searchConfidence === 'medium') {
      return 'Likely matches';
    }
    return 'Closest matches';
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

  get browseCategories(): typeof this.primaryCategories {
    return [...this.browsePrimaryCategories, ...this.browseSpecialistCategories];
  }

  navigateTo(path: string) {
    const normalized = path.startsWith('/') ? path : `/${path}`;
    this.router.navigateByUrl(normalized);
  }

  prefetchTool(path: string): void {
    this.prefetchRoute?.(path);
  }

  navigateToCategory(category: { path: string; subCategories?: Array<{ path: string }> }) {
    const first = category.subCategories?.[0];
    if (first?.path) {
      this.navigateTo(first.path);
      return;
    }
    this.router.navigateByUrl(`/${category.path}`);
  }

  exploreCategory(category: { name: string; path?: string }) {
    if (this.activeCategoryName === category.name) {
      this.clearCategoryFilter();
      return;
    }
    this.activeCategoryName = category.name;
    this.searchQuery = '';
    this.filterCategories();
    this.scrollToCatalog();
  }

  clearAllCatalogFilters(): void {
    this.clearSearch();
  }

  get specialistToolCount(): number {
    return this.specialistCategories.reduce(
      (total, category) => total + (category.subCategories?.length ?? 0),
      0
    );
  }

  applySuggestion(term?: string) {
    this.activeCategoryName = null;
    this.searchQuery = term?.trim() || this.currentSuggestion;
    this.searchSelectionTouched = false;
    this.filterCategories();
    this.homepageSearch?.nativeElement?.focus({ preventScroll: true });
  }

  onSearchInput() {
    if (this.searchQuery.trim()) {
      this.activeCategoryName = null;
      this.stopSuggestionAnimation();
    } else if (this.isBrowser) {
      this.startSuggestionAnimation();
    }
    this.searchSelectionTouched = false;
    if (this.searchDebounceTimer != null) {
      clearTimeout(this.searchDebounceTimer);
      this.searchDebounceTimer = null;
    }
    // SSR / unit tests: update immediately. Browser: light debounce for typing.
    if (!this.isBrowser) {
      this.filterCategories();
      return;
    }
    this.searchDebounceTimer = setTimeout(() => {
      this.searchDebounceTimer = null;
      this.filterCategories();
    }, 80);
  }

  onSearchKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.clearSearch();
      return;
    }

    const results = this.displayedSearchResults;
    const resultCount = results.length;
    if (!resultCount) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.searchSelectionTouched = true;
      this.activeResultIndex = (this.activeResultIndex + 1) % resultCount;
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.searchSelectionTouched = true;
      this.activeResultIndex = this.activeResultIndex <= 0 ? resultCount - 1 : this.activeResultIndex - 1;
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      this.activateHighlightedSearchResult();
    }
  }

  setActiveResultIndex(index: number): void {
    this.activeResultIndex = index;
  }

  applyClarification(optionQuery: string): void {
    this.searchQuery = optionQuery;
    this.activeResultIndex = -1;
    this.searchSelectionTouched = false;
    this.filterCategories();
    this.homepageSearch?.nativeElement?.focus({ preventScroll: true });
  }

  openSearchResult(result: ToolSearchResult | null | undefined): void {
    if (result?.path) {
      this.navigateTo(result.path);
    }
  }

  /** Enter / submit: open only on high confidence, or after arrow-key selection. */
  activateHighlightedSearchResult(): void {
    this.filterCategories();
    const results = this.displayedSearchResults;
    if (!results.length) {
      return;
    }
    const selected =
      this.activeResultIndex >= 0 && this.activeResultIndex < results.length
        ? results[this.activeResultIndex]
        : results[0];
    const mayOpen = this.searchConfidence === 'high' || this.searchSelectionTouched;

    if (mayOpen && selected?.path) {
      this.navigateTo(selected.path);
      return;
    }
    this.scrollToSearchResults();
  }

  scrollToCatalog() {
    if (typeof document === 'undefined') {
      return;
    }
    const catalog = document.getElementById('catalog-title');
    catalog?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  scrollToSearchResults(): void {
    if (typeof document === 'undefined') {
      return;
    }
    const results = document.getElementById('homepage-search-results');
    results?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  clearSearch() {
    this.searchQuery = '';
    this.activeCategoryName = null;
    this.activeResultIndex = -1;
    this.searchSelectionTouched = false;
    this.relatedSearchResults = [];
    this.searchClarification = null;
    this.searchRecoveryHint = null;
    this.searchConfidence = 'low';
    this.filterCategories();
    if (this.isBrowser) {
      this.startSuggestionAnimation();
      globalThis.setTimeout(() => this.focusHomeSearch(), 0);
    }
  }

  clearCategoryFilter() {
    this.activeCategoryName = null;
    this.filterCategories();
  }

  isSpecialistCategory(category: { path?: string }): boolean {
    return !!category.path && isSpecialistHomeCategory(category.path);
  }

  private focusHomeSearch(): void {
    try {
      if (typeof globalThis === 'undefined' || typeof globalThis.matchMedia !== 'function') {
        return;
      }
      const isDesktop = globalThis.matchMedia('(min-width: 768px)').matches;
      if (!isDesktop) {
        return;
      }
      const el = this.homepageSearch?.nativeElement;
      if (!el || typeof el.focus !== 'function' || this.searchQuery.trim()) {
        return;
      }
      el.focus({ preventScroll: true });
    } catch {
      /* ignore during prerender */
    }
  }

  private startSuggestionAnimation(): void {
    this.stopSuggestionAnimation();

    if (typeof globalThis === 'undefined') {
      return;
    }

    if (this.searchQuery.trim()) {
      return;
    }

    if (this.prefersReducedMotion) {
      this.animatedSuggestionText = this.currentSuggestion;
      if (typeof globalThis.setInterval !== 'function') {
        return;
      }
      this.suggestionInterval = globalThis.setInterval(() => {
        if (this.searchQuery.trim()) {
          return;
        }
        this.suggestionIndex = (this.suggestionIndex + 1) % this.searchSuggestions.length;
        this.animatedSuggestionText = this.currentSuggestion;
      }, 3500);
      return;
    }

    this.suggestionMode = 'type';
    this.suggestionCharIndex = 0;
    this.animatedSuggestionText = '';
    this.scheduleSuggestionStep();
  }

  private scheduleSuggestionStep(): void {
    this.clearSuggestionTimers();

    if (this.searchQuery.trim()) {
      return;
    }

    const term = this.currentSuggestion;

    if (this.suggestionMode === 'type') {
      if (this.suggestionCharIndex < term.length) {
        this.suggestionCharIndex += 1;
        this.animatedSuggestionText = term.slice(0, this.suggestionCharIndex);
        this.suggestionAnimTimer = globalThis.setTimeout(
          () => this.scheduleSuggestionStep(),
          this.suggestionTypeMs
        );
        return;
      }

      this.suggestionMode = 'hold';
      this.suggestionAnimTimer = globalThis.setTimeout(
        () => this.scheduleSuggestionStep(),
        this.suggestionHoldMs
      );
      return;
    }

    if (this.suggestionMode === 'hold') {
      this.suggestionMode = 'delete';
      this.scheduleSuggestionStep();
      return;
    }

    if (this.suggestionCharIndex > 0) {
      this.suggestionCharIndex -= 1;
      this.animatedSuggestionText = term.slice(0, this.suggestionCharIndex);
      this.suggestionAnimTimer = globalThis.setTimeout(
        () => this.scheduleSuggestionStep(),
        this.suggestionDeleteMs
      );
      return;
    }

    this.suggestionIndex = (this.suggestionIndex + 1) % this.searchSuggestions.length;
    this.suggestionMode = 'type';
    this.suggestionAnimTimer = globalThis.setTimeout(
      () => this.scheduleSuggestionStep(),
      this.suggestionGapMs
    );
  }

  private clearSuggestionTimers(): void {
    if (this.suggestionAnimTimer != null) {
      globalThis.clearTimeout(this.suggestionAnimTimer);
      this.suggestionAnimTimer = null;
    }
  }

  private stopSuggestionAnimation(): void {
    this.clearSuggestionTimers();
    if (this.suggestionInterval != null) {
      globalThis.clearInterval(this.suggestionInterval);
      this.suggestionInterval = null;
    }
    this.animatedSuggestionText = '';
    this.suggestionCharIndex = 0;
    this.suggestionMode = 'type';
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
    return this.visibleToolCount;
  }

  getSearchResults(): Array<{ name: string; path: string; category: string; description?: string }> {
    return this.searchResults;
  }

  getCatalogListTools(): Array<{ name: string; path: string; category: string; description?: string }> {
    return this.catalogListTools;
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
      'CAD & Engineering Viewers': 'CAD',
      'GIS & Mapping Viewers': 'GIS',
      'Medical & Healthcare Viewers': 'Medical',
      'Scientific Data Viewers': 'Science',
      'Network & Traffic Viewers': 'Network',
      'Process & Workflow Viewers': 'Process',
      'Diagram & Graph Viewers': 'Diagrams',
      'Data Explorers': 'Explore',
      'ML Model Viewers': 'ML',
    };
    return shortNames[name] ?? (name.length > 12 ? `${name.slice(0, 10)}…` : name);
  }

  filterCategories() {
    const query = this.searchQuery.toLowerCase().trim();
    if (!query && this.activeCategoryName) {
      this.filteredCategories = this.toolCategories.filter(
        category => category.name === this.activeCategoryName
      );
      this.searchResults = [];
      this.relatedSearchResults = [];
      this.searchClarification = null;
      this.searchRecoveryHint = null;
      this.searchConfidence = 'low';
      this.activeResultIndex = -1;
    } else if (!query) {
      this.filteredCategories = this.toolCategories;
      const { primary, specialist } = splitHomeCategories(this.filteredCategories);
      this.browsePrimaryCategories = primary;
      this.browseSpecialistCategories = specialist;
      this.searchResults = [];
      this.relatedSearchResults = [];
      this.searchClarification = null;
      this.searchRecoveryHint = null;
      this.searchConfidence = 'low';
      this.activeResultIndex = -1;
    } else {
      const response = this.searchEngine.search(this.searchQuery, {
        limit: SEARCH_LIMITS.maxResults,
      });
      this.searchResults = response.results;
      this.relatedSearchResults = response.related;
      this.searchConfidence = response.confidence;
      this.searchClarification = response.clarification;
      this.searchRecoveryHint = response.recoveryHint;
      if (!this.searchSelectionTouched) {
        this.activeResultIndex = response.results.length ? 0 : -1;
      } else if (this.activeResultIndex >= response.results.length) {
        this.activeResultIndex = response.results.length ? 0 : -1;
      }

      const matchedPaths = new Set(response.results.map((result) => result.path));
      this.filteredCategories = this.toolCategories
        .map((category) => {
          const matchingTools = (category.subCategories ?? []).filter((tool: { path: string }) =>
            matchedPaths.has(tool.path)
          );
          if (matchingTools.length === 0) {
            return null;
          }
          const order = new Map(response.results.map((result, index) => [result.path, index]));
          matchingTools.sort(
            (left: { path: string }, right: { path: string }) =>
              (order.get(left.path) ?? 999) - (order.get(right.path) ?? 999)
          );
          return {
            ...category,
            subCategories: matchingTools,
          };
        })
        .filter((cat: any) => cat !== null);
      this.browsePrimaryCategories = [];
      this.browseSpecialistCategories = [];
    }

    if (query || this.activeCategoryName) {
      this.browsePrimaryCategories = [];
      this.browseSpecialistCategories = [];
    }

    this.visibleToolCount = query
      ? this.searchResults.length
      : this.filteredCategories.reduce(
          (total, category) => total + (category.subCategories?.length ?? 0),
          0
        );
    this.catalogListTools = this.buildCatalogListTools();
  }

  onSearch(event: Event) {
    event.preventDefault();
    this.activateHighlightedSearchResult();
  }

  toggleTheme() {
    this.isDarkMode = !this.isDarkMode;
    const storage = this.getLocalStorage();
    storage?.setItem(this.themeStorageKey, this.isDarkMode ? 'dark' : 'light');
  }

  trackByCategory = (_: number, category: any) => category?.name;
  trackByTool = (_: number, tool: any) => tool?.path ?? tool?.name;
  trackByHighlight = (_: number, highlight: any) => highlight?.title;
  
  private buildCatalogListTools(): Array<{ name: string; path: string; category: string; description?: string }> {
    if (this.catalogMode === 'search') {
      return this.searchResults.map((result) => ({
        name: result.name,
        path: result.path,
        category: result.category,
        description: result.description,
      }));
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

  private computeTotalToolCount(): number {
    return this.toolCategories.reduce((total, category) => {
      const toolsCount = Array.isArray(category.subCategories) ? category.subCategories.length : 0;
      return total + toolsCount;
    }, 0);
  }

  private computePopularTools(limit = 8): Array<{ name: string; path: string; category: string; iconUrl: string }> {
    const all = this.toolCategories.flatMap((category) =>
      (category.subCategories ?? []).map((tool: { name: string; path: string; iconUrl?: string }) => ({
        name: tool.name,
        path: tool.path,
        category: category.name,
        iconUrl: tool.iconUrl ?? this.buildIconPath(tool.name),
      }))
    );
    return pickGlobalPopularTools(all, limit);
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
    const storedTheme =
      storage?.getItem(this.themeStorageKey) ?? storage?.getItem('easytoolhub.theme');
    if (storedTheme === 'dark' || storedTheme === 'light') {
      this.isDarkMode = storedTheme === 'dark';
      storage?.setItem(this.themeStorageKey, storedTheme);
      storage?.removeItem('easytoolhub.theme');
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