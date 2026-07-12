import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ftToolTestProviders } from '../../shared/ft-tool-test.utils';
import { CoinTossDiceRollerComponent } from './coin-toss-dice-roller';

describe('CoinTossDiceRollerComponent', () => {
  let component: CoinTossDiceRollerComponent;
  let fixture: ComponentFixture<CoinTossDiceRollerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CoinTossDiceRollerComponent],
      providers: ftToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(CoinTossDiceRollerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
