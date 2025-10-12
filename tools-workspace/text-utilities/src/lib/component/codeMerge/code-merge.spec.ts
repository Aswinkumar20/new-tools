import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CodeMerge } from './code-merge';

describe('CodeMerge', () => {
  let component: CodeMerge;
  let fixture: ComponentFixture<CodeMerge>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CodeMerge],
    }).compileComponents();

    fixture = TestBed.createComponent(CodeMerge);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
