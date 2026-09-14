import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { PdfFullscreenOverlayComponent } from './pdf-fullscreen-overlay';

describe('PdfFullscreenOverlayComponent', () => {
  let fixture: ComponentFixture<PdfFullscreenOverlayComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PdfFullscreenOverlayComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(PdfFullscreenOverlayComponent);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
