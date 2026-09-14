import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { fileViewerTestProviders } from '../../shared/file-viewer-test.utils';
import * as apkUtils from '../../utils/apk-viewer.utils';
import { ApkViewerComponent } from './apk-viewer';

describe('ApkViewerComponent', () => {
  let component: ApkViewerComponent;
  let fixture: ComponentFixture<ApkViewerComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock };

  const mockApk: apkUtils.ApkInfo = {
    packageName: 'com.example.app',
    versionName: '1.0.0',
    versionCode: '1',
    appName: 'Example App',
    minSdkVersion: '21',
    targetSdkVersion: '34',
    permissions: ['android.permission.INTERNET'],
    activities: ['com.example.app.MainActivity'],
    fileEntries: ['AndroidManifest.xml', 'classes.dex'],
    iconDataUrl: 'data:image/png;base64,abc'
  };

  beforeEach(async () => {
    jest.spyOn(apkUtils, 'parseApkFile').mockResolvedValue(mockApk);

    await TestBed.configureTestingModule({
      imports: [ApkViewerComponent],
      providers: [...fileViewerTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(ApkViewerComponent);
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
    expect(component.apk).toBeNull();
    expect(component.primarySuggestion?.id).toBe('apk-archive');
    expect(component.relatedTools.length).toBeGreaterThan(0);
    expect(component.formatsLabel).toBe('APK');
  });

  it('dismisses contextual suggestions', () => {
    const suggestion = component.primarySuggestion;
    expect(suggestion?.id).toBe('apk-archive');
    if (suggestion) {
      component.dismissSuggestion(suggestion.id);
      expect(component.primarySuggestion).toBeNull();
    }
  });

  it('loads APK metadata via parseApkFile', async () => {
    const file = new File(['apk'], 'sample.apk', {
      type: 'application/vnd.android.package-archive'
    });

    await component.handleFiles([file]);

    expect(apkUtils.parseApkFile).toHaveBeenCalledWith(
      file,
      'app-info-parser/app-info-parser.min.js'
    );
    expect(component.apk?.packageName).toBe('com.example.app');
    expect(component.manifestFields).toHaveLength(6);
    expect(component.permissionCount).toBe(1);
    expect(component.activityCount).toBe(1);
    expect(component.visibleFileEntries).toHaveLength(2);
    expect(toast.success).toHaveBeenCalled();
  });

  it('limits visible file entries to first 50', async () => {
    const manyEntries = Array.from({ length: 60 }, (_, i) => `file-${i}.txt`);
    jest.spyOn(apkUtils, 'parseApkFile').mockResolvedValue({
      ...mockApk,
      fileEntries: manyEntries
    });

    const file = new File(['apk'], 'large.apk', {
      type: 'application/vnd.android.package-archive'
    });

    await component.handleFiles([file]);

    expect(component.visibleFileEntries).toHaveLength(50);
    expect(component.hasMoreFileEntries).toBe(true);
  });

  it('rejects non-APK files', async () => {
    const file = new File(['txt'], 'notes.txt', { type: 'text/plain' });

    await component.handleFiles([file]);

    expect(component.apk).toBeNull();
    expect(toast.error).toHaveBeenCalled();
  });
});
