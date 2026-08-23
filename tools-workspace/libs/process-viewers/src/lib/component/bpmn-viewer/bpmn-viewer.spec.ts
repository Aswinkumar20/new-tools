import { ElementRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AssetService, ToastService } from '@tools-workspace/features-home';
import { BpmnViewerComponent } from './bpmn-viewer';
import { BPMN_SAMPLE_XML } from '../../constants/bpmn-viewer.constants';
import * as utils from '../../utils/bpmn-viewer.utils';
import type { BpmnNavigatedViewerConstructor } from '../../types/bpmn-viewer.types';

describe('BpmnViewerComponent', () => {
  let fixture: ComponentFixture<BpmnViewerComponent>;
  let component: BpmnViewerComponent;
  const toast = { success: jest.fn(), error: jest.fn(), info: jest.fn() };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BpmnViewerComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ToastService, useValue: toast },
        {
          provide: AssetService,
          useValue: { getAssetPath: (path: string) => `/assets/${path}` }
        }
      ]
    }).compileComponents();

    jest.spyOn(utils, 'loadBpmnNavigatedViewer').mockResolvedValue(
      class MockViewer {
        importXML = jest.fn().mockResolvedValue({ warnings: [] });
        saveSVG = jest.fn().mockResolvedValue({ svg: '<svg></svg>' });
        destroy = jest.fn();
        get = jest.fn().mockReturnValue({
          zoom: jest.fn().mockReturnValue(1),
          select: jest.fn(),
          scrollToElement: jest.fn(),
          resized: jest.fn()
        });
        on = jest.fn();
      } as unknown as BpmnNavigatedViewerConstructor
    );
    jest.spyOn(utils, 'ensureBpmnStylesheets').mockImplementation(() => undefined);

    fixture = TestBed.createComponent(BpmnViewerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('loads a sample diagram and exposes stats', async () => {
    await component.loadSample();
    await component.loadSample();
    expect(component.currentFile?.name).toBe('order-fulfillment.bpmn');
    expect(component.bpmnFiles).toHaveLength(1);
    expect(component.stats?.processName).toBe('Order Fulfillment');
    expect(component.elements.length).toBeGreaterThan(0);
    expect(toast.success).toHaveBeenCalled();
  });

  it('rejects invalid files', async () => {
    await component.handleFiles([new File(['plain'], 'notes.txt', { type: 'text/plain' })]);
    expect(component.currentFile).toBeNull();
    expect(toast.error).toHaveBeenCalled();
  });

  it('exports summary formats after load', async () => {
    const createObjectURL = jest.fn().mockReturnValue('blob:mock');
    const revokeObjectURL = jest.fn();
    (URL as { createObjectURL: (b: Blob) => string }).createObjectURL = createObjectURL;
    (URL as { revokeObjectURL: (u: string) => void }).revokeObjectURL = revokeObjectURL;
    const originalCreateElement = document.createElement.bind(document);
    jest.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
      if (tag === 'a') {
        return { href: '', download: '', click: jest.fn() } as unknown as HTMLAnchorElement;
      }
      return originalCreateElement(tag);
    }) as typeof document.createElement);

    await component.handleFiles([
      new File([BPMN_SAMPLE_XML], 'demo.bpmn', { type: 'application/xml' })
    ]);
    await component.exportAs('elements-csv');
    expect(toast.success).toHaveBeenCalledWith('Exported elements CSV');
  });

  it('filters elements and opens file picker without overlay input', async () => {
    await component.loadSample();
    component.setElementFilter('task');
    expect(component.filteredElements.every((item) => item.kind === 'task')).toBe(true);

    const click = jest.fn();
    component.fileInput = {
      nativeElement: { click }
    } as unknown as ElementRef<HTMLInputElement>;
    component.openFilePicker();
    expect(click).toHaveBeenCalled();
  });

  it('keeps details expanded by default and toggles the sidebar', () => {
    expect(component.sidebarCollapsed).toBe(false);
    component.toggleSidebar();
    expect(component.sidebarCollapsed).toBe(true);
    component.toggleSidebar();
    expect(component.sidebarCollapsed).toBe(false);
  });
});
