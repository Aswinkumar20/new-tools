import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { PdfPageCropperComponent } from './pdf-page-cropper';

describe('PdfPageCropperComponent', () => {
  let fixture: ComponentFixture<PdfPageCropperComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PdfPageCropperComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(PdfPageCropperComponent);
    fixture.detectChanges();
  });

  it('should create the tool workbench wrapper', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
