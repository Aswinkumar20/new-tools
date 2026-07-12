import { ComponentFixture, TestBed } from '@angular/core/testing';
import { cftToolTestProviders } from '../../shared/cft-tool-test.utils';
import { MarkdownToPdfComponent } from './markdown-to-pdf';

describe('MarkdownToPdfComponent', () => {
  let component: MarkdownToPdfComponent;
  let fixture: ComponentFixture<MarkdownToPdfComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MarkdownToPdfComponent],
      providers: cftToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(MarkdownToPdfComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
