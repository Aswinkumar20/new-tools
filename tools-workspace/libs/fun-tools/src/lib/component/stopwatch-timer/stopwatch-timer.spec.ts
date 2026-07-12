import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ftToolTestProviders } from '../../shared/ft-tool-test.utils';
import { StopwatchTimerComponent } from './stopwatch-timer';

describe('StopwatchTimerComponent', () => {
  let component: StopwatchTimerComponent;
  let fixture: ComponentFixture<StopwatchTimerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StopwatchTimerComponent],
      providers: ftToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(StopwatchTimerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
