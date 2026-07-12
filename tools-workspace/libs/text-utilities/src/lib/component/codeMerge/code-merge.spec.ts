import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { CodeMergeComponent } from './code-merge';
import { AssetService } from '@tools-workspace/features-home';

describe('CodeMergeComponent', () => {
  let component: CodeMergeComponent;
  let fixture: ComponentFixture<CodeMergeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CodeMergeComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AssetService, useValue: { getAssetPath: (p: string) => p } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CodeMergeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('merges left and right branches', () => {
    component.leftBranch = 'line one\nline two';
    component.rightBranch = 'line one\nline three';
    component.merge();
    expect(component.mergedPreview).toContain('line one');
    expect(component.mergedPreview.length).toBeGreaterThan(0);
  });
});
