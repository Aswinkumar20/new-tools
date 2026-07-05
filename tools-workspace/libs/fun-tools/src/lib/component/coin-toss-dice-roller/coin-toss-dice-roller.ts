import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Navigation, TooltipDirective, AssetService } from '@tools-workspace/features-home';

interface CoinResult {
  result: 'heads' | 'tails';
  timestamp: number;
}

interface DiceResult {
  sides: number;
  result: number;
  timestamp: number;
}

@Component({
  selector: 'lib-coin-toss-dice-roller',
  standalone: true,
  templateUrl: './coin-toss-dice-roller.html',
  styleUrls: ['./coin-toss-dice-roller.scss'],
  imports: [CommonModule, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CoinTossDiceRollerComponent {
  readonly assetService = inject(AssetService);

  readonly coinResults = signal<CoinResult[]>([]);
  readonly diceResults = signal<DiceResult[]>([]);
  readonly isFlipping = signal(false);
  readonly isRolling = signal(false);
  readonly selectedDiceSides = signal<number>(6);
  readonly numberOfDice = signal<number>(1);
  readonly activeTab = signal<'coin' | 'dice'>('coin');

  readonly lastCoinResult = computed(() => {
    const results = this.coinResults();
    return results.length > 0 ? results[0] : null;
  });

  readonly lastDiceResults = computed(() => {
    const results = this.diceResults();
    const count = this.numberOfDice();
    return results.length > 0 ? results.slice(0, count) : [];
  });

  readonly coinStats = computed(() => {
    const results = this.coinResults();
    const heads = results.filter((r) => r.result === 'heads').length;
    const tails = results.filter((r) => r.result === 'tails').length;
    const total = results.length;
    return {
      heads, tails, total,
      headsPercent: total > 0 ? Math.round((heads / total) * 100) : 0,
      tailsPercent: total > 0 ? Math.round((tails / total) * 100) : 0
    };
  });

  readonly diceStats = computed(() => {
    const results = this.diceResults();
    if (results.length === 0) return { total: 0, average: 0, min: 0, max: 0 };
    const values = results.map((r) => r.result);
    const sum = values.reduce((acc, val) => acc + val, 0);
    return {
      total: results.length,
      average: Math.round((sum / values.length) * 10) / 10,
      min: Math.min(...values),
      max: Math.max(...values)
    };
  });

  readonly hasCoinHistory = computed(() => this.coinResults().length > 0);
  readonly hasDiceHistory = computed(() => this.diceResults().length > 0);
  readonly lastResultText = computed(() => {
    if (this.activeTab() === 'coin' && this.lastCoinResult()) {
      const r = this.lastCoinResult()!;
      return r.result === 'heads' ? 'Heads' : 'Tails';
    }
    const dice = this.lastDiceResults();
    if (dice.length > 0) {
      return dice.map((d) => d.result).join(', ');
    }
    return '';
  });

  readonly diceOptions = [4, 6, 8, 10, 12, 20, 100];

  tossCoin(): void {
    if (this.isFlipping()) return;
    this.isFlipping.set(true);
    setTimeout(() => {
      const result: CoinResult = {
        result: Math.random() < 0.5 ? 'heads' : 'tails',
        timestamp: Date.now()
      };
      this.coinResults.update((current) => [result, ...current].slice(0, 50));
      this.isFlipping.set(false);
    }, 1000);
  }

  rollDice(): void {
    if (this.isRolling()) return;
    this.isRolling.set(true);
    const sides = this.selectedDiceSides();
    const count = this.numberOfDice();
    setTimeout(() => {
      const results: DiceResult[] = [];
      for (let i = 0; i < count; i++) {
        results.push({ sides, result: Math.floor(Math.random() * sides) + 1, timestamp: Date.now() });
      }
      this.diceResults.update((current) => [...results, ...current].slice(0, 50));
      this.isRolling.set(false);
    }, 800);
  }

  clearCoinHistory(): void { this.coinResults.set([]); }
  clearDiceHistory(): void { this.diceResults.set([]); }

  copyLastResult(): void {
    const text = this.lastResultText();
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      alert('Result copied to clipboard!');
    });
  }

  formatTimestamp(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString();
  }

  setDiceSides(sides: number): void { this.selectedDiceSides.set(sides); }

  setNumberOfDice(count: number): void {
    if (count >= 1 && count <= 10) this.numberOfDice.set(count);
  }

  setTab(tab: 'coin' | 'dice'): void { this.activeTab.set(tab); }
}
