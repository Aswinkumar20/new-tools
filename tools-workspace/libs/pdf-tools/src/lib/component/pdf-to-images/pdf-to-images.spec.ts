import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { PdfToImagesComponent } from './pdf-to-images';

describe('PdfToImagesComponent', () => {
  let fixture: ComponentFixture<PdfToImagesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PdfToImagesComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(PdfToImagesComponent);
    fixture.detectChanges();
  });

  it('should create the tool workbench wrapper', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
