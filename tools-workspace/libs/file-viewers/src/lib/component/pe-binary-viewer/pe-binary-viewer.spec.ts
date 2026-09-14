import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { fileViewerTestProviders } from '../../shared/file-viewer-test.utils';
import { PeBinaryViewerComponent } from './pe-binary-viewer';

function createMinimalPeBuffer(): ArrayBuffer {
  const buf = new Uint8Array(512);
  const view = new DataView(buf.buffer);

  view.setUint16(0, 0x5a4d, true);

  const peOffset = 0x80;
  view.setUint32(0x3c, peOffset, true);
  view.setUint32(peOffset, 0x4550, true);

  const coff = peOffset + 4;
  view.setUint16(coff, 0x8664, true);
  view.setUint16(coff + 2, 0, true);
  view.setUint32(coff + 4, 1_700_000_000, true);
  view.setUint16(coff + 16, 240, true);
  view.setUint16(coff + 18, 0x0002, true);

  const optional = coff + 20;
  view.setUint16(optional, 0x20b, true);
  view.setUint32(optional + 16, 0x1000, true);
  view.setBigUint64(optional + 24, 0x140000000n, true);
  view.setUint16(optional + 68, 3, true);

  return buf.buffer;
}

describe('PeBinaryViewerComponent', () => {
  let component: PeBinaryViewerComponent;
  let fixture: ComponentFixture<PeBinaryViewerComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PeBinaryViewerComponent],
      providers: [...fileViewerTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(PeBinaryViewerComponent);
    component = fixture.componentInstance;
    toast = TestBed.inject(ToastService) as unknown as {
      info: jest.Mock;
      error: jest.Mock;
      success: jest.Mock;
    };
    fixture.detectChanges();
  });

  it('should create with no suggestion when empty', () => {
    expect(component).toBeTruthy();
    expect(component.binary).toBeNull();
    expect(component.primarySuggestion).toBeNull();
    expect(component.relatedTools.length).toBeGreaterThan(0);
    expect(component.formatsLabel).toContain('EXE');
  });

  it('shows ELF suggestion after parse error', async () => {
    const file = new File([new Uint8Array([0, 1, 2])], 'bad.exe', {
      type: 'application/vnd.microsoft.portable-executable'
    });
    Object.defineProperty(file, 'arrayBuffer', {
      value: async () => file.slice(0).arrayBuffer()
    });

    await component.handleFiles([file]);

    expect(component.binary).toBeNull();
    expect(component.errorMessage).toBeTruthy();
    expect(component.primarySuggestion?.id).toBe('pe-elf');
    expect(toast.error).toHaveBeenCalled();
  });

  it('dismisses contextual suggestions', async () => {
    const file = new File([new Uint8Array([0, 1, 2])], 'bad.exe', {
      type: 'application/vnd.microsoft.portable-executable'
    });
    Object.defineProperty(file, 'arrayBuffer', {
      value: async () => file.slice(0).arrayBuffer()
    });

    await component.handleFiles([file]);
    const suggestion = component.primarySuggestion;
    expect(suggestion?.id).toBe('pe-elf');
    if (suggestion) {
      component.dismissSuggestion(suggestion.id);
      expect(component.primarySuggestion).toBeNull();
    }
  });

  it('loads PE binary and exposes header fields', async () => {
    const buffer = createMinimalPeBuffer();
    const file = new File([buffer], 'app.exe', {
      type: 'application/vnd.microsoft.portable-executable'
    });
    Object.defineProperty(file, 'arrayBuffer', {
      value: async () => buffer
    });

    await component.handleFiles([file]);

    expect(component.binary?.machine).toBe('AMD64');
    expect(component.binary?.entryPoint).toBe('0x1000');
    expect(component.binary?.imageBase).toBe('0x140000000');
    expect(component.binary?.subsystem).toBe('Windows CUI');
    expect(component.binary?.isDll).toBe(false);
    expect(component.headerFields.length).toBeGreaterThanOrEqual(6);
    expect(component.primarySuggestion?.id).toBe('pe-meta');
    expect(toast.success).toHaveBeenCalled();
  });
});
