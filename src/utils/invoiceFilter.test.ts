import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { filterInvoicesList } from '../components/invoices/InvoiceLedgerView';
import { Invoice } from '../types';

const sampleInvoices: Invoice[] = [
  {
    id: 'inv-1',
    invoiceNo: 'VG-2026-0412',
    shopId: 'shop-1',
    salesmanId: 'st-1',
    salesmanName: 'Rakib',
    customerName: 'Shahidul Alam',
    customerPhone: '01711223344',
    items: [
      {
        id: 'it-1',
        itemType: 'apparel',
        title: 'Basic T-Shirt',
        subDetail: 'Black',
        size: 'L',
        quantity: 1,
        rate: 1550,
        costPrice: 900,
        bottomPrice: 1200,
        subtotal: 1550,
      },
    ],
    subtotal: 1550,
    discount: 0,
    total: 1550,
    advancePaid: 1550,
    paidAmount: 1550,
    dueAmount: 0,
    paymentMode: 'paid',
    paymentMethod: 'cash',
    paymentChannel: 'cash',
    status: 'completed',
    createdAt: '2026-10-18T10:30:00.000Z',
  },
  {
    id: 'inv-2',
    invoiceNo: 'VG-2026-0413',
    shopId: 'shop-1',
    salesmanId: 'st-1',
    salesmanName: 'Rakib',
    customerName: 'Walk-in Customer',
    customerPhone: '01899887766',
    items: [
      {
        id: 'it-2',
        itemType: 'apparel',
        title: 'Formal Shirt',
        subDetail: 'Blue',
        size: 'M',
        quantity: 2,
        rate: 850,
        costPrice: 500,
        bottomPrice: 700,
        subtotal: 1700,
      },
    ],
    subtotal: 1700,
    discount: 0,
    total: 1700,
    advancePaid: 1000,
    paidAmount: 1000,
    dueAmount: 700,
    paymentMode: 'partial',
    paymentMethod: 'bkash',
    paymentChannel: 'merchantBkash',
    status: 'partial_due',
    createdAt: '2026-10-20T18:45:00.000Z',
  },
  {
    id: 'inv-3',
    invoiceNo: 'VG-2026-0414',
    shopId: 'shop-1',
    salesmanId: 'st-1',
    salesmanName: 'Rakib',
    customerName: 'Tanvir Hasan',
    customerPhone: '01911002200',
    items: [
      {
        id: 'it-3',
        itemType: 'apparel',
        title: 'Panjabi',
        subDetail: 'Beige',
        size: 'XL',
        quantity: 1,
        rate: 1250,
        costPrice: 800,
        bottomPrice: 1000,
        subtotal: 1250,
      },
    ],
    subtotal: 1250,
    discount: 0,
    total: 1250,
    advancePaid: 1250,
    paidAmount: 1250,
    dueAmount: 0,
    paymentMode: 'paid',
    paymentMethod: 'nagad',
    paymentChannel: 'nagad',
    status: 'completed',
    createdAt: '2026-10-25T21:15:00.000Z',
  },
];

describe('filterInvoicesList', () => {
  it('filters inclusively by custom From and To dates', () => {
    const res = filterInvoicesList(sampleInvoices, {
      searchQuery: '',
      channelFilter: 'all',
      statusFilter: 'all',
      dateRange: 'custom',
      fromDate: '2026-10-18',
      toDate: '2026-10-20',
    });
    assert.equal(res.length, 2);
    assert.deepEqual(res.map((r) => r.invoiceNo), ['VG-2026-0412', 'VG-2026-0413']);
  });

  it('includes records occurring on the selected To date boundary', () => {
    const res = filterInvoicesList(sampleInvoices, {
      searchQuery: '',
      channelFilter: 'all',
      statusFilter: 'all',
      dateRange: 'custom',
      fromDate: '2026-10-25',
      toDate: '2026-10-25',
    });
    assert.equal(res.length, 1);
    assert.equal(res[0].invoiceNo, 'VG-2026-0414');
  });

  it('combines search query with date range and status filters', () => {
    const res = filterInvoicesList(sampleInvoices, {
      searchQuery: 'Walk-in',
      channelFilter: 'merchantBkash',
      statusFilter: 'partial',
      dateRange: 'custom',
      fromDate: '2026-10-01',
      toDate: '2026-10-31',
    });
    assert.equal(res.length, 1);
    assert.equal(res[0].invoiceNo, 'VG-2026-0413');
  });
});
