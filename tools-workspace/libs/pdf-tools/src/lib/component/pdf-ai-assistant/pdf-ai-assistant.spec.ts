import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { PdfAiAssistantComponent } from './pdf-ai-assistant';

describe('PdfAiAssistantComponent', () => {
  let fixture: ComponentFixture<PdfAiAssistantComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PdfAiAssistantComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(PdfAiAssistantComponent);
    fixture.detectChanges();
  });

  it('should create the tool workbench wrapper', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
