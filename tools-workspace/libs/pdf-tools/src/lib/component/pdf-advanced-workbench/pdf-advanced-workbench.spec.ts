import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { getPdfAdvancedTool } from '../../advanced/pdf-advanced-tools.registry';
import { PdfAdvancedWorkbenchComponent } from './pdf-advanced-workbench';

describe('PdfAdvancedWorkbenchComponent', () => {
  let fixture: ComponentFixture<PdfAdvancedWorkbenchComponent>;
  let component: PdfAdvancedWorkbenchComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PdfAdvancedWorkbenchComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(PdfAdvancedWorkbenchComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('toolId', 'pdf-form-validate');
    fixture.detectChanges();
  });

  it('should create and resolve the tool definition', () => {
    expect(component).toBeTruthy();
    expect(component.tool?.id).toBe('pdf-form-validate');
    expect(component.tool?.endpoint).toBe('/validate-form');
  });

  it('disables primary action until a file is selected for pdf input tools', () => {
    expect(component.files.length).toBe(0);
    expect(component.canRunPrimaryAction).toBe(false);
  });

  it('clears results without throwing', () => {
    component.resultText = 'x';
    component.resultJson = { ok: true };
    component.resultBlob = new Blob(['x']);
    component.clearAll();
    expect(component.resultText).toBe('');
    expect(component.resultJson).toBeNull();
    expect(component.resultBlob).toBeNull();
    expect(component.files).toEqual([]);
  });

  it('resolves pdf-to-txt and pdf-to-images from the registry', () => {
    const text = getPdfAdvancedTool('pdf-to-txt');
    expect(text?.endpoint).toBe('/pdf-to-text');
    expect(text?.output).toBe('text');

    const images = getPdfAdvancedTool('pdf-to-images');
    expect(images?.endpoint).toBe('/pdf-to-images');
    expect(images?.output).toBe('zip');
  });
});
