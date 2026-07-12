import { ComponentFixture, TestBed } from '@angular/core/testing';
import { mtToolTestProviders } from '../../shared/mt-tool-test.utils';
import { VideoToGifComponent } from './video-to-gif';

describe('VideoToGifComponent', () => {
  let component: VideoToGifComponent;
  let fixture: ComponentFixture<VideoToGifComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VideoToGifComponent],
      providers: mtToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(VideoToGifComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
