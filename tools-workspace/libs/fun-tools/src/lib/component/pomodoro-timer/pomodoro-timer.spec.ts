import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ftToolTestProviders } from '../../shared/ft-tool-test.utils';
import { PomodoroTimerComponent } from './pomodoro-timer';

describe('PomodoroTimerComponent', () => {
  let component: PomodoroTimerComponent;
  let fixture: ComponentFixture<PomodoroTimerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PomodoroTimerComponent],
      providers: ftToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(PomodoroTimerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
