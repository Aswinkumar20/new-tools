import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { RemoveDuplicateLinesComponent } from './remove-duplicate-lines';
import { AssetService, ToastService } from '@tools-workspace/features-home';

describe('RemoveDuplicateLinesComponent', () => {
  let component: RemoveDuplicateLinesComponent;
  let fixture: ComponentFixture<RemoveDuplicateLinesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RemoveDuplicateLinesComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AssetService, useValue: { getAssetPath: (p: string) => p } },
        { provide: ToastService, useValue: { info: jest.fn(), error: jest.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RemoveDuplicateLinesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('dedupes words on input', () => {
    component.onInputChange('team Team hello');
    expect(component.outputText).toBe('team hello');
    expect(component.removedCount).toBe(1);
  });

  it('switches to line mode', () => {
    component.setDedupMode('lines');
    component.onInputChange('a\na\nb');
    expect(component.outputText).toBe('a\nb');
  });

  it('apply cleanup updates source', () => {
    component.onInputChange('dup dup word');
    component.applyCleanup();
    expect(component.inputText).toBe('dup word');
  });
});
