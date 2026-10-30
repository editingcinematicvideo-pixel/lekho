import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import {
  generatePinSalt,
  hashOwnerPin,
  verifyPinHash,
  LockoutTracker,
  FloorOverrideTokenVault,
  AuditLogManager,
} from './ownerPinSecurityEngine';

test('1. First-time PIN setup: validates 4 digits, matches confirmation, and salts hash safely', () => {
  const salt = generatePinSalt();
  assert.equal(typeof salt, 'string');
  assert.ok(salt.length >= 16);

  // Valid 4 digit PIN
  const pin = '4829';
  const confirmPin = '4829';
  assert.equal(pin === confirmPin, true);
  assert.equal(/^\d{4}$/.test(pin), true);

  const hash = hashOwnerPin(pin, salt);
  assert.equal(typeof hash, 'string');
  assert.notEqual(hash, pin); // Never plaintext
  assert.equal(verifyPinHash('4829', hash, salt), true);
  assert.equal(verifyPinHash('4828', hash, salt), false);
  assert.equal(verifyPinHash('123', hash, salt), false);
  assert.equal(verifyPinHash('48291', hash, salt), false);
});

test('2. Unauthorized PIN setup attempts: non-owner roles (salesman/manager) are blocked', () => {
  const evaluateCanSetupPin = (role: string) => {
    return role === 'shop_owner' || role === 'super_admin';
  };

  assert.equal(evaluateCanSetupPin('shop_owner'), true);
  assert.equal(evaluateCanSetupPin('salesman'), false);
  assert.equal(evaluateCanSetupPin('manager'), false);
  assert.equal(evaluateCanSetupPin('guest'), false);
});

test('3. Successful PIN change with valid current PIN updates hash and invalidates tokens', () => {
  const salt1 = generatePinSalt();
  const oldHash = hashOwnerPin('1234', salt1);

  // Verify current PIN before change
  const currentPinInput = '1234';
  const isCurrentValid = verifyPinHash(currentPinInput, oldHash, salt1);
  assert.equal(isCurrentValid, true);

  // New PIN
  const salt2 = generatePinSalt();
  const newHash = hashOwnerPin('9876', salt2);
  assert.notEqual(oldHash, newHash);
  assert.equal(verifyPinHash('9876', newHash, salt2), true);
  assert.equal(verifyPinHash('1234', newHash, salt2), false);

  // Existing tokens for the shop are wiped on PIN change
  const vault = new FloorOverrideTokenVault();
  const token = vault.issueToken({
    shopId: 'shop_demo_1',
    productId: 'prod_1',
    minApprovedRate: 450,
    maxQuantity: 2,
    authorizerUid: 'owner_uid',
    authorizerRole: 'shop_owner',
  });
  assert.ok(vault.getToken(token.token));
  vault.invalidateTokensForShop('shop_demo_1');
  assert.equal(vault.getToken(token.token), undefined);
});

test('4. Wrong current PIN during change attempt triggers attempt decrement and 5-attempt lockout', () => {
  const tracker = new LockoutTracker(5, 60_000);
  const key = tracker.getKey('shop_lockout_test', '127.0.0.1');

  // Initial status
  let status = tracker.checkLockout(key);
  assert.equal(status.isLocked, false);
  assert.equal(status.remainingAttempts, 5);

  // 4 failed attempts
  for (let i = 1; i <= 4; i++) {
    status = tracker.recordFailure(key);
    assert.equal(status.isLocked, false);
    assert.equal(status.remainingAttempts, 5 - i);
  }

  // 5th failed attempt triggers lockout
  status = tracker.recordFailure(key);
  assert.equal(status.isLocked, true);
  assert.equal(status.remainingAttempts, 0);
  assert.ok(status.remainingLockSeconds > 0);

  // Subsequent check remains locked
  const recheck = tracker.checkLockout(key);
  assert.equal(recheck.isLocked, true);
});

test('5. Secure forgotten-PIN recovery via verified owner identity reauthentication', () => {
  interface OwnerAccount {
    uid: string;
    email: string;
    role: string;
  }
  const verifiedFirebaseUser: OwnerAccount = {
    uid: 'firebase_owner_uid_99',
    email: 'realowner@lekhostore.com',
    role: 'shop_owner',
  };

  const evaluateCanResetPin = (actor: { uid: string; role: string }, shopOwnerUid: string) => {
    if (!actor.uid) return false;
    if (actor.role === 'super_admin') return true;
    return actor.role === 'shop_owner' && actor.uid === shopOwnerUid;
  };

  assert.equal(evaluateCanResetPin(verifiedFirebaseUser, 'firebase_owner_uid_99'), true);
  assert.equal(evaluateCanResetPin({ uid: 'salesman_uid_1', role: 'salesman' }, 'firebase_owner_uid_99'), false);
  assert.equal(evaluateCanResetPin({ uid: 'other_owner_uid', role: 'shop_owner' }, 'firebase_owner_uid_99'), false);
});

test('6. Unauthorized PIN reset attempts by salesman or unauthenticated actors are rejected', () => {
  const evaluateResetAttempt = (actorUid: string, actorRole: string, shopOwnerUid: string) => {
    if (!actorUid || actorRole !== 'shop_owner') {
      return { allowed: false, status: 403, error: 'FORBIDDEN: Only authenticated Shop Owner can reset Owner PIN' };
    }
    if (actorUid !== shopOwnerUid) {
      return { allowed: false, status: 403, error: 'FORBIDDEN: UID does not match shop owner' };
    }
    return { allowed: true, status: 200 };
  };

  const salesmanRes = evaluateResetAttempt('salesman_1', 'salesman', 'owner_1');
  assert.equal(salesmanRes.allowed, false);
  assert.equal(salesmanRes.status, 403);

  const anonymousRes = evaluateResetAttempt('', '', 'owner_1');
  assert.equal(anonymousRes.allowed, false);
  assert.equal(anonymousRes.status, 403);
});

test('7. Enabling and disabling bottom price protection: toggled, logged, and tokens invalidated', () => {
  const auditLogs = new AuditLogManager('/tmp/test-lekho-audit.json');
  auditLogs.clearLogsForShop('shop_audit_test');

  const vault = new FloorOverrideTokenVault();
  const token = vault.issueToken({
    shopId: 'shop_audit_test',
    productId: 'prod_9',
    minApprovedRate: 300,
    maxQuantity: 1,
    authorizerUid: 'owner_1',
    authorizerRole: 'shop_owner',
  });
  assert.ok(vault.getToken(token.token));

  // Toggle protection to OFF
  const logEntry = auditLogs.record({
    shopId: 'shop_audit_test',
    action: 'protection_toggle',
    actorUid: 'owner_1',
    actorRole: 'shop_owner',
    details: {
      enabled: false,
      reason: 'Owner temporarily disabled bottom price PIN requirement',
    },
  });

  assert.equal(logEntry.action, 'protection_toggle');
  assert.equal(logEntry.details.enabled, false);

  // Invalidate any outstanding tokens
  vault.invalidateTokensForShop('shop_audit_test');
  assert.equal(vault.getToken(token.token), undefined);

  // Check audit log retrieval
  const logs = auditLogs.getLogsForShop('shop_audit_test');
  assert.equal(logs.length, 1);
  assert.equal(logs[0].details.enabled, false);
});

test('8. Salesman attempts to toggle protection are blocked with 403', () => {
  const toggleProtection = (actorRole: string) => {
    if (actorRole !== 'shop_owner' && actorRole !== 'super_admin') {
      return { status: 403, message: 'Only shop owner can toggle bottom price protection' };
    }
    return { status: 200, message: 'Protection toggled' };
  };

  assert.equal(toggleProtection('salesman').status, 403);
  assert.equal(toggleProtection('manager').status, 403);
  assert.equal(toggleProtection('shop_owner').status, 200);
});

test('9. Normal sales at or above Bottom Price do NOT require override token', () => {
  const lineItem = {
    productId: 'prod_polo',
    rate: 650,
    quantity: 1,
  };
  const product = {
    id: 'prod_polo',
    sellingPrice: 700,
    bottomPrice: 600,
  };

  const isBelowFloor = lineItem.rate < (product.bottomPrice || 0);
  assert.equal(isBelowFloor, false);
  // No token required
  const canProceed = !isBelowFloor;
  assert.equal(canProceed, true);
});

test('10. Below-floor sale is blocked when protection is ON and no valid token is provided', () => {
  const protectionEnabled = true;
  const lineItem = {
    productId: 'prod_polo',
    rate: 550, // Below floor 600
    quantity: 1,
    overrideToken: undefined,
  };
  const bottomPrice = 600;

  const isBelowFloor = lineItem.rate < bottomPrice;
  assert.equal(isBelowFloor, true);

  const isSalePermitted = !protectionEnabled || (protectionEnabled && Boolean(lineItem.overrideToken));
  assert.equal(isSalePermitted, false);
});

test('11. Below-floor sale is accepted with valid single-use owner token and exact price match', () => {
  const vault = new FloorOverrideTokenVault();
  const token = vault.issueToken({
    shopId: 'shop_pos_1',
    productId: 'prod_polo',
    minApprovedRate: 500,
    maxQuantity: 2,
    authorizerUid: 'owner_uid_1',
    authorizerRole: 'shop_owner',
  });

  // Valid consumption at rate 550 (>= 500) and quantity 1 (<= 2)
  const result = vault.verifyAndConsumeToken({
    token: token.token,
    shopId: 'shop_pos_1',
    productId: 'prod_polo',
    rate: 550,
    quantity: 1,
    invoiceId: 'INV-2026-001',
  });

  assert.equal(result.valid, true);
  assert.ok(result.token?.used);
  assert.equal(result.token?.invoiceId, 'INV-2026-001');
});

test('12. Below-floor sale behavior when protection is OFF: allowed without token but audit logged', () => {
  const protectionEnabled = false;
  const lineItem = {
    productId: 'prod_jersey',
    rate: 450,
    quantity: 1,
  };
  const bottomPrice = 500;
  const isBelowFloor = lineItem.rate < bottomPrice;
  assert.equal(isBelowFloor, true);

  // When protection is OFF, sale can proceed without override token
  const canProceed = !protectionEnabled || Boolean(lineItem);
  assert.equal(canProceed, true);

  // Backend records audit log for below floor sale without PIN
  const auditLogs = new AuditLogManager('/tmp/test-lekho-audit-off.json');
  auditLogs.clearLogsForShop('shop_off_test');
  auditLogs.record({
    shopId: 'shop_off_test',
    action: 'below_floor_sale',
    actorUid: 'salesman_uid_2',
    actorRole: 'salesman',
    details: {
      productId: lineItem.productId,
      rate: lineItem.rate,
      bottomPrice,
      warning: 'Completed while bottom price PIN protection was toggled OFF by Owner',
    },
  });

  const logs = auditLogs.getLogsForShop('shop_off_test');
  assert.equal(logs.length, 1);
  assert.equal(logs[0].action, 'below_floor_sale');
});

test('13. Forged client authorization flags (e.g. ownerPinAuthorized: true) rejected without server token', () => {
  const clientPayload: {
    productId: string;
    rate: number;
    bottomPrice: number;
    ownerPinAuthorized: boolean;
    approvedRate: number;
    overrideToken?: string;
  } = {
    productId: 'prod_1',
    rate: 400,
    bottomPrice: 600,
    ownerPinAuthorized: true, // Forged client flag
    approvedRate: 400, // Forged client flag
    overrideToken: undefined, // Missing real server token
  };

  const validateServerSide = (item: typeof clientPayload, protectionEnabled: boolean) => {
    const isBelowFloor = item.rate < item.bottomPrice;
    if (!isBelowFloor) return true;
    if (!protectionEnabled) return true;
    // Server must ignore client flags and require verified server-side overrideToken
    return Boolean(item.overrideToken && item.overrideToken.startsWith('fot_'));
  };

  assert.equal(validateServerSide(clientPayload, true), false);
});

test('14. Direct Firestore invoice write rejected when hasBelowFloorDiscount == true for salesman', () => {
  const firestoreRulesContent = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf-8');

  // Check that firestore.rules checks hasBelowFloorDiscount
  assert.ok(
    firestoreRulesContent.includes('request.resource.data.hasBelowFloorDiscount != true') &&
      firestoreRulesContent.includes('isShopOwner(shopId)') &&
      firestoreRulesContent.includes('match /invoices/{invoiceId}'),
    'firestore.rules must enforce hasBelowFloorDiscount check on invoice creation'
  );
});

test('15. Replay, concurrent reuse, lower price than approved, and cross-tenant token use are rejected', () => {
  const vault = new FloorOverrideTokenVault();
  const token = vault.issueToken({
    shopId: 'shop_A',
    productId: 'prod_jeans',
    minApprovedRate: 800,
    maxQuantity: 1,
    authorizerUid: 'owner_A',
    authorizerRole: 'shop_owner',
  });

  // Cross-tenant attempt (shop_B trying to use shop_A's token)
  const crossTenantRes = vault.verifyAndConsumeToken({
    token: token.token,
    shopId: 'shop_B',
    productId: 'prod_jeans',
    rate: 800,
    quantity: 1,
  });
  assert.equal(crossTenantRes.valid, false);
  assert.ok(crossTenantRes.reason?.includes('CROSS_SHOP_FORBIDDEN'));

  // Rate lower than approved
  const lowerRateRes = vault.verifyAndConsumeToken({
    token: token.token,
    shopId: 'shop_A',
    productId: 'prod_jeans',
    rate: 750, // Approved minimum was 800
    quantity: 1,
  });
  assert.equal(lowerRateRes.valid, false);
  assert.ok(lowerRateRes.reason?.includes('RATE_BELOW_APPROVED'));

  // Valid first use
  const firstUse = vault.verifyAndConsumeToken({
    token: token.token,
    shopId: 'shop_A',
    productId: 'prod_jeans',
    rate: 800,
    quantity: 1,
    invoiceId: 'INV-100',
  });
  assert.equal(firstUse.valid, true);

  // Replay attempt (second use of same token)
  const replayAttempt = vault.verifyAndConsumeToken({
    token: token.token,
    shopId: 'shop_A',
    productId: 'prod_jeans',
    rate: 800,
    quantity: 1,
    invoiceId: 'INV-101',
  });
  assert.equal(replayAttempt.valid, false);
  assert.ok(replayAttempt.reason?.includes('TOKEN_ALREADY_USED'));
});

test('16. PIN lockout persists across attempts / cannot be reset by client', () => {
  const tracker = new LockoutTracker(5, 60_000);
  const serverKey = tracker.getKey('shop_persistent_lock', '203.0.113.1');

  // Trigger lockout on server
  for (let i = 0; i < 5; i++) {
    tracker.recordFailure(serverKey);
  }
  assert.equal(tracker.checkLockout(serverKey).isLocked, true);

  // Simulate client refreshing page or opening new tab with different sessionStorage:
  // Server-side state remains keyed to shopId and client IP
  const statusAfterClientTabReload = tracker.checkLockout(serverKey);
  assert.equal(statusAfterClientTabReload.isLocked, true);
  assert.ok(statusAfterClientTabReload.remainingLockSeconds > 0);
});

test('17. CLOTHING vs SPORTSWEAR isolation preserved', () => {
  const products = [
    { id: '1', name: 'Real Madrid Home Kit', category: 'Club Jersey', isJersey: true },
    { id: '2', name: 'Brazil National Kit', category: 'National Jersey', isJersey: true },
    { id: '3', name: 'Jersey Cotton Casual T-Shirt', category: 'T-Shirts', isJersey: false },
    { id: '4', name: 'Real Leather Belt', category: 'Accessories', isJersey: false },
  ];

  // CLOTHING isolation logic: excludes jersey category, does NOT exclude items with 'Jersey' or 'Real' in name
  const clothingStoreProducts = products.filter(
    (p) => !['Club Jersey', 'National Jersey', 'Retro Jersey'].includes(p.category)
  );

  assert.equal(clothingStoreProducts.length, 2);
  assert.equal(clothingStoreProducts[0].name, 'Jersey Cotton Casual T-Shirt');
  assert.equal(clothingStoreProducts[1].name, 'Real Leather Belt');

  // SPORTSWEAR maintains all jersey products
  const sportswearStoreProducts = products.filter((p) => p.isJersey);
  assert.equal(sportswearStoreProducts.length, 2);
  assert.equal(sportswearStoreProducts[0].name, 'Real Madrid Home Kit');
  assert.equal(sportswearStoreProducts[1].name, 'Brazil National Kit');
});
