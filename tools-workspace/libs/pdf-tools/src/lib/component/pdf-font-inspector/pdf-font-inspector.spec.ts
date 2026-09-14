import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { PdfFontInspectorComponent } from './pdf-font-inspector';

describe('PdfFontInspectorComponent', () => {
  let fixture: ComponentFixture<PdfFontInspectorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PdfFontInspectorComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(PdfFontInspectorComponent);
    fixture.detectChanges();
  });

  it('should create the tool workbench wrapper', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
