import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { textToolTestProviders } from '../../shared/text-tool-test.utils';
import { CodeMergeComponent } from './code-merge';

describe('CodeMergeComponent', () => {
  let component: CodeMergeComponent;
  let fixture: ComponentFixture<CodeMergeComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CodeMergeComponent],
      providers: [...textToolTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(CodeMergeComponent);
    component = fixture.componentInstance;
    toast = TestBed.inject(ToastService) as unknown as {
      info: jest.Mock;
      error: jest.Mock;
      success: jest.Mock;
    };
    fixture.detectChanges();
  });

  it('should create with get-started suggestion', () => {
    expect(component).toBeTruthy();
    expect(component.primarySuggestion?.id).toBe('cm-get-started');
    expect(component.relatedTools.length).toBeGreaterThan(0);
  });

  it('merges left and right branches with conflict markers', () => {
    component.leftBranch = 'line one\nline two';
    component.rightBranch = 'line one\nline three';
    component.merge();
    expect(component.mergedPreview).toContain('<<<<<<< HEAD');
    expect(component.mergedPreview).toContain('=======');
    expect(component.mergedPreview).toContain('>>>>>>> Incoming');
    expect(component.mergedPreview).toContain('line two');
    expect(component.mergedPreview).toContain('line three');
    expect(component.primarySuggestion?.id).toBe('cm-markers');
  });

  it('concatenates when markers are disabled', () => {
    component.includeConflictMarkers = false;
    component.leftBranch = 'a';
    component.rightBranch = 'b';
    component.merge();
    expect(component.mergedPreview).toBe('a\nb');
    expect(component.primarySuggestion?.id).toBe('cm-concat');
  });

  it('uses custom labels in conflict markers', () => {
    component.baseLabel = 'main';
    component.incomingLabel = 'feature';
    component.leftBranch = 'L';
    component.rightBranch = 'R';
    component.merge();
    expect(component.mergedPreview).toContain('<<<<<<< main');
    expect(component.mergedPreview).toContain('>>>>>>> feature');
  });

  it('clears with toast feedback', () => {
    component.leftBranch = 'x';
    component.rightBranch = 'y';
    component.merge();
    component.clear();
    expect(component.leftBranch).toBe('');
    expect(component.rightBranch).toBe('');
    expect(component.mergedPreview).toBe('');
    expect(toast.info).toHaveBeenCalledWith('Cleared');
    expect(component.primarySuggestion?.id).toBe('cm-get-started');
  });

  it('copies merged preview with toast feedback', async () => {
    Object.assign(navigator, {
      clipboard: { writeText: jest.fn().mockResolvedValue(undefined) }
    });
    component.leftBranch = 'a';
    component.rightBranch = 'b';
    component.merge();
    await component.copyMerged();
    expect(toast.info).toHaveBeenCalledWith('Merged preview copied to clipboard');
  });

  it('dismisses contextual suggestions', () => {
    const suggestion = component.primarySuggestion;
    expect(suggestion).toBeTruthy();
    if (suggestion) {
      component.dismissSuggestion(suggestion.id);
      expect(component.primarySuggestion).toBeNull();
    }
  });
});
