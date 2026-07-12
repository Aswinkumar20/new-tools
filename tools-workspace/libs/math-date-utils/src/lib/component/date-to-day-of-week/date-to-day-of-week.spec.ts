import { ComponentFixture, TestBed } from '@angular/core/testing';
import { mathToolTestProviders } from '../../shared/math-tool-test.utils';
import { DateToDayOfWeekComponent } from './date-to-day-of-week';

describe('DateToDayOfWeekComponent', () => {
  let component: DateToDayOfWeekComponent;
  let fixture: ComponentFixture<DateToDayOfWeekComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DateToDayOfWeekComponent],
      providers: mathToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(DateToDayOfWeekComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
