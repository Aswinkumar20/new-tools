import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { PdfAccessibilityCheckerComponent } from './pdf-accessibility-checker';

describe('PdfAccessibilityCheckerComponent', () => {
  let fixture: ComponentFixture<PdfAccessibilityCheckerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PdfAccessibilityCheckerComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(PdfAccessibilityCheckerComponent);
    fixture.detectChanges();
  });

  it('should create the tool workbench wrapper', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
