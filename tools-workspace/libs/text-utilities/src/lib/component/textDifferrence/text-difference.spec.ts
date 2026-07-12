import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { NGX_MONACO_EDITOR_CONFIG } from 'ngx-monaco-editor-v2';
import { TextDifferenceComponent } from './text-difference';
import { AssetService, ToastService } from '@tools-workspace/features-home';

describe('TextDifferenceComponent', () => {
  let component: TextDifferenceComponent;
  let fixture: ComponentFixture<TextDifferenceComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TextDifferenceComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AssetService, useValue: { getAssetPath: (p: string) => p } },
        { provide: ToastService, useValue: { info: jest.fn(), error: jest.fn() } },
        { provide: NGX_MONACO_EDITOR_CONFIG, useValue: {} },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(TextDifferenceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('toggles sidebar visibility', () => {
    expect(component.showSidebar).toBe(true);
    component.toggleSidebar();
    expect(component.showSidebar).toBe(false);
    component.toggleSidebar();
    expect(component.showSidebar).toBe(true);
  });

  it('sets split and unified view modes', () => {
    component.setViewMode(false);
    expect(component.showSideBySide).toBe(false);
    component.setViewMode(true);
    expect(component.showSideBySide).toBe(true);
  });

  it('reports diff stats from models', () => {
    component.originalModel = { ...component.originalModel, code: 'abc' };
    component.modifiedModel = { ...component.modifiedModel, code: 'abcd' };
    component['refreshDiffStats']();
    expect(component.diffStats.originalChars).toBe(3);
    expect(component.diffStats.modifiedChars).toBe(4);
  });

  it('clears both sides', () => {
    component.clearAll();
    expect(component.originalModel.code).toBe('');
    expect(component.modifiedModel.code).toBe('');
  });
});
