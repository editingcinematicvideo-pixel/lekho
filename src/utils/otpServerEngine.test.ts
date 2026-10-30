import test from 'node:test';
import assert from 'node:assert/strict';
import { OtpServerEngine } from './otpServerEngine';

test('OtpServerEngine generates 6-digit OTP, verifies within 5 minutes, and issues a single-use verification token', () => {
  const engine = new OtpServerEngine({ secret: 'test_hmac_secret_123' });
  const now = 1_700_000_000_000;

  const created = engine.createOtp('merchant@gmail.com', 'merchant_registration', '127.0.0.1', now);
  assert.equal(created.success, true);
  assert.ok(created.otp && /^\d{6}$/.test(created.otp), 'OTP must be 6 digits');

  // Verify with correct OTP after 2 minutes
  const verified = engine.verifyOtp('merchant@gmail.com', 'merchant_registration', created.otp!, now + 2 * 60 * 1000);
  assert.equal(verified.success, true);
  assert.ok(verified.verificationToken, 'Verification must return a signed token');

  // Re-using the same OTP must fail (already consumed)
  const reuseOtp = engine.verifyOtp('merchant@gmail.com', 'merchant_registration', created.otp!, now + 2 * 60 * 1000);
  assert.equal(reuseOtp.success, false);
  assert.equal(reuseOtp.errorCode, 'NOT_FOUND');

  // Consuming the verification token succeeds once and fails on replay
  assert.equal(
    engine.consumeVerificationToken('merchant@gmail.com', 'merchant_registration', verified.verificationToken!, now + 2 * 60 * 1000),
    true
  );
  assert.equal(
    engine.consumeVerificationToken('merchant@gmail.com', 'merchant_registration', verified.verificationToken!, now + 2 * 60 * 1000),
    false
  );
});

test('OtpServerEngine enforces 5-minute expiry and 60-second resend cooldown, and invalidates previous OTP on resend', () => {
  const engine = new OtpServerEngine({ secret: 'test_hmac_secret_123' });
  const now = 1_700_000_000_000;

  const first = engine.createOtp('owner@gmail.com', 'merchant_registration', '10.0.0.1', now);
  assert.equal(first.success, true);

  // Requesting again after 20 seconds fails due to 60s resend cooldown
  const tooEarly = engine.createOtp('owner@gmail.com', 'merchant_registration', '10.0.0.1', now + 20_000);
  assert.equal(tooEarly.success, false);
  assert.equal(tooEarly.errorCode, 'COOLDOWN_ACTIVE');

  // Requesting after 61 seconds succeeds and invalidates the first OTP
  const second = engine.createOtp('owner@gmail.com', 'merchant_registration', '10.0.0.1', now + 61_000);
  assert.equal(second.success, true);

  if (first.otp !== second.otp) {
    const verifyOld = engine.verifyOtp('owner@gmail.com', 'merchant_registration', first.otp!, now + 62_000);
    assert.equal(verifyOld.success, false);
    assert.equal(verifyOld.errorCode, 'INVALID_OTP');
  }

  // Attempting to verify after 5 minutes + 1 second from second OTP creation fails with EXPIRED
  const expiredCheck = engine.verifyOtp(
    'owner@gmail.com',
    'merchant_registration',
    second.otp!,
    now + 61_000 + 5 * 60 * 1000 + 1000
  );
  assert.equal(expiredCheck.success, false);
  assert.equal(expiredCheck.errorCode, 'EXPIRED');
});

test('OtpServerEngine enforces maximum 5 failed verification attempts and invalidates OTP on 5th failure', () => {
  const engine = new OtpServerEngine({ secret: 'test_hmac_secret_123' });
  const now = 1_700_000_000_000;

  const created = engine.createOtp('staff@gmail.com', 'staff_invitation', '10.0.0.2', now);
  assert.equal(created.success, true);
  const wrongOtp = created.otp === '000000' ? '999999' : '000000';

  for (let i = 1; i <= 4; i++) {
    const attempt = engine.verifyOtp('staff@gmail.com', 'staff_invitation', wrongOtp, now + 1000);
    assert.equal(attempt.success, false);
    assert.equal(attempt.errorCode, 'INVALID_OTP');
    assert.equal(attempt.remainingAttempts, 5 - i);
  }

  // 5th wrong attempt locks/deletes the OTP
  const fifth = engine.verifyOtp('staff@gmail.com', 'staff_invitation', wrongOtp, now + 1000);
  assert.equal(fifth.success, false);
  assert.equal(fifth.errorCode, 'MAX_ATTEMPTS');
  assert.equal(fifth.remainingAttempts, 0);

  // Even the right OTP is now rejected because the record was invalidated after 5 failures
  const afterLockout = engine.verifyOtp('staff@gmail.com', 'staff_invitation', created.otp!, now + 2000);
  assert.equal(afterLockout.success, false);
  assert.equal(afterLockout.errorCode, 'NOT_FOUND');
});
