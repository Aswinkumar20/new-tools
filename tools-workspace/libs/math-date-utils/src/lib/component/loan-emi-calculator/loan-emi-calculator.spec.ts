import { ComponentFixture, TestBed } from '@angular/core/testing';
import { mathToolTestProviders } from '../../shared/math-tool-test.utils';
import { LoanEmiCalculatorComponent } from './loan-emi-calculator';

describe('LoanEmiCalculatorComponent', () => {
  let component: LoanEmiCalculatorComponent;
  let fixture: ComponentFixture<LoanEmiCalculatorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoanEmiCalculatorComponent],
      providers: mathToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(LoanEmiCalculatorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
