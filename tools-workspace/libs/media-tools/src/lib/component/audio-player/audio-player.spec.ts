import { ComponentFixture, TestBed } from '@angular/core/testing';
import { mtToolTestProviders } from '../../shared/mt-tool-test.utils';
import { AudioPlayerComponent } from './audio-player';

describe('AudioPlayerComponent', () => {
  let component: AudioPlayerComponent;
  let fixture: ComponentFixture<AudioPlayerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AudioPlayerComponent],
      providers: mtToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(AudioPlayerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
