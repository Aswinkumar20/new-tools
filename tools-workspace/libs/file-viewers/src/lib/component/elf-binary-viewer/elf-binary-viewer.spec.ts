import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { fileViewerTestProviders } from '../../shared/file-viewer-test.utils';
import { ElfBinaryViewerComponent } from './elf-binary-viewer';

function createMinimalElfBuffer(): ArrayBuffer {
  const buf = new Uint8Array(64);
  buf[0] = 0x7f;
  buf[1] = 0x45;
  buf[2] = 0x4c;
  buf[3] = 0x46;
  buf[4] = 2;
  buf[5] = 1;

  const view = new DataView(buf.buffer);
  view.setBigUint64(24, 0x401000n, true);
  view.setBigUint64(40, 0n, true);
  view.setUint16(56, 2, true);
  view.setUint16(58, 64, true);
  view.setUint16(60, 0, true);
  view.setUint16(62, 0, true);

  return buf.buffer;
}

describe('ElfBinaryViewerComponent', () => {
  let component: ElfBinaryViewerComponent;
  let fixture: ComponentFixture<ElfBinaryViewerComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ElfBinaryViewerComponent],
      providers: [...fileViewerTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(ElfBinaryViewerComponent);
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
    expect(component.formatsLabel).toContain('ELF');
  });

  it('shows PE suggestion after parse error', async () => {
    const file = new File([new Uint8Array([0, 1, 2])], 'bad.elf', { type: 'application/octet-stream' });
    Object.defineProperty(file, 'arrayBuffer', {
      value: async () => file.slice(0).arrayBuffer()
    });

    await component.handleFiles([file]);

    expect(component.binary).toBeNull();
    expect(component.errorMessage).toBeTruthy();
    expect(component.primarySuggestion?.id).toBe('elf-pe');
    expect(toast.error).toHaveBeenCalled();
  });

  it('dismisses contextual suggestions', async () => {
    const file = new File([new Uint8Array([0, 1, 2])], 'bad.elf', { type: 'application/octet-stream' });
    Object.defineProperty(file, 'arrayBuffer', {
      value: async () => file.slice(0).arrayBuffer()
    });

    await component.handleFiles([file]);
    const suggestion = component.primarySuggestion;
    expect(suggestion?.id).toBe('elf-pe');
    if (suggestion) {
      component.dismissSuggestion(suggestion.id);
      expect(component.primarySuggestion).toBeNull();
    }
  });

  it('loads ELF binary and exposes header fields', async () => {
    const buffer = createMinimalElfBuffer();
    const file = new File([buffer], 'app.elf', { type: 'application/octet-stream' });
    Object.defineProperty(file, 'arrayBuffer', {
      value: async () => buffer
    });

    await component.handleFiles([file]);

    expect(component.binary?.classLabel).toBe('ELF64');
    expect(component.binary?.entryPoint).toBe('0x401000');
    expect(component.binary?.segmentCount).toBe(2);
    expect(component.headerFields).toHaveLength(5);
    expect(component.primarySuggestion?.id).toBe('elf-archive');
    expect(toast.success).toHaveBeenCalled();
  });
});
