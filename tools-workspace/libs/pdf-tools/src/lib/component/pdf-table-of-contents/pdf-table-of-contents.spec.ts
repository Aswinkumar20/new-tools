import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { PdfTableOfContentsComponent } from './pdf-table-of-contents';

describe('PdfTableOfContentsComponent', () => {
  let fixture: ComponentFixture<PdfTableOfContentsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PdfTableOfContentsComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(PdfTableOfContentsComponent);
    fixture.detectChanges();
  });

  it('should create the tool workbench wrapper', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
