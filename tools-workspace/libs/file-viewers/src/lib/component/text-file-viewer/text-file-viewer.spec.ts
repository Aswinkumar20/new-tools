import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TextFileViewerComponent } from './text-file-viewer';

import { fileViewerTestProviders } from '../../shared/file-viewer-test.utils';

describe('TextFileViewerComponent', () => {
  let component: TextFileViewerComponent;
  let fixture: ComponentFixture<TextFileViewerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TextFileViewerComponent],
      providers: fileViewerTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(TextFileViewerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
