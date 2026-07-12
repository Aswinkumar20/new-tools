import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ftToolTestProviders } from '../../shared/ft-tool-test.utils';
import { TypingSpeedTestComponent } from './typing-speed-test';

describe('TypingSpeedTestComponent', () => {
  let component: TypingSpeedTestComponent;
  let fixture: ComponentFixture<TypingSpeedTestComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TypingSpeedTestComponent],
      providers: ftToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(TypingSpeedTestComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
