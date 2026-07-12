import { ComponentFixture, TestBed } from '@angular/core/testing';
import { mathToolTestProviders } from '../../shared/math-tool-test.utils';
import { CurrencyConverterComponent } from './currency-converter';

describe('CurrencyConverterComponent', () => {
  let component: CurrencyConverterComponent;
  let fixture: ComponentFixture<CurrencyConverterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CurrencyConverterComponent],
      providers: mathToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(CurrencyConverterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
