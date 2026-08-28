import { Component } from '@angular/core';
import { ElementRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';
import { AssetService, Navigation, ToastService } from '@tools-workspace/features-home';
import { BpmnViewerComponent } from './bpmn-viewer';
import { BPMN_SAMPLE_XML } from '../../constants/bpmn-viewer.constants';
import * as utils from '../../utils/bpmn-viewer.utils';
import type { BpmnNavigatedViewerConstructor } from '../../types/bpmn-viewer.types';

@Component({ selector: 'lib-navigation', standalone: true, template: '' })
class StubNavigationComponent {}

describe('BpmnViewerComponent', () => {
  let fixture: ComponentFixture<BpmnViewerComponent>;
  let component: BpmnViewerComponent;
  let toast: { success: jest.Mock; error: jest.Mock; info: jest.Mock; warning: jest.Mock };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BpmnViewerComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ToastService,
          useValue: {
            success: jest.fn(),
            error: jest.fn(),
            info: jest.fn(),
            warning: jest.fn()
          }
        },
        {
          provide: AssetService,
          useValue: { getAssetPath: (path: string) => `/assets/${path}` }
        }
      ]
    })
      .overrideComponent(BpmnViewerComponent, {
        remove: { imports: [Navigation] },
        add: { imports: [StubNavigationComponent] }
      })
      .compileComponents();

    jest.spyOn(utils, 'loadBpmnNavigatedViewer').mockResolvedValue(
      class MockViewer {
        importXML = jest.fn().mockResolvedValue({ warnings: [] });
        saveSVG = jest.fn().mockResolvedValue({ svg: '<svg></svg>' });
        destroy = jest.fn();
        get = jest.fn((service: string) => {
          if (service === 'elementRegistry') {
            return { get: jest.fn(() => ({})) };
          }
          if (service === 'selection') {
            return { select: jest.fn() };
          }
          return {
            zoom: jest.fn().mockReturnValue(1),
            scrollToElement: jest.fn(),
            resized: jest.fn()
          };
        });
        on = jest.fn();
      } as unknown as BpmnNavigatedViewerConstructor
    );
    jest.spyOn(utils, 'ensureBpmnStylesheets').mockImplementation(() => undefined);

    fixture = TestBed.createComponent(BpmnViewerComponent);
    component = fixture.componentInstance;
    toast = TestBed.inject(ToastService) as unknown as typeof toast;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows intro suggestion when empty', () => {
    expect(component.primarySuggestion?.id).toBe('bpmn-intro');
  });

  it('loads a sample diagram and exposes stats', async () => {
    await component.loadSample();
    await component.loadSample();
    expect(component.currentFile?.name).toBe('order-fulfillment.bpmn');
    expect(component.bpmnFiles).toHaveLength(1);
    expect(component.stats?.processName).toBe('Order Fulfillment');
    expect(component.elements.length).toBeGreaterThan(0);
    expect(component.canExport).toBe(true);
    expect(toast.success).toHaveBeenCalled();
  });

  it('rejects invalid files', async () => {
    await component.handleFiles([new File(['plain'], 'notes.txt', { type: 'text/plain' })]);
    expect(component.currentFile).toBeNull();
    expect(toast.error).toHaveBeenCalled();
  });

  it('filters elements and repairs selection when filter removes current item', async () => {
    await component.loadSample();
    const first = component.filteredElements[0];
    component.selectedElementId = first.id;
    component.elementSearch = '__none__';
    component['refreshFilteredElements']();
    expect(component.filteredElements.length).toBe(0);
    expect(component.selectedElementId).toBeNull();
  });

  it('setElementFilter is a no-op when filter unchanged', async () => {
    await component.loadSample();
    const before = component.filteredElements.length;
    component.setElementFilter('all');
    expect(component.filteredElements.length).toBe(before);
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

  it('guards export when nothing loaded', async () => {
    await component.exportAs('elements-csv');
    expect(toast.info).toHaveBeenCalledWith('Nothing to export');
  });

  it('opens file picker without overlay input', async () => {
    const click = jest.fn();
    component.fileInput = {
      nativeElement: { click }
    } as unknown as ElementRef<HTMLInputElement>;
    component.openFilePicker();
    expect(click).toHaveBeenCalled();
  });

  it('copies BPMN XML when clipboard is available', async () => {
    await component.loadSample();
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    await component.copyXml();
    expect(writeText).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith('BPMN XML copied');
  });

  it('dismisses suggestion and restores after clearAll', async () => {
    const suggestion = component.primarySuggestion;
    expect(suggestion).toBeTruthy();
    component.dismissSuggestion(suggestion!.id);
    expect(component.primarySuggestion).toBeNull();

    await component.loadSample();
    component.clearAll();
    expect(component.bpmnFiles.length).toBe(0);
    expect(component.primarySuggestion?.id).toBe('bpmn-intro');
  });

  it('keeps details expanded by default and toggles the sidebar', () => {
    expect(component.sidebarCollapsed).toBe(false);
    component.toggleSidebar();
    expect(component.sidebarCollapsed).toBe(true);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('.bpmn-sidebar')).toBeFalsy();
    component.toggleSidebar();
    expect(component.sidebarCollapsed).toBe(false);
  });

  it('keeps scroll-owner structure for canvas wrap, workspace, and element list', async () => {
    await component.loadSample();
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.bpmn-canvas-wrap')).toBeTruthy();
    expect(root.querySelector('.bpmn-workspace')).toBeTruthy();
    expect(root.querySelector('.bpmn-element-list')).toBeTruthy();
    expect(fixture.debugElement.query(By.css('.bpmn-toolbar'))).toBeTruthy();
  });

  it('focuses element and updates selection', async () => {
    await component.loadSample();
    const review = component.elements.find((item) => item.id === 'Task_Review');
    expect(review).toBeTruthy();
    component.focusElement(review!);
    expect(component.selectedElementId).toBe('Task_Review');
  });
});
