import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { CTDR_COIN_FLIP_MS, CTDR_DICE_ROLL_MS } from '../../constants/coin-toss-dice-roller.constants';
import { ftToolTestProviders } from '../../shared/ft-tool-test.utils';
import { CoinTossDiceRollerComponent } from './coin-toss-dice-roller';

describe('CoinTossDiceRollerComponent', () => {
  let component: CoinTossDiceRollerComponent;
  let fixture: ComponentFixture<CoinTossDiceRollerComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CoinTossDiceRollerComponent],
      providers: [...ftToolTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(CoinTossDiceRollerComponent);
    component = fixture.componentInstance;
    toast = TestBed.inject(ToastService) as unknown as {
      info: jest.Mock;
      error: jest.Mock;
      success: jest.Mock;
    };
    fixture.detectChanges();
  });

  it('should create with intro suggestion and related tools', () => {
    expect(component).toBeTruthy();
    expect(component.primarySuggestion()?.id).toBe('ctdr-rng-intro');
    expect(component.relatedTools.length).toBeGreaterThan(0);
  });

  it('tosses a coin after the flip delay', fakeAsync(() => {
    component.tossCoin();
    expect(component.isFlipping()).toBe(true);
    tick(CTDR_COIN_FLIP_MS);
    expect(component.isFlipping()).toBe(false);
    expect(component.hasCoinHistory()).toBe(true);
    expect(component.lastCoinResult()).toBeTruthy();
  }));

  it('rolls dice after the roll delay', fakeAsync(() => {
    component.setTab('dice');
    component.setNumberOfDice(2);
    component.rollDice();
    expect(component.isRolling()).toBe(true);
    tick(CTDR_DICE_ROLL_MS);
    expect(component.isRolling()).toBe(false);
    expect(component.diceResults().length).toBe(2);
    expect(component.lastDiceResults().length).toBe(2);
  }));

  it('ignores dice counts outside 1–10', () => {
    component.setNumberOfDice(0);
    expect(component.numberOfDice()).toBe(1);
    component.setNumberOfDice(11);
    expect(component.numberOfDice()).toBe(1);
    component.setNumberOfDice(4);
    expect(component.numberOfDice()).toBe(4);
  });

  it('dismisses contextual suggestions', () => {
    const suggestion = component.primarySuggestion();
    expect(suggestion).toBeTruthy();
    if (suggestion) {
      component.dismissSuggestion(suggestion.id);
      expect(component.primarySuggestion()).toBeNull();
    }
  });

  it('copies last result with toast feedback', fakeAsync(async () => {
    Object.assign(navigator, {
      clipboard: { writeText: jest.fn().mockResolvedValue(undefined) }
    });
    component.tossCoin();
    tick(CTDR_COIN_FLIP_MS);
    await component.copyLastResult();
    expect(toast.info).toHaveBeenCalledWith('Result copied to clipboard');
  }));
});
