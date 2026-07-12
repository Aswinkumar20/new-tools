import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LogViewerComponent } from './log-viewer';

import { fileViewerTestProviders } from '../../shared/file-viewer-test.utils';

describe('LogViewerComponent', () => {
  let component: LogViewerComponent;
  let fixture: ComponentFixture<LogViewerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LogViewerComponent],
      providers: fileViewerTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(LogViewerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
