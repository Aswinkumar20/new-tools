import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TextCaseConvertorComponent } from './text-case-convertor';

describe('TextCaseConvertor', () => {
  let component: TextCaseConvertorComponent;
  let fixture: ComponentFixture<TextCaseConvertorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TextCaseConvertorComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TextCaseConvertorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
