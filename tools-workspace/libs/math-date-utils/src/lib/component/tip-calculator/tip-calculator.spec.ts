import { ComponentFixture, TestBed } from '@angular/core/testing';
import { mathToolTestProviders } from '../../shared/math-tool-test.utils';
import { TipCalculatorComponent } from './tip-calculator';

describe('TipCalculatorComponent', () => {
  let component: TipCalculatorComponent;
  let fixture: ComponentFixture<TipCalculatorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TipCalculatorComponent],
      providers: mathToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(TipCalculatorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
