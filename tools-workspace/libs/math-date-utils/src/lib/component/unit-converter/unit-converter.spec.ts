import { ComponentFixture, TestBed } from '@angular/core/testing';
import { mathToolTestProviders } from '../../shared/math-tool-test.utils';
import { UnitConverterComponent } from './unit-converter';

describe('UnitConverterComponent', () => {
  let component: UnitConverterComponent;
  let fixture: ComponentFixture<UnitConverterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UnitConverterComponent],
      providers: mathToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(UnitConverterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
