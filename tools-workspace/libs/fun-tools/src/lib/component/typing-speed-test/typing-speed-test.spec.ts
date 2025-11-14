import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TypingSpeedTestComponent } from './typing-speed-test';

describe('TypingSpeedTestComponent', () => {
  let component: TypingSpeedTestComponent;
  let fixture: ComponentFixture<TypingSpeedTestComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TypingSpeedTestComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(TypingSpeedTestComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
