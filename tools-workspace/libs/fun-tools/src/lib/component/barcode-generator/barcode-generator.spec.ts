jest.mock('../../utils/barcode-generator.utils', () => {
  const actual = jest.requireActual('../../utils/barcode-generator.utils');
  return {
    ...actual,
    loadJsBarcodeLibrary: jest.fn().mockResolvedValue(undefined),
    renderBarcodeToDataUrl: jest.fn().mockReturnValue('data:image/png;base64,TEST'),
    downloadBarcodeDataUrl: jest.fn(),
    copyBarcodeImageToClipboard: jest.fn().mockResolvedValue(undefined)
  };
});

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { ftToolTestProviders } from '../../shared/ft-tool-test.utils';
import { downloadBarcodeDataUrl, renderBarcodeToDataUrl } from '../../utils/barcode-generator.utils';
import { BarcodeGeneratorComponent } from './barcode-generator';

describe('BarcodeGeneratorComponent', () => {
  let component: BarcodeGeneratorComponent;
  let fixture: ComponentFixture<BarcodeGeneratorComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BarcodeGeneratorComponent],
      providers: [...ftToolTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(BarcodeGeneratorComponent);
    component = fixture.componentInstance;
    toast = TestBed.inject(ToastService) as unknown as {
      info: jest.Mock;
      error: jest.Mock;
      success: jest.Mock;
    };
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create and expose related tools', () => {
    expect(component).toBeTruthy();
    expect(component.relatedTools.length).toBeGreaterThan(0);
    expect(component.formats.length).toBeGreaterThan(0);
  });

  it('generates a barcode after the library loads', async () => {
    await fixture.whenStable();
    expect(renderBarcodeToDataUrl).toHaveBeenCalled();
    expect(component.hasBarcode()).toBe(true);
    expect(component.barcodeDataUrl()).toContain('data:image/png');
  });

  it('suggests barcode-to-pdf when a barcode is ready', async () => {
    await fixture.whenStable();
    expect(component.primarySuggestion()?.id).toBe('bcg-pdf');
  });

  it('dismisses contextual suggestions', () => {
    const suggestion = component.primarySuggestion();
    expect(suggestion).toBeTruthy();
    if (suggestion) {
      component.dismissSuggestion(suggestion.id);
      expect(component.primarySuggestion()).toBeNull();
    }
  });

  it('downloads barcode with toast feedback', () => {
    component.downloadBarcode();
    expect(downloadBarcodeDataUrl).toHaveBeenCalled();
    expect(toast.info).toHaveBeenCalledWith('Barcode downloaded');
  });

  it('copies barcode data with toast feedback', async () => {
    Object.assign(navigator, {
      clipboard: { writeText: jest.fn().mockResolvedValue(undefined) }
    });
    await component.copyData();
    expect(toast.info).toHaveBeenCalledWith('Barcode data copied to clipboard');
  });
});
