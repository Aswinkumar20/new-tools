import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { SlugGeneratorComponent } from './slug-generator';
import { AssetService, ToastService } from '@tools-workspace/features-home';

describe('SlugGeneratorComponent', () => {
  let component: SlugGeneratorComponent;
  let fixture: ComponentFixture<SlugGeneratorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SlugGeneratorComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AssetService, useValue: { getAssetPath: (p: string) => p } },
        { provide: ToastService, useValue: { info: jest.fn(), error: jest.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SlugGeneratorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('generates a slug from headline', () => {
    component.inputText = 'Hello World Example';
    component.onInputChange();
    expect(component.slug).toBe('hello-world-example');
  });

  it('uses underscore separator', () => {
    component.setSeparator('_');
    component.inputText = 'Hello World';
    component.onInputChange();
    expect(component.slug).toBe('hello_world');
  });

  it('removes numbers when enabled', () => {
    component.removeNumbers = true;
    component.inputText = 'Top 10 Tips';
    component.onOptionsChange();
    expect(component.slug).not.toContain('10');
  });

  it('swaps input and slug', () => {
    component.inputText = 'My Title';
    component.onInputChange();
    const slug = component.slug;
    component.swapInputOutput();
    expect(component.inputText).toBe(slug);
    expect(component.slug).toBe('My Title');
  });

  it('clears input and slug', () => {
    component.inputText = 'Test';
    component.onInputChange();
    component.clear();
    expect(component.inputText).toBe('');
    expect(component.slug).toBe('');
  });
});
