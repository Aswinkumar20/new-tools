import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { PdfPageReplacerComponent } from './pdf-page-replacer';

describe('PdfPageReplacerComponent', () => {
  let fixture: ComponentFixture<PdfPageReplacerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PdfPageReplacerComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(PdfPageReplacerComponent);
    fixture.detectChanges();
  });

  it('should create the tool workbench wrapper', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
