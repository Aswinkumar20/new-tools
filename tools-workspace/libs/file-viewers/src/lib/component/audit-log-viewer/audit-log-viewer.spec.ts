import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { fileViewerTestProviders } from '../../shared/file-viewer-test.utils';
import { AuditLogViewerComponent } from './audit-log-viewer';

describe('AuditLogViewerComponent', () => {
  let component: AuditLogViewerComponent;
  let fixture: ComponentFixture<AuditLogViewerComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AuditLogViewerComponent],
      providers: [...fileViewerTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(AuditLogViewerComponent);
    component = fixture.componentInstance;
    toast = TestBed.inject(ToastService) as unknown as {
      info: jest.Mock;
      error: jest.Mock;
      success: jest.Mock;
    };
    fixture.detectChanges();
  });

  it('should create with upload suggestion when empty', () => {
    expect(component).toBeTruthy();
    expect(component.allEvents.length).toBe(0);
    expect(component.primarySuggestion?.id).toBe('al-log-empty');
    expect(component.relatedTools.length).toBeGreaterThan(0);
    expect(component.formatsLabel).toContain('JSON');
  });

  it('dismisses contextual suggestions', () => {
    const suggestion = component.primarySuggestion;
    expect(suggestion?.id).toBe('al-log-empty');
    if (suggestion) {
      component.dismissSuggestion(suggestion.id);
      expect(component.primarySuggestion).toBeNull();
    }
  });

  it('loads JSON audit events and collects actors', async () => {
    const content = JSON.stringify([
      {
        timestamp: '2024-03-01T10:00:00Z',
        actor: 'alice@example.com',
        action: 'login',
        resource: 'auth',
        details: 'Successful login'
      },
      {
        timestamp: '2024-03-01T11:00:00Z',
        actor: 'bob@example.com',
        action: 'delete',
        resource: 'document-1',
        details: 'Removed draft'
      }
    ]);

    await component.handleFiles([
      new File([content], 'audit.json', { type: 'application/json' })
    ]);

    expect(component.allEvents).toHaveLength(2);
    expect(component.actors).toEqual(['alice@example.com', 'bob@example.com']);
    expect(component.filteredEvents).toHaveLength(2);
    expect(toast.success).toHaveBeenCalled();
  });

  it('filters events by search text and actor', async () => {
    const content = JSON.stringify([
      { timestamp: '2024-01-01T00:00:00Z', actor: 'alice', action: 'read', resource: 'file-a' },
      { timestamp: '2024-01-02T00:00:00Z', actor: 'bob', action: 'write', resource: 'file-b' }
    ]);

    await component.handleFiles([new File([content], 'audit.json')]);

    component.onSearchChange('write');
    expect(component.filteredEvents).toHaveLength(1);
    expect(component.filteredEvents[0]?.actor).toBe('bob');

    component.onSearchChange('');
    component.onActorChange('alice');
    expect(component.filteredEvents).toHaveLength(1);
    expect(component.filteredEvents[0]?.action).toBe('read');
  });

  it('rejects unsupported files', async () => {
    await component.handleFiles([new File(['x'], 'notes.docx', { type: 'application/msword' })]);
    expect(component.errorMessage).toContain('valid audit export');
    expect(toast.error).toHaveBeenCalled();
  });

  it('shows parse error suggestion after failed load', async () => {
    await component.handleFiles([new File(['not-json'], 'audit.json', { type: 'application/json' })]);
    expect(component.allEvents).toHaveLength(0);
    expect(component.primarySuggestion?.id).toBe('al-log');
  });
});
