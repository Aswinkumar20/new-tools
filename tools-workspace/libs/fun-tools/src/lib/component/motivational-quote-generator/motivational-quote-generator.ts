import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Navigation, TooltipDirective, AssetService, ToastService } from '@tools-workspace/features-home';
import { MQG_RELATED_TOOLS } from '../../constants/motivational-quote-generator.constants';
import { ftCopyText } from '../../shared/ft-clipboard.util';
import type { FtRelatedToolLink } from '../../shared/ft-tool-suggestion.model';
import type {
  MotivationalQuote,
  QuoteHistoryEntry
} from '../../types/motivational-quote-generator.types';
import {
  computeQuoteStats,
  formatQuoteCopyText,
  formatQuoteTimestamp,
  pickRandomQuote,
  prependQuoteHistory,
  resolveMotivationalQuoteSuggestion,
  toggleFavoriteId
} from '../../utils/motivational-quote-generator.utils';

@Component({
  selector: 'lib-motivational-quote-generator',
  standalone: true,
  templateUrl: './motivational-quote-generator.html',
  styleUrls: ['./motivational-quote-generator.scss'],
  imports: [CommonModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MotivationalQuoteGeneratorComponent {
  private readonly toast = inject(ToastService);
  readonly assetService = inject(AssetService);

  readonly currentQuote = signal<MotivationalQuote | null>(null);
  readonly quoteHistory = signal<QuoteHistoryEntry[]>([]);
  readonly favorites = signal<string[]>([]);
  private readonly dismissedSuggestionId = signal<string | null>(null);

  readonly relatedTools: ReadonlyArray<FtRelatedToolLink> = MQG_RELATED_TOOLS;

  readonly hasCurrentQuote = computed(() => this.currentQuote() !== null);
  readonly hasHistory = computed(() => this.quoteHistory().length > 0);
  readonly isFavorite = computed(() => {
    const quote = this.currentQuote();
    return quote ? this.favorites().includes(quote.id) : false;
  });

  readonly quoteText = computed(() => formatQuoteCopyText(this.currentQuote()));

  readonly stats = computed(() => computeQuoteStats(this.quoteHistory(), this.favorites()));

  readonly primarySuggestion = computed(() => {
    const suggestion = resolveMotivationalQuoteSuggestion({
      hasQuote: this.hasCurrentQuote(),
      historyCount: this.quoteHistory().length,
      favoriteCount: this.favorites().length,
      isCurrentFavorite: this.isFavorite()
    });
    if (!suggestion || this.dismissedSuggestionId() === suggestion.id) {
      return null;
    }
    return suggestion;
  });

  constructor() {
    this.generateQuote();
  }

  generateQuote(): void {
    const quote = pickRandomQuote();
    this.currentQuote.set(quote);
    this.quoteHistory.update((history) => prependQuoteHistory(history, quote));
  }

  toggleFavorite(): void {
    const quote = this.currentQuote();
    if (!quote) {
      return;
    }
    this.favorites.update((favs) => toggleFavoriteId(favs, quote.id));
  }

  async copyQuote(): Promise<void> {
    await ftCopyText(this.toast, this.quoteText(), 'Quote');
  }

  clearHistory(): void {
    this.quoteHistory.set([]);
  }

  formatTimestamp(timestamp: number): string {
    return formatQuoteTimestamp(timestamp);
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId.set(suggestionId);
  }
}
