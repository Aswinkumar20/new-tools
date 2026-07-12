import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { InvisibleCharacterDetectorComponent } from './invisible-character-detector';
import { AssetService, ToastService } from '@tools-workspace/features-home';

describe('InvisibleCharacterDetectorComponent', () => {
  let component: InvisibleCharacterDetectorComponent;
  let fixture: ComponentFixture<InvisibleCharacterDetectorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InvisibleCharacterDetectorComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AssetService, useValue: { getAssetPath: (p: string) => p } },
        { provide: ToastService, useValue: { info: jest.fn(), error: jest.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(InvisibleCharacterDetectorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('detects zero-width space', () => {
    component.inputText = `a\u200bb`;
    component.onInputChange();
    expect(component.invisibleCount).toBe(1);
  });
});
