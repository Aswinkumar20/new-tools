import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PercentageCalculatorComponent } from './percentage-calculator';

describe('PercentageCalculatorComponent', () => {
  let component: PercentageCalculatorComponent;
  let fixture: ComponentFixture<PercentageCalculatorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PercentageCalculatorComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(PercentageCalculatorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
