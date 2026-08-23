import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FractionCalculatorComponent } from './fraction-calculator';

describe('FractionCalculatorComponent', () => {
  let component: FractionCalculatorComponent;
  let fixture: ComponentFixture<FractionCalculatorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FractionCalculatorComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(FractionCalculatorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
