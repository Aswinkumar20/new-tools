import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StopwatchTimerComponent } from './stopwatch-timer';

describe('StopwatchTimerComponent', () => {
  let component: StopwatchTimerComponent;
  let fixture: ComponentFixture<StopwatchTimerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StopwatchTimerComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(StopwatchTimerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
