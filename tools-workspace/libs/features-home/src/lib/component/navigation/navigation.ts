import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  HostListener,
  Input,
  OnInit,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, NavigationEnd } from '@angular/router';
import { LanguageService, Language } from '../../services/language.service';
import { TranslationService } from '../../services/translation.service';
import { AssetService } from '../../services/asset.service';
import { TOOL_CATEGORIES } from '../../config/tools-catalog.generated';
import { toNavigationCategories } from '../../config/tools-catalog.helpers';
import { Subscription, filter } from 'rxjs';

@Component({
  selector: 'lib-navigation',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './navigation.html',
  styleUrls: ['./navigation.scss'],
})
export class NavigationComponent implements OnInit, OnDestroy {
  /** When false, no in-flow spacer (use for full-bleed home hero under fixed nav). */
  @Input() reserveSpace = true;

  title = 'My Component';
  categoriesList = toNavigationCategories(TOOL_CATEGORIES);
  iconUrl = '';

  isDropdownOpen = false;
  hoveredCategory: any = null;
  megaMenuStyle: Record<string, string> = {};
  private dropdownCloseTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly megaMenuWidth = 560;
  activeLink: string = 'home';
  isMobileMenuOpen = false;
  expandedMobileCategory: string | null = null;
  private isDesktop = false;
  isDarkMode = false;
  @ViewChild('categoriesTrigger') categoriesTrigger?: ElementRef<HTMLButtonElement>;

  // Language dropdown properties
  isLanguageDropdownOpen = false;
  supportedLanguages: Language[] = [];
  filteredLanguages: Language[] | null = null;
  currentLanguage: Language | undefined;
  private languageSubscription?: Subscription;

  // Search properties
  searchQuery: string = '';
  searchResults: any[] = [];
  isSearchDropdownOpen = false;
  isHomePage = false;
  private routerSubscription?: Subscription;

  constructor(
    private readonly router: Router,
    private languageService: LanguageService,
    private translationService: TranslationService,
    private readonly assetService: AssetService
  ) { }

  ngOnInit(): void {
    this.iconUrl = this.assetService.getAssetPath('logo-icon.svg');
    this.evaluateViewport();
    this.loadThemePreference();
    this.setupThemeListener();
    this.initializeLanguage();
    // Check route immediately and set up listener
    this.checkCurrentRoute();
    this.setupRouteListener();
    // Also check route after a small delay to catch any async route changes
    setTimeout(() => this.checkCurrentRoute(), 100);
  }

  ngOnDestroy(): void {
    this.clearDropdownCloseTimer();
    if (this.languageSubscription) {
      this.languageSubscription.unsubscribe();
    }
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }
  }

  initializeLanguage(): void {
    this.supportedLanguages = this.languageService.getSupportedLanguages();
    const currentLangCode = this.languageService.getCurrentLanguage();
    this.currentLanguage = this.languageService.getLanguageByCode(currentLangCode);

    // Subscribe to language changes
    this.languageSubscription = this.languageService.currentLanguage$.subscribe(langCode => {
      this.currentLanguage = this.languageService.getLanguageByCode(langCode);
    });
  }

  toggleLanguageDropdown(): void {
    this.isLanguageDropdownOpen = !this.isLanguageDropdownOpen;
  }

  closeLanguageDropdown(): void {
    this.isLanguageDropdownOpen = false;
  }

  selectLanguage(language: Language): void {
    this.languageService.setLanguage(language.code);
    this.closeLanguageDropdown();
    // Trigger change detection for all components using translations
    window.dispatchEvent(new Event('languagechange'));
  }

  filterLanguages(event: Event): void {
    const input = event.target as HTMLInputElement;
    const searchTerm = input.value.toLowerCase().trim();
    
    if (!searchTerm) {
      this.filteredLanguages = null;
      return;
    }

    this.filteredLanguages = this.supportedLanguages.filter(lang =>
      lang.name.toLowerCase().includes(searchTerm) ||
      lang.nativeName.toLowerCase().includes(searchTerm) ||
      lang.code.toLowerCase().includes(searchTerm)
    );
  }

  setupThemeListener(): void {
    // Theme listener removed - no automatic dark mode switching
    // Users can manually toggle theme if needed
  }

  loadThemePreference(): void {
    // Check localStorage first, default to light mode
    const savedTheme = this.getLocalStorage()?.getItem('theme');
    if (savedTheme) {
      this.isDarkMode = savedTheme === 'dark';
    } else {
      // Default to light mode (no dark mode by default)
      this.isDarkMode = false;
    }
    this.applyTheme();
  }

  toggleTheme(): void {
    this.isDarkMode = !this.isDarkMode;
    this.applyTheme();
    // Save preference to localStorage
    this.getLocalStorage()?.setItem('theme', this.isDarkMode ? 'dark' : 'light');
  }

  applyTheme(): void {
    if (typeof document === 'undefined') {
      return;
    }
    const root = document.documentElement;
    if (this.isDarkMode) {
      root.setAttribute('data-theme', 'dark');
    } else {
      root.setAttribute('data-theme', 'light');
    }
  }

  private getLocalStorage(): Storage | null {
    if (typeof globalThis === 'undefined') {
      return null;
    }
    const globalObject = globalThis as typeof globalThis & { localStorage?: Storage };
    return globalObject.localStorage ?? null;
  }

  @HostListener('window:resize')
  onResize(): void {
    this.evaluateViewport();
    if (this.isDropdownOpen) {
      this.positionMegaMenu();
    }
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    if (this.isDropdownOpen) {
      this.positionMegaMenu();
    }
  }
  
  navigateTo(path: string, activeKey: string = path) {
    this.activeLink = activeKey === '../text-utilities' ? 'categories' : activeKey;
    if (activeKey === 'categories' && this.isDesktop) {
      this.isDropdownOpen = false;
    }
    if (!this.isDesktop) {
      this.closeMobileMenu();
    }
    if (path === 'home') {
      this.router.navigateByUrl('/tools/home');
      return;
    }
    const normalized = path.startsWith('/') ? path : `/${path}`;
    this.router.navigateByUrl(normalized);
  }

  onDropdownEnter(_event?: Event): void {
    if (!this.isDesktop) {
      return;
    }
    this.clearDropdownCloseTimer();
    this.isDropdownOpen = true;
    if (!this.hoveredCategory) {
      this.hoveredCategory = this.categoriesList?.[0] ?? null;
    }
    // Position after open class applies so layout is correct
    requestAnimationFrame(() => this.positionMegaMenu());
  }

  onDropdownLeave(event?: MouseEvent): void {
    if (!this.isDesktop) {
      return;
    }

    // Stay open when moving between the trigger and the panel (or their children)
    const next = event?.relatedTarget as Node | null;
    const current = event?.currentTarget as HTMLElement | null;
    if (next && current?.contains(next)) {
      return;
    }

    this.clearDropdownCloseTimer();
    this.dropdownCloseTimer = setTimeout(() => {
      this.isDropdownOpen = false;
      this.dropdownCloseTimer = null;
    }, 280);
  }

  toggleCategoriesDropdown(): void {
    if (!this.isDesktop) {
      return;
    }
    this.clearDropdownCloseTimer();
    this.isDropdownOpen = !this.isDropdownOpen;
    if (this.isDropdownOpen) {
      this.hoveredCategory = this.categoriesList?.[0] ?? null;
      requestAnimationFrame(() => this.positionMegaMenu());
    }
  }

  /** Align the mega card to the Categories button and keep it in the viewport. */
  positionMegaMenu(): void {
    const trigger = this.categoriesTrigger?.nativeElement;
    if (!trigger || typeof window === 'undefined') {
      return;
    }

    const rect = trigger.getBoundingClientRect();
    const width = Math.min(this.megaMenuWidth, window.innerWidth - 24);
    const maxLeft = window.innerWidth - width - 12;
    // Prefer left-align to the trigger; shift left if it would overflow the viewport
    const left = Math.max(12, Math.min(rect.left, maxLeft));
    // Sit fully below the Categories button (bridge handles hover transfer)
    const top = Math.max(8, rect.bottom + 8);

    this.megaMenuStyle = {
      top: `${top}px`,
      left: `${left}px`,
      width: `${width}px`,
    };
  }

  private clearDropdownCloseTimer(): void {
    if (this.dropdownCloseTimer != null) {
      clearTimeout(this.dropdownCloseTimer);
      this.dropdownCloseTimer = null;
    }
  }

  hoverMegaCategory(category: any): void {
    if (!category || this.hoveredCategory?.name === category.name) {
      return;
    }
    this.hoveredCategory = category;
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
    return shortNames[name] ?? (name.length > 14 ? `${name.slice(0, 12)}…` : name);
  }

  shortToolName(name: string): string {
    const parenIndex = name.indexOf('(');
    const trimmed = parenIndex > 0 ? name.slice(0, parenIndex).trim() : name;
    return trimmed.length > 40 ? `${trimmed.slice(0, 37)}…` : trimmed;
  }

  toggleMobileMenu(): void {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
    if (!this.isMobileMenuOpen) {
      this.expandedMobileCategory = null;
    }
  }

  closeMobileMenu(): void {
    this.isMobileMenuOpen = false;
    this.expandedMobileCategory = null;
  }

  toggleMobileCategory(categoryName: string): void {
    this.expandedMobileCategory =
      this.expandedMobileCategory === categoryName ? null : categoryName;
  }

  private evaluateViewport(): void {
    const globalObject = globalThis as typeof globalThis & {
      matchMedia?: (query: string) => MediaQueryList;
    };
    this.isDesktop = globalObject.matchMedia?.('(min-width: 1024px)')?.matches ?? false;
    if (this.isDesktop) {
      this.isMobileMenuOpen = false;
      this.expandedMobileCategory = null;
    } else {
      this.isDropdownOpen = false;
    }
  }

  checkCurrentRoute(): void {
    const currentUrl = this.router.url;
    // Normalize the URL by removing query params and fragments
    const normalizedUrl = currentUrl.split('?')[0].split('#')[0];
    
    // Check if we're on home page
    // Routes: /tools/home, /, empty, or /tools (which redirects to home)
    this.isHomePage =
      normalizedUrl === '/tools/home' ||
      normalizedUrl === '/' ||
      normalizedUrl === '' ||
      normalizedUrl === '/tools';
  }

  setupRouteListener(): void {
    this.routerSubscription = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        this.checkCurrentRoute();
        this.searchQuery = '';
        this.searchResults = [];
        this.isSearchDropdownOpen = false;
      });
  }

  onSearchInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchQuery = input.value.trim();
    
    if (!this.searchQuery) {
      this.searchResults = [];
      this.isSearchDropdownOpen = false;
      return;
    }

    this.filterSearchResults();
    this.isSearchDropdownOpen = this.searchResults.length > 0;
  }

  filterSearchResults(): void {
    const query = this.searchQuery.toLowerCase().trim();
    this.searchResults = [];

    this.categoriesList.forEach((category: any) => {
      // Search in category name
      if (category.name.toLowerCase().includes(query)) {
        this.searchResults.push({
          name: category.name,
          description: category.description,
          path: category.path,
          type: 'category'
        });
      }

      // Search in tools
      if (category.subCategories && category.subCategories.length > 0) {
        category.subCategories.forEach((tool: any) => {
          if (
            tool.name.toLowerCase().includes(query) ||
            tool.description?.toLowerCase().includes(query)
          ) {
            this.searchResults.push({
              name: tool.name,
              description: tool.description,
              path: tool.path,
              category: category.name,
              type: 'tool'
            });
          }
        });
      }
    });

    // Limit results to 10 for better performance
    this.searchResults = this.searchResults.slice(0, 10);
  }

  onSearchResultClick(result: any): void {
    this.navigateTo(result.path, 'search');
    this.searchQuery = '';
    this.searchResults = [];
    this.isSearchDropdownOpen = false;
  }

  closeSearchDropdown(): void {
    this.isSearchDropdownOpen = false;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.nav__search-wrapper')) {
      this.isSearchDropdownOpen = false;
    }
  }
}

export { NavigationComponent as Navigation };
