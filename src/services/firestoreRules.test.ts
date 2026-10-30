import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
const authServicePath = path.resolve(process.cwd(), 'src/services/authService.ts');
const appContextPath = path.resolve(process.cwd(), 'src/context/AppContext.tsx');
const serverPath = path.resolve(process.cwd(), 'server.ts');
const blueprintPath = path.resolve(process.cwd(), 'firebase-blueprint.json');

test('firestore.rules enforces global default deny and authentication check', () => {
  const rules = fs.readFileSync(rulesPath, 'utf-8');
  assert.ok(rules.includes("rules_version = '2';"), 'Must use rules_version 2');
  assert.ok(rules.includes('allow read, write: if false;'), 'Must include global default deny');
  assert.ok(rules.includes('return request.auth != null;'), 'Must verify request.auth != null');
});

test('firestore.rules verifies Super Admin via console-only /platform_admins/{uid}, never client email matching', () => {
  const rules = fs.readFileSync(rulesPath, 'utf-8');
  assert.ok(
    rules.includes('exists(/databases/$(database)/documents/platform_admins/$(request.auth.uid))'),
    'Super Admin must be checked against /platform_admins/{uid}'
  );
  assert.ok(
    rules.includes('match /platform_admins/{adminUid}') && rules.includes('allow create, update, delete: if false;'),
    '/platform_admins must forbid all client writes'
  );
  assert.equal(
    rules.includes('editingvideo.3210@gmail.com'),
    false,
    'firestore.rules must not grant Super Admin by hardcoded email matching'
  );
});

test('firestore.rules prevents privilege escalation on /users/{userId} and /shops/{shopId} including subscription expiry & invited staff self-link', () => {
  const rules = fs.readFileSync(rulesPath, 'utf-8');
  // User cannot self-assign super_admin
  assert.ok(
    rules.includes("data.role in ['shop_owner', 'manager', 'salesman']"),
    'User creation must restrict role to shop_owner, manager, or salesman'
  );
  // User cannot mutate role or shopId on update
  assert.ok(
    rules.includes('newData.role == oldData.role') && rules.includes('newData.shopId == oldData.shopId'),
    'User self-update must lock role and shopId'
  );
  // Shop owner cannot mutate ownerUid, category, or self-approve subscription plan/expiry/grace
  assert.ok(
    rules.includes('newData.ownerUid == oldData.ownerUid') &&
      rules.includes('newData.category == oldData.category') &&
      rules.includes('newData.subscription.plan == oldData.subscription.plan') &&
      rules.includes('newData.subscription.expiresAt == oldData.subscription.expiresAt') &&
      rules.includes('newData.subscription.graceEndsAt == oldData.subscription.graceEndsAt'),
    'Shop owner update must lock ownerUid, category, subscription.plan, subscription.expiresAt, and subscription.graceEndsAt'
  );
  // Invited staff self-link can ONLY modify memberUids and memberRoles
  assert.ok(
    rules.includes("newData.diff(oldData).affectedKeys().hasOnly(['memberUids', 'memberRoles'])"),
    'Invited staff self-link must only affect memberUids and memberRoles'
  );
});

test('firestore.rules isolates all shop subcollections and restricts salesman writes on /products, /drawers, and /data', () => {
  const rules = fs.readFileSync(rulesPath, 'utf-8');
  const requiredSubcollections = [
    'match /products/{productId}',
    'match /invoices/{invoiceId}',
    'match /expenses/{expenseId}',
    'match /drawers/{drawerDocId}',
    'match /staff/{staffId}',
    'match /resellers/{resellerId}',
    'match /orders/{orderId}',
    'match /data/{docId}',
  ];

  for (const sub of requiredSubcollections) {
    assert.ok(rules.includes(sub), `firestore.rules must protect subcollection: ${sub}`);
  }

  // Salesman cannot modify cost price or bottom price on products
  assert.ok(
    rules.includes('request.resource.data.lotCostLandingPrice == resource.data.lotCostLandingPrice') &&
      rules.includes('request.resource.data.bottomPrice == resource.data.bottomPrice'),
    'Salesman product stock updates must lock lotCostLandingPrice and bottomPrice'
  );

  // Salesman cannot overwrite sensitive auxiliary documents in /data/{docId}
  assert.ok(
    rules.includes("!(docId in ['owners', 'owner_txs', 'z_reports', 'monthly_audits', 'trash', 'store_config'") &&
      rules.includes('audit_logs'),
    'Salesman must be blocked from writing owners, owner_txs, z_reports, monthly_audits, trash, store_config, or audit_logs'
  );
});

test('authService.ts, AppContext.tsx, and server.ts enforce backend OTP verification, Firebase Auth source of truth, and zero PIN backdoors', () => {
  const authCode = fs.readFileSync(authServicePath, 'utf-8');
  const contextCode = fs.readFileSync(appContextPath, 'utf-8');
  const serverCode = fs.readFileSync(serverPath, 'utf-8');

  assert.equal(authCode.includes("=== '1234'"), false, '1234 backdoor must be removed from authService');
  assert.equal(authCode.includes("=== '5555'"), false, '5555 backdoor must be removed from authService');
  assert.equal(authCode.includes("=== '2222'"), false, '2222 backdoor must be removed from authService');
  assert.equal(authCode.includes('.phone.slice(-4)'), false, 'phone.slice(-4) PIN backdoor must be removed from authService');
  assert.equal(contextCode.includes("=== '9999'"), false, '9999 super_admin PIN backdoor must be removed from AppContext');
  assert.equal(contextCode.includes('.phone.slice(-4)'), false, 'phone.slice(-4) PIN backdoor must be removed from AppContext');

  // AppContext clears localStorage session when !firebaseUser
  assert.ok(
    contextCode.includes('setIsAuthenticatedState(false)'),
    'AppContext must set isAuthenticated to false when firebaseUser is null'
  );
  // AppContext blocks staff account from escalating to shop_owner via PIN
  assert.ok(
    contextCode.includes('if (isStaffAccountSession)'),
    'AppContext loginWithPin must block staff accounts from escalating to shop_owner'
  );

  // Server generates & verifies OTP via OtpServerEngine and reports SMTP_NOT_CONFIGURED honestly
  assert.ok(serverCode.includes("app.post('/api/auth/otp/request'"), 'Server must expose /api/auth/otp/request');
  assert.ok(serverCode.includes("app.post('/api/auth/otp/verify'"), 'Server must expose /api/auth/otp/verify');
  assert.ok(serverCode.includes('SMTP_NOT_CONFIGURED'), 'Server must report SMTP_NOT_CONFIGURED when SMTP env vars are missing');
});

test('firebase-blueprint.json defines valid multi-tenant schema entities', () => {
  const blueprint = JSON.parse(fs.readFileSync(blueprintPath, 'utf-8'));
  assert.ok(blueprint.entities.PlatformAdmin, 'PlatformAdmin entity must exist');
  assert.ok(blueprint.entities.UserProfile, 'UserProfile entity must exist');
  assert.ok(blueprint.entities.TenantShop, 'TenantShop entity must exist');
  assert.ok(blueprint.firestore['/shops/{shopId}/products/{productId}'], 'Shop products path must exist');
});
