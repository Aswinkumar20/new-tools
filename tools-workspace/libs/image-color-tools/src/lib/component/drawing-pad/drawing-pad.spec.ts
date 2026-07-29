import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { DRAWING_PAD_INIT_DELAY_MS } from '../../constants/drawing-pad.constants';
import { ictToolTestProviders } from '../../shared/ict-tool-test.utils';
import { DrawingPadComponent } from './drawing-pad';

function mockCanvasContext(): CanvasRenderingContext2D {
  const ctx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineCap: 'round',
    lineJoin: 'round',
    globalCompositeOperation: 'source-over',
    fillRect: jest.fn(),
    beginPath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    stroke: jest.fn(),
    getImageData: jest.fn(() => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 })),
    putImageData: jest.fn()
  } as unknown as CanvasRenderingContext2D;

  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: jest.fn(() => ctx)
  });
  Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', {
    configurable: true,
    value: jest.fn((cb: (blob: Blob | null) => void) => {
      cb(new Blob(['png'], { type: 'image/png' }));
    })
  });

  return ctx;
}

describe('DrawingPadComponent', () => {
  let component: DrawingPadComponent;
  let fixture: ComponentFixture<DrawingPadComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock };

  beforeEach(async () => {
    mockCanvasContext();

    await TestBed.configureTestingModule({
      imports: [DrawingPadComponent],
      providers: [...ictToolTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(DrawingPadComponent);
    component = fixture.componentInstance;
    toast = TestBed.inject(ToastService) as unknown as {
      info: jest.Mock;
      error: jest.Mock;
      success: jest.Mock;
    };
    fixture.detectChanges();
  });

  it('should create with defaults, suggestion, and related tools', fakeAsync(() => {
    tick(DRAWING_PAD_INIT_DELAY_MS);
    expect(component).toBeTruthy();
    expect(component.currentTool()).toBe('pen');
    expect(component.currentColor()).toBe('#007bff');
    expect(component.relatedTools.length).toBeGreaterThan(0);
    expect(component.primarySuggestion()?.id).toBe('dp-start');
  }));

  it('switches tools via form snapshot', fakeAsync(() => {
    tick(DRAWING_PAD_INIT_DELAY_MS);
    component.onToolChange('eraser');
    expect(component.currentTool()).toBe('eraser');
    expect(component.form.controls.tool.value).toBe('eraser');
  }));

  it('updates brush size and color', fakeAsync(() => {
    tick(DRAWING_PAD_INIT_DELAY_MS);
    component.form.patchValue({ brushSize: 24, color: '#ff0000' });
    component.onBrushSizeChange();
    component.onColorChange();
    expect(component.currentBrushSize()).toBe(24);
    expect(component.currentColor()).toBe('#ff0000');
  }));

  it('dismisses contextual suggestions', fakeAsync(() => {
    tick(DRAWING_PAD_INIT_DELAY_MS);
    const suggestion = component.primarySuggestion();
    expect(suggestion).toBeTruthy();
    if (suggestion) {
      component.dismissSuggestion(suggestion.id);
      expect(component.primarySuggestion()).toBeNull();
    }
  }));

  it('downloads PNG with toast feedback', fakeAsync(() => {
    tick(DRAWING_PAD_INIT_DELAY_MS);
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: jest.fn(() => 'blob:drawing')
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: jest.fn()
    });
    const clickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    component.downloadCanvas();
    expect(toast.info).toHaveBeenCalledWith('Drawing downloaded');
    clickSpy.mockRestore();
  }));
});
