import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { fileViewerTestProviders } from '../../shared/file-viewer-test.utils';
import * as ipaUtils from '../../utils/ipa-viewer.utils';
import { IpaViewerComponent } from './ipa-viewer';

describe('IpaViewerComponent', () => {
  let component: IpaViewerComponent;
  let fixture: ComponentFixture<IpaViewerComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock };

  const mockIpa: ipaUtils.IpaInfo = {
    appName: 'Example iOS App',
    bundleId: 'com.example.ios',
    version: '2.0.0',
    build: '42',
    minimumOsVersion: '15.0',
    supportedDevices: ['iPhone', 'iPad'],
    urlSchemes: ['exampleapp'],
    fileEntries: ['Payload/App.app/Info.plist', 'Payload/App.app/AppIcon.png'],
    rawPlist: {}
  };

  beforeEach(async () => {
    jest.spyOn(ipaUtils, 'parseIpaFile').mockResolvedValue(mockIpa);

    await TestBed.configureTestingModule({
      imports: [IpaViewerComponent],
      providers: [...fileViewerTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(IpaViewerComponent);
    component = fixture.componentInstance;
    toast = TestBed.inject(ToastService) as unknown as {
      info: jest.Mock;
      error: jest.Mock;
      success: jest.Mock;
    };
    fixture.detectChanges();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should create with upload suggestion when empty', () => {
    expect(component).toBeTruthy();
    expect(component.ipa).toBeNull();
    expect(component.primarySuggestion?.id).toBe('ipa-archive');
    expect(component.relatedTools.length).toBeGreaterThan(0);
    expect(component.formatsLabel).toBe('IPA');
  });

  it('dismisses contextual suggestions', () => {
    const suggestion = component.primarySuggestion;
    expect(suggestion?.id).toBe('ipa-archive');
    if (suggestion) {
      component.dismissSuggestion(suggestion.id);
      expect(component.primarySuggestion).toBeNull();
    }
  });

  it('loads IPA metadata via parseIpaFile', async () => {
    const file = new File(['ipa'], 'sample.ipa', { type: 'application/octet-stream' });

    await component.handleFiles([file]);

    expect(ipaUtils.parseIpaFile).toHaveBeenCalledWith(file);
    expect(component.ipa?.bundleId).toBe('com.example.ios');
    expect(component.plistFields).toHaveLength(5);
    expect(component.urlSchemeCount).toBe(1);
    expect(component.supportedDeviceCount).toBe(2);
    expect(component.visibleFileEntries).toHaveLength(2);
    expect(toast.success).toHaveBeenCalled();
  });

  it('limits visible file entries to first 50', async () => {
    const manyEntries = Array.from({ length: 55 }, (_, i) => `Payload/file-${i}.txt`);
    jest.spyOn(ipaUtils, 'parseIpaFile').mockResolvedValue({
      ...mockIpa,
      fileEntries: manyEntries
    });

    const file = new File(['ipa'], 'large.ipa', { type: 'application/octet-stream' });

    await component.handleFiles([file]);

    expect(component.visibleFileEntries).toHaveLength(50);
    expect(component.hasMoreFileEntries).toBe(true);
  });

  it('rejects non-IPA files by extension when type is generic', async () => {
    const file = new File(['txt'], 'notes.txt', { type: 'text/plain' });

    await component.handleFiles([file]);

    expect(component.ipa).toBeNull();
    expect(toast.error).toHaveBeenCalled();
  });
});
