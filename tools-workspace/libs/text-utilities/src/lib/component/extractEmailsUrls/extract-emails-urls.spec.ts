import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ExtractEmailsUrlsComponent } from './extract-emails-urls';
import { AssetService, ToastService } from '@tools-workspace/features-home';

describe('ExtractEmailsUrlsComponent', () => {
  let component: ExtractEmailsUrlsComponent;
  let fixture: ComponentFixture<ExtractEmailsUrlsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExtractEmailsUrlsComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AssetService, useValue: { getAssetPath: (p: string) => p } },
        { provide: ToastService, useValue: { info: jest.fn(), error: jest.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ExtractEmailsUrlsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('extracts emails', () => {
    component.extractType = 'emails';
    component.inputText = 'Contact user@example.com for info';
    component.onInputChange();
    expect(component.outputText).toContain('user@example.com');
  });
});
