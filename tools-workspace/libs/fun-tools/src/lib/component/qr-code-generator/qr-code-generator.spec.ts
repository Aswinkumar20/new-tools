jest.mock('../../utils/qr-code-generator.utils', () => {
  const actual = jest.requireActual('../../utils/qr-code-generator.utils');
  return {
    ...actual,
    loadQrCodeLibrary: jest.fn().mockResolvedValue(undefined),
    renderQrCodeToDataUrl: jest.fn().mockResolvedValue('data:image/png;base64,TEST'),
    downloadQrCodeDataUrl: jest.fn(),
    copyQrCodeImageToClipboard: jest.fn().mockResolvedValue(undefined)
  };
});

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { ftToolTestProviders } from '../../shared/ft-tool-test.utils';
import { downloadQrCodeDataUrl, renderQrCodeToDataUrl } from '../../utils/qr-code-generator.utils';
import { QrCodeGeneratorComponent } from './qr-code-generator';

describe('QrCodeGeneratorComponent', () => {
  let component: QrCodeGeneratorComponent;
  let fixture: ComponentFixture<QrCodeGeneratorComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QrCodeGeneratorComponent],
      providers: [...ftToolTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(QrCodeGeneratorComponent);
    component = fixture.componentInstance;
    toast = TestBed.inject(ToastService) as unknown as {
      info: jest.Mock;
      error: jest.Mock;
      success: jest.Mock;
    };
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create and expose related tools', async () => {
    expect(component).toBeTruthy();
    expect(component.relatedTools.length).toBeGreaterThan(0);
  });

  it('generates a QR code after the library loads', async () => {
    await fixture.whenStable();
    expect(renderQrCodeToDataUrl).toHaveBeenCalled();
    expect(component.hasQRCode()).toBe(true);
    expect(component.primarySuggestion()?.id).toBe('qrc-pdf');
  });

  it('dismisses contextual suggestions', () => {
    const suggestion = component.primarySuggestion();
    expect(suggestion).toBeTruthy();
    if (suggestion) {
      component.dismissSuggestion(suggestion.id);
      expect(component.primarySuggestion()).toBeNull();
    }
  });

  it('downloads QR with toast feedback', () => {
    component.downloadQRCode();
    expect(downloadQrCodeDataUrl).toHaveBeenCalled();
    expect(toast.info).toHaveBeenCalledWith('QR code downloaded');
  });

  it('copies content with toast feedback', async () => {
    Object.assign(navigator, {
      clipboard: { writeText: jest.fn().mockResolvedValue(undefined) }
    });
    await component.copyContent();
    expect(toast.info).toHaveBeenCalledWith('QR content copied to clipboard');
  });
});
