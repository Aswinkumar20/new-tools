import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FontViewerComponent } from './font-viewer';

import { fileViewerTestProviders } from '../../shared/file-viewer-test.utils';

describe('FontViewerComponent', () => {
  let component: FontViewerComponent;
  let fixture: ComponentFixture<FontViewerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FontViewerComponent],
      providers: fileViewerTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(FontViewerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
