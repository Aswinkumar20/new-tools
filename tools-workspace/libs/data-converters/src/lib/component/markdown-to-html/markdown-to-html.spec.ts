import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MarkdownToHtmlComponent } from './markdown-to-html';
import { converterTestProviders } from '../../shared/converter-test.utils';

describe('MarkdownToHtmlComponent', () => {
  let component: MarkdownToHtmlComponent;
  let fixture: ComponentFixture<MarkdownToHtmlComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MarkdownToHtmlComponent],
      providers: converterTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(MarkdownToHtmlComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
