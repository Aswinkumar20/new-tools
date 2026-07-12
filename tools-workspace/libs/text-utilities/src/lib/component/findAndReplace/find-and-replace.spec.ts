import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { FindAndReplaceComponent } from './find-and-replace';
import { AssetService, ToastService } from '@tools-workspace/features-home';

describe('FindAndReplaceComponent', () => {
  let component: FindAndReplaceComponent;
  let fixture: ComponentFixture<FindAndReplaceComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FindAndReplaceComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AssetService, useValue: { getAssetPath: (p: string) => p } },
        { provide: ToastService, useValue: { info: jest.fn(), error: jest.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FindAndReplaceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('replaces all matches', () => {
    component.findText = 'foo';
    component.replaceText = 'bar';
    component.inputText = 'foo baz foo';
    component.onInputChange();
    expect(component.outputText).toBe('bar baz bar');
  });
});
