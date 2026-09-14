import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { PdfWorkflowAutomationComponent } from './pdf-workflow-automation';

describe('PdfWorkflowAutomationComponent', () => {
  let fixture: ComponentFixture<PdfWorkflowAutomationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PdfWorkflowAutomationComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(PdfWorkflowAutomationComponent);
    fixture.detectChanges();
  });

  it('should create the tool workbench wrapper', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
