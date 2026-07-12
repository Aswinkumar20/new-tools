import { ComponentFixture, TestBed } from '@angular/core/testing';
import { mtToolTestProviders } from '../../shared/mt-tool-test.utils';
import { VoiceRecorderComponent } from './voice-recorder';

describe('VoiceRecorderComponent', () => {
  let component: VoiceRecorderComponent;
  let fixture: ComponentFixture<VoiceRecorderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VoiceRecorderComponent],
      providers: mtToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(VoiceRecorderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
