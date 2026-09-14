import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { mtToolTestProviders } from '../../shared/mt-tool-test.utils';
import { AudioPlayerComponent } from './audio-player';

describe('AudioPlayerComponent', () => {
  let component: AudioPlayerComponent;
  let fixture: ComponentFixture<AudioPlayerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AudioPlayerComponent],
      providers: [...mtToolTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(AudioPlayerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create with voice recorder suggestion when empty', () => {
    expect(component).toBeTruthy();
    expect(component.audioFiles.length).toBe(0);
    expect(component.primarySuggestion?.id).toBe('ap-voice');
  });
});
