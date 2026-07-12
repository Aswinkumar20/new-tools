import { ComponentFixture, TestBed } from '@angular/core/testing';
import { mathToolTestProviders } from '../../shared/math-tool-test.utils';
import { FractionCalculatorComponent } from './fraction-calculator';

describe('FractionCalculatorComponent', () => {
  let component: FractionCalculatorComponent;
  let fixture: ComponentFixture<FractionCalculatorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FractionCalculatorComponent],
      providers: mathToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(FractionCalculatorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
