import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  computed,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Navigation, TooltipDirective, AssetService, ToastService } from '@tools-workspace/features-home';
import {
  CTDR_COIN_FLIP_MS,
  CTDR_DEFAULT_DICE_COUNT,
  CTDR_DEFAULT_DICE_SIDES,
  CTDR_DICE_OPTIONS,
  CTDR_DICE_ROLL_MS,
  CTDR_HISTORY_PREVIEW_LIMIT,
  CTDR_RELATED_TOOLS
} from '../../constants/coin-toss-dice-roller.constants';
import { ftCopyText } from '../../shared/ft-clipboard.util';
import type { FtRelatedToolLink } from '../../shared/ft-tool-suggestion.model';
import type {
  CoinDiceTab,
  CoinResult,
  DiceResult
} from '../../types/coin-toss-dice-roller.types';
import {
  clampDiceCount,
  computeCoinStats,
  computeDiceStats,
  createCoinResult,
  createDiceResults,
  formatLastResultText,
  formatResultTimestamp,
  prependHistory,
  resolveCoinTossDiceSuggestion
} from '../../utils/coin-toss-dice-roller.utils';

@Component({
  selector: 'lib-coin-toss-dice-roller',
  standalone: true,
  templateUrl: './coin-toss-dice-roller.html',
  styleUrls: ['./coin-toss-dice-roller.scss'],
  imports: [CommonModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CoinTossDiceRollerComponent implements OnDestroy {
  private readonly toast = inject(ToastService);
  readonly assetService = inject(AssetService);

  readonly coinResults = signal<CoinResult[]>([]);
  readonly diceResults = signal<DiceResult[]>([]);
  readonly isFlipping = signal(false);
  readonly isRolling = signal(false);
  readonly selectedDiceSides = signal<number>(CTDR_DEFAULT_DICE_SIDES);
  readonly numberOfDice = signal<number>(CTDR_DEFAULT_DICE_COUNT);
  readonly activeTab = signal<CoinDiceTab>('coin');
  private readonly dismissedSuggestionId = signal<string | null>(null);

  private flipTimerId: ReturnType<typeof setTimeout> | null = null;
  private rollTimerId: ReturnType<typeof setTimeout> | null = null;

  readonly diceOptions = CTDR_DICE_OPTIONS;
  readonly historyPreviewLimit = CTDR_HISTORY_PREVIEW_LIMIT;
  readonly relatedTools: ReadonlyArray<FtRelatedToolLink> = CTDR_RELATED_TOOLS;

  readonly lastCoinResult = computed(() => {
    const results = this.coinResults();
    return results.length > 0 ? results[0] : null;
  });

  readonly lastDiceResults = computed(() => {
    const results = this.diceResults();
    const count = this.numberOfDice();
    return results.length > 0 ? results.slice(0, count) : [];
  });

  readonly coinStats = computed(() => computeCoinStats(this.coinResults()));
  readonly diceStats = computed(() => computeDiceStats(this.diceResults()));

  readonly hasCoinHistory = computed(() => this.coinResults().length > 0);
  readonly hasDiceHistory = computed(() => this.diceResults().length > 0);

  readonly lastResultText = computed(() =>
    formatLastResultText(this.activeTab(), this.lastCoinResult(), this.lastDiceResults())
  );

  readonly primarySuggestion = computed(() => {
    const suggestion = resolveCoinTossDiceSuggestion({
      tab: this.activeTab(),
      coinTotal: this.coinStats().total,
      diceTotal: this.diceStats().total,
      numberOfDice: this.numberOfDice(),
      diceSides: this.selectedDiceSides()
    });
    if (!suggestion || this.dismissedSuggestionId() === suggestion.id) {
      return null;
    }
    return suggestion;
  });

  tossCoin(): void {
    if (this.isFlipping()) {
      return;
    }
    this.isFlipping.set(true);
    this.clearFlipTimer();
    this.flipTimerId = setTimeout(() => {
      const result = createCoinResult();
      this.coinResults.update((current) => prependHistory(current, [result]));
      this.isFlipping.set(false);
      this.flipTimerId = null;
    }, CTDR_COIN_FLIP_MS);
  }

  rollDice(): void {
    if (this.isRolling()) {
      return;
    }
    this.isRolling.set(true);
    const sides = this.selectedDiceSides();
    const count = this.numberOfDice();
    this.clearRollTimer();
    this.rollTimerId = setTimeout(() => {
      const results = createDiceResults(sides, count);
      this.diceResults.update((current) => prependHistory(current, results));
      this.isRolling.set(false);
      this.rollTimerId = null;
    }, CTDR_DICE_ROLL_MS);
  }

  clearCoinHistory(): void {
    this.coinResults.set([]);
  }

  clearDiceHistory(): void {
    this.diceResults.set([]);
  }

  async copyLastResult(): Promise<void> {
    await ftCopyText(this.toast, this.lastResultText(), 'Result');
  }

  formatTimestamp(timestamp: number): string {
    return formatResultTimestamp(timestamp);
  }

  setDiceSides(sides: number): void {
    this.selectedDiceSides.set(sides);
  }

  setNumberOfDice(count: number): void {
    const clamped = clampDiceCount(count);
    if (clamped !== null) {
      this.numberOfDice.set(clamped);
    }
  }

  setTab(tab: CoinDiceTab): void {
    this.activeTab.set(tab);
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId.set(suggestionId);
  }

  ngOnDestroy(): void {
    this.clearFlipTimer();
    this.clearRollTimer();
  }

  private clearFlipTimer(): void {
    if (this.flipTimerId !== null) {
      clearTimeout(this.flipTimerId);
      this.flipTimerId = null;
    }
  }

  private clearRollTimer(): void {
    if (this.rollTimerId !== null) {
      clearTimeout(this.rollTimerId);
      this.rollTimerId = null;
    }
  }
}
