import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { PdfToMarkdownComponent } from './pdf-to-markdown';

describe('PdfToMarkdownComponent', () => {
  let fixture: ComponentFixture<PdfToMarkdownComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PdfToMarkdownComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(PdfToMarkdownComponent);
    fixture.detectChanges();
  });

  it('should create the tool workbench wrapper', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
