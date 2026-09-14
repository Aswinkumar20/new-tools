import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { PdfAccessibilityTaggerComponent } from './pdf-accessibility-tagger';

describe('PdfAccessibilityTaggerComponent', () => {
  let fixture: ComponentFixture<PdfAccessibilityTaggerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PdfAccessibilityTaggerComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(PdfAccessibilityTaggerComponent);
    fixture.detectChanges();
  });

  it('should create the tool workbench wrapper', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
