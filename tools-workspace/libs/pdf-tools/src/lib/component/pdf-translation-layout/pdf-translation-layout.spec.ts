import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { PdfTranslationLayoutComponent } from './pdf-translation-layout';

describe('PdfTranslationLayoutComponent', () => {
  let fixture: ComponentFixture<PdfTranslationLayoutComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PdfTranslationLayoutComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(PdfTranslationLayoutComponent);
    fixture.detectChanges();
  });

  it('should create the tool workbench wrapper', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
