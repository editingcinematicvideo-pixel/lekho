import test from 'node:test';
import assert from 'node:assert/strict';
import { dbService } from './db';

test('Galleria Sports BD store settings update and retrieval', () => {
  const shopId = 'shop_galleria_sports';
  const tenant = dbService.getTenantById(shopId);
  assert.ok(tenant, 'Galleria Sports BD tenant should exist');
  assert.equal(tenant.name, 'Galleria Sports BD');

  // Update store profile & payment channels
  dbService.updateTenant(shopId, {
    bengaliName: 'গ্যালারিয়া স্পোর্টস বিডি',
    shopNo: 'Shop #302, Level 3',
    paymentSettings: {
      bkashMerchant: '01711223344',
      bkashPersonal: '01799887766',
      nagad: '01811223344',
      bankName: 'The City Bank Ltd.',
      bankAccountNo: '1502938471001',
      autoPrintReceipt: true,
      paperWidth: '80mm',
    },
  });

  const updated = dbService.getTenantById(shopId);
  assert.equal(updated?.bengaliName, 'গ্যালারিয়া স্পোর্টস বিডি');
  assert.equal(updated?.paymentSettings?.bkashMerchant, '01711223344');
  assert.equal(updated?.paymentSettings?.paperWidth, '80mm');
});

test('MultiDrawer transfer funds updates balances correctly', () => {
  const shopId = 'shop_galleria_sports';
  const drawersBefore = dbService.getShopDrawers(shopId);

  // Transfer 1000 from cash to personalBkash if sufficient
  if (drawersBefore.cash >= 1000) {
    dbService.transferDrawerFunds(shopId, 'cash', 'personalBkash', 1000, 'Test Vault Rebalance');
    const drawersAfter = dbService.getShopDrawers(shopId);
    assert.equal(drawersAfter.cash, drawersBefore.cash - 1000);
    assert.equal(drawersAfter.personalBkash, drawersBefore.personalBkash + 1000);
  }
});

test('Owner withdraw requires valid secret password', () => {
  const shopId = 'shop_galleria_sports';
  const owners = dbService.getShopOwners(shopId);
  assert.ok(owners.length >= 1, 'Store should have owners');
  const owner = owners[0];

  // Try with wrong password
  const failedRes = dbService.recordOwnerWithdrawDeposit(shopId, {
    ownerId: owner.id,
    password: 'wrong_password_999',
    action: 'withdraw',
    amount: 100,
    drawer: 'cash',
    note: 'Unauthorized test attempt',
  });
  assert.equal(failedRes.success, false, 'Should fail with incorrect password');

  // Try with valid password (default seed owner password is '123'; owner.password is sanitized for security)
  const successRes = dbService.recordOwnerWithdrawDeposit(shopId, {
    ownerId: owner.id,
    password: '123',
    action: 'deposit',
    amount: 500,
    drawer: 'cash',
    note: 'Capital infusion test',
  });
  assert.equal(successRes.success, true, 'Should succeed with valid password');
  assert.ok(successRes.record, 'Record should be generated');
});

test('Kit Categories & Other Categories custom configuration and retrieval', () => {
  const shopId = 'shop_galleria_sports';
  const initialKits = dbService.getKitCategories(shopId);
  assert.ok(initialKits.length > 0, 'Should load default kit categories');

  // Add custom kit category with buying price
  const testCat = {
    id: 'test_kit_fan_version',
    name: 'Retro Player Authentic 2026',
    defaultMrp: 1800,
    defaultCostPrice: 950,
    defaultBottomPrice: 1500,
  };
  dbService.saveKitCategories(shopId, [...initialKits, testCat]);

  const loadedKits = dbService.getKitCategories(shopId);
  const found = loadedKits.find((c) => c.id === 'test_kit_fan_version');
  assert.ok(found, 'Added kit category should persist');
  assert.equal(found?.defaultCostPrice, 950);
  assert.equal(found?.defaultMrp, 1800);
});

test('Standalone Font Orders addition, quantity and status workflow', () => {
  const shopId = 'shop_galleria_sports';
  const newOrder = {
    id: `font_test_${Date.now()}`,
    shopId,
    teamOrKit: 'Brasil Home 2026',
    colorOrVersion: 'Green',
    customName: 'NEYMAR JR',
    customNumber: '10',
    quantity: 12,
    fontStyle: 'Official Cut Vinyl',
    unitPrice: 200,
    unitCostPrice: 80,
    status: 'pending' as const,
    customerName: 'Counter Bulk Stock',
    createdAt: new Date().toISOString(),
  };

  dbService.addFontOrder(shopId, newOrder);
  const orders = dbService.getFontOrders(shopId);
  const saved = orders.find((o) => o.id === newOrder.id);
  assert.ok(saved, 'Saved font order should exist');
  assert.equal(saved?.customName, 'NEYMAR JR');
  assert.equal(saved?.quantity, 12);

  // Update status
  dbService.updateFontOrderStatus(shopId, newOrder.id, 'printed');
  const updatedOrders = dbService.getFontOrders(shopId);
  const updated = updatedOrders.find((o) => o.id === newOrder.id);
  assert.equal(updated?.status, 'printed');
});

test('Invoice Due payment recalculates due and logs recovery in drawer', () => {
  const shopId = 'shop_galleria_sports';
  const invoices = dbService.getInvoices(shopId);
  const dueInvoice = invoices.find((inv) => (inv.dueAmount || 0) > 0);

  if (dueInvoice) {
    const originalDue = dueInvoice.dueAmount;
    const partialPay = Math.min(200, originalDue);

    const res = dbService.payInvoiceDue(shopId, dueInvoice.id, partialPay, 'cash', 'Unit Tester');
    assert.equal(res.success, true);
    assert.equal(res.invoice?.dueAmount, originalDue - partialPay);
  }
});
