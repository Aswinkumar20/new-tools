import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FileViewerAudioPlayerComponent } from './audio-player';

import { fileViewerTestProviders } from '../../shared/file-viewer-test.utils';

describe('FileViewerAudioPlayerComponent', () => {
  let component: FileViewerAudioPlayerComponent;
  let fixture: ComponentFixture<FileViewerAudioPlayerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FileViewerAudioPlayerComponent],
      providers: fileViewerTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(FileViewerAudioPlayerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
