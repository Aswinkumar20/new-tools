import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CLIPBOARD_HISTORY_STORAGE_KEY } from '../../constants/clipboard-history.constants';
import { cftToolTestProviders } from '../../shared/cft-tool-test.utils';
import { ClipboardHistoryComponent } from './clipboard-history';

describe('ClipboardHistoryComponent', () => {
  let component: ClipboardHistoryComponent;
  let fixture: ComponentFixture<ClipboardHistoryComponent>;

  beforeEach(async () => {
    localStorage.removeItem(CLIPBOARD_HISTORY_STORAGE_KEY);

    await TestBed.configureTestingModule({
      imports: [ClipboardHistoryComponent],
      providers: [...cftToolTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(ClipboardHistoryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.removeItem(CLIPBOARD_HISTORY_STORAGE_KEY);
  });

  it('should create with empty history', () => {
    expect(component).toBeTruthy();
    expect(component.history()).toEqual([]);
  });

  it('adds entries and filters them', async () => {
    await component.addToHistory('hello clipboard');
    await component.addToHistory('const x = 1');
    expect(component.totalEntries()).toBe(2);

    component.onSearchChange('const');
    expect(component.filteredHistory()).toHaveLength(1);
    expect(component.filteredHistory()[0].type).toBe('code');
  });

  it('selects and removes an entry', async () => {
    await component.addToHistory('select-me');
    const entry = component.history()[0];
    component.selectEntry(entry);
    expect(component.selectedEntry()?.id).toBe(entry.id);

    component.removeEntry(entry.id);
    expect(component.history()).toHaveLength(0);
    expect(component.selectedEntry()).toBeNull();
  });

  it('persists history to localStorage', async () => {
    await component.addToHistory('persist-me');
    const stored = localStorage.getItem(CLIPBOARD_HISTORY_STORAGE_KEY);
    expect(stored).toContain('persist-me');
  });

  it('provides a dismissible suggestion', () => {
    const suggestion = component.primarySuggestion();
    expect(suggestion).toBeTruthy();
    if (suggestion) {
      component.dismissSuggestion(suggestion.id);
      expect(component.primarySuggestion()).toBeNull();
    }
  });
});
