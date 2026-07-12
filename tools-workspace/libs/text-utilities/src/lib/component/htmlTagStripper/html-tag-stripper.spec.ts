import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { HtmlTagStripperComponent } from './html-tag-stripper';
import { AssetService, ToastService } from '@tools-workspace/features-home';

describe('HtmlTagStripperComponent', () => {
  let component: HtmlTagStripperComponent;
  let fixture: ComponentFixture<HtmlTagStripperComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HtmlTagStripperComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AssetService, useValue: { getAssetPath: (p: string) => p } },
        { provide: ToastService, useValue: { info: jest.fn(), error: jest.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HtmlTagStripperComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('strips HTML tags', () => {
    component.inputText = '<p>Hello <strong>world</strong></p>';
    component.onInputChange();
    expect(component.outputText).toBe('Hello world');
  });
});
