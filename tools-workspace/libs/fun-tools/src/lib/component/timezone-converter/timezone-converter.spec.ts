import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TimezoneConverterComponent } from './timezone-converter';

describe('TimezoneConverterComponent', () => {
  let component: TimezoneConverterComponent;
  let fixture: ComponentFixture<TimezoneConverterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TimezoneConverterComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(TimezoneConverterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
