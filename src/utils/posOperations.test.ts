import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateSplitTotal,
  validateSplitPayment,
  autoFillSplitMethod,
  getActiveSplitEntries,
  formatSplitSummaryText,
  matchesDtfSearch,
  formatDailyClosingWhatsAppMemo,
  buildWhatsAppUrl,
  SplitPaymentBreakdown,
  BottomPriceOverrideMap,
  isItemBottomPriceSatisfied,
  findFirstBottomPriceViolation,
  authorizeBottomPriceOverride,
  pruneBottomPriceOverridesForCart,
  hasAnyBottomPriceOverrideUsed,
} from './posOperations';

describe('Multi-Method Split Payment Logic', () => {
  it('calculates total across Cash, bKash Merchant, bKash Personal, Nagad, and Bank/Card', () => {
    const split: SplitPaymentBreakdown = {
      cash: 200,
      merchantBkash: 300,
      personalBkash: 0,
      nagad: 500,
      bank: 200,
    };
    assert.equal(calculateSplitTotal(split), 1200);
  });

  it('validates that split amounts equal the target bill or advance amount', () => {
    const split: SplitPaymentBreakdown = {
      cash: 200,
      merchantBkash: 300,
      personalBkash: 0,
      nagad: 500,
      bank: 200,
    };

    const exactCheck = validateSplitPayment(split, 1200);
    assert.equal(exactCheck.valid, true);
    assert.equal(exactCheck.remaining, 0);
    assert.equal(exactCheck.activeMethodsCount, 4);

    const shortCheck = validateSplitPayment(split, 1500);
    assert.equal(shortCheck.valid, false);
    assert.equal(shortCheck.remaining, 300);

    const overCheck = validateSplitPayment(split, 1000);
    assert.equal(overCheck.valid, false);
    assert.equal(overCheck.remaining, -200);
  });

  it('supports partial advance split validation when advance is less than full bill', () => {
    const advanceSplit: SplitPaymentBreakdown = {
      cash: 300,
      merchantBkash: 0,
      personalBkash: 200,
      nagad: 0,
      bank: 0,
    };
    const res = validateSplitPayment(advanceSplit, 500);
    assert.equal(res.valid, true);
    assert.equal(res.totalEntered, 500);
    assert.equal(
      formatSplitSummaryText(advanceSplit),
      'Cash: ৳300 + bKash Personal: ৳200'
    );
  });

  it('auto-fills the remaining balance into a chosen payment method', () => {
    const initial: SplitPaymentBreakdown = {
      cash: 200,
      merchantBkash: 300,
      personalBkash: 0,
      nagad: 500,
      bank: 0,
    };
    const filled = autoFillSplitMethod(initial, 'bank', 1200);
    assert.equal(filled.bank, 200);
    assert.equal(calculateSplitTotal(filled), 1200);
  });

  it('returns only non-zero payment methods in getActiveSplitEntries', () => {
    const split: SplitPaymentBreakdown = {
      cash: 200,
      merchantBkash: 300,
      personalBkash: 0,
      nagad: 500,
      bank: 200,
    };
    const active = getActiveSplitEntries(split);
    assert.equal(active.length, 4);
    assert.deepEqual(
      active.map((a) => a.label),
      ['Cash', 'bKash Merchant', 'Nagad', 'Bank/Card']
    );
  });
});

describe('DTF Hub Search Filter', () => {
  it('matches by player name, number, kit, invoiceNo, customer name, or size', () => {
    const entry = {
      lineFormatted: 'argentina 2006 home white shawon 19',
      customName: 'SHAWON',
      customNumber: '19',
      fontStyle: '2006 Home White',
      size: 'XL',
      kitTitle: 'Argentina 2006 Home White Kit',
      invoiceNo: 'GS-2026-0893',
      customerName: 'Shawon Hossain',
      customerPhone: '01711223344',
    };

    assert.equal(matchesDtfSearch(entry, 'shawon'), true);
    assert.equal(matchesDtfSearch(entry, '19'), true);
    assert.equal(matchesDtfSearch(entry, 'argentina'), true);
    assert.equal(matchesDtfSearch(entry, '0893'), true);
    assert.equal(matchesDtfSearch(entry, 'XL'), true);
    assert.equal(matchesDtfSearch(entry, 'bellingham'), false);
  });
});

describe('Daily Closing Z-Report WhatsApp Memo Formatter', () => {
  it('generates a complete text memo and valid wa.me URL', () => {
    const memo = formatDailyClosingWhatsAppMemo({
      shopName: 'Galleria Sports BD',
      marketMallName: 'Jamuna Future Park',
      shopNo: 'Shop #302',
      dateStr: '2026-10-24',
      operatorName: 'Mahmudul Hasan',
      totalSalesVolume: 12500,
      totalInvoicesCount: 8,
      retailSalesVolume: 8500,
      retailCount: 6,
      resellerSalesVolume: 4000,
      resellerCount: 2,
      totalExpenses: 500,
      creditGiven: 1000,
      wallets: {
        cash: { expected: 4000, counted: 4000 },
        merchantBkash: { expected: 3000, counted: 3000 },
        personalBkash: { expected: 1500, counted: 1500 },
        nagad: { expected: 1000, counted: 1000 },
        bank: { expected: 1500, counted: 1500 },
      },
      discrepancy: 0,
      notes: 'All balanced',
    });

    assert.ok(memo.includes('Galleria Sports BD'));
    assert.ok(memo.includes('৳12,500'));
    assert.ok(memo.includes('bKash Merchant'));
    assert.ok(memo.includes('All balanced'));

    const url = buildWhatsAppUrl('01711223344', memo);
    assert.ok(url.startsWith('https://wa.me/8801711223344?text='));
  });
});

describe('Task 2: Bottom Price Override One-Sale Authorization & Invalidation', () => {
  it('blocks below-floor items until Owner PIN authorizes that exact item & rate, and invalidates if rate is lowered further or cart resets', () => {
    const item1 = {
      id: 'line_1',
      productId: 'prod_shirt_1',
      title: 'Men Casual Oxford Shirt',
      rate: 950,
      bottomPrice: 1050,
    };
    const item2 = {
      id: 'line_2',
      productId: 'prod_jeans_1',
      title: 'Slim Fit Jeans',
      rate: 1650,
      bottomPrice: 1350,
    };

    let overrides: BottomPriceOverrideMap = {};

    // Initially, item1 violates bottomPrice (950 < 1050)
    const firstViolation = findFirstBottomPriceViolation([item1, item2], overrides);
    assert.equal(firstViolation?.item.id, 'line_1');
    assert.equal(firstViolation?.bottomPrice, 1050);
    assert.equal(isItemBottomPriceSatisfied(item1, overrides), false);

    // Owner PIN authorizes item1 at ৳950
    overrides = authorizeBottomPriceOverride(overrides, item1);
    assert.equal(isItemBottomPriceSatisfied(item1, overrides), true);
    assert.equal(findFirstBottomPriceViolation([item1, item2], overrides), null);
    assert.equal(hasAnyBottomPriceOverrideUsed([item1, item2], overrides), true);

    // If salesman lowers item1 rate even further (e.g. 950 -> 850), override is automatically invalidated!
    const loweredFurtherItem1 = { ...item1, rate: 850 };
    overrides = pruneBottomPriceOverridesForCart(overrides, [loweredFurtherItem1, item2]);
    assert.equal(isItemBottomPriceSatisfied(loweredFurtherItem1, overrides), false);
    assert.equal(findFirstBottomPriceViolation([loweredFurtherItem1, item2], overrides)?.item.id, 'line_1');

    // If cart is cleared after sale completes, overrides are pruned to empty
    overrides = pruneBottomPriceOverridesForCart(overrides, []);
    assert.deepEqual(overrides, {});
  });
});

