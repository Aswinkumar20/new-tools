import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '@tools-workspace/features-home';
import { fileViewerTestProviders } from '../../shared/file-viewer-test.utils';
import { InvoiceDataViewerComponent } from './invoice-data-viewer';

describe('InvoiceDataViewerComponent', () => {
  let component: InvoiceDataViewerComponent;
  let fixture: ComponentFixture<InvoiceDataViewerComponent>;
  let toast: { info: jest.Mock; error: jest.Mock; success: jest.Mock };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InvoiceDataViewerComponent],
      providers: [...fileViewerTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(InvoiceDataViewerComponent);
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
    expect(component.invoice).toBeNull();
    expect(component.primarySuggestion?.id).toBe('inv-excel');
    expect(component.relatedTools.length).toBeGreaterThan(0);
    expect(component.formatsLabel).toContain('JSON');
  });

  it('dismisses contextual suggestions', () => {
    const suggestion = component.primarySuggestion;
    expect(suggestion?.id).toBe('inv-excel');
    if (suggestion) {
      component.dismissSuggestion(suggestion.id);
      expect(component.primarySuggestion).toBeNull();
    }
  });

  it('loads JSON invoice with line items and totals', async () => {
    const json = JSON.stringify({
      invoice_number: 'INV-100',
      issue_date: '2024-03-01',
      due_date: '2024-03-15',
      vendor: { name: 'Acme Corp' },
      customer: { name: 'Beta LLC' },
      currency: 'USD',
      subtotal: 100,
      tax: 10,
      total: 110,
      line_items: [
        { description: 'Widget', quantity: 2, unit_price: 50, amount: 100 }
      ]
    });

    const file = new File([json], 'invoice.json', { type: 'application/json' });
    Object.defineProperty(file, 'text', { value: async () => json });

    await component.handleFiles([file]);

    expect(component.invoice?.invoiceNumber).toBe('INV-100');
    expect(component.lineItemCount).toBe(1);
    expect(component.invoice?.vendor).toBe('Acme Corp');
    expect(component.invoice?.total).toBe(110);
    expect(component.headerFields.length).toBe(6);
    expect(toast.success).toHaveBeenCalled();
  });

  it('loads XML invoice data', async () => {
    const xml = `
      <invoice>
        <invoiceNumber>XML-1</invoiceNumber>
        <vendor>Vendor Co</vendor>
        <customer>Client Co</customer>
        <currency>USD</currency>
        <subtotal>20</subtotal>
        <tax>2</tax>
        <total>22</total>
        <line>
          <description>Service</description>
          <quantity>1</quantity>
          <unitprice>20</unitprice>
          <amount>20</amount>
        </line>
      </invoice>`;

    const file = new File([xml], 'invoice.xml', { type: 'text/xml' });
    Object.defineProperty(file, 'text', { value: async () => xml });

    await component.handleFiles([file]);

    expect(component.invoice?.invoiceNumber).toBe('XML-1');
    expect(component.lineItemCount).toBe(1);
    expect(component.invoice?.total).toBe(22);
  });
});
