import crypto from 'crypto';

export type OtpPurpose = 'merchant_registration' | 'staff_invitation' | 'password_reset';

export interface OtpRecord {
  email: string;
  purpose: OtpPurpose;
  otpHash: string;
  createdAt: number;
  expiresAt: number;
  attempts: number;
  maxAttempts: number;
  resendAvailableAt: number;
  consumed: boolean;
}

export interface VerificationTokenRecord {
  token: string;
  email: string;
  purpose: OtpPurpose;
  verifiedAt: number;
  expiresAt: number;
  consumed: boolean;
}

export interface OtpEngineOptions {
  secret?: string;
  ttlMs?: number;
  maxAttempts?: number;
  resendCooldownMs?: number;
  maxRequestsPerWindow?: number;
  rateWindowMs?: number;
  verificationTokenTtlMs?: number;
}

export class OtpServerEngine {
  private readonly secret: string;
  private readonly ttlMs: number;
  private readonly maxAttempts: number;
  private readonly resendCooldownMs: number;
  private readonly maxRequestsPerWindow: number;
  private readonly rateWindowMs: number;
  private readonly verificationTokenTtlMs: number;

  private readonly otpStore = new Map<string, OtpRecord>();
  private readonly rateLimitStore = new Map<string, number[]>();
  private readonly verificationTokens = new Map<string, VerificationTokenRecord>();

  constructor(options: OtpEngineOptions = {}) {
    this.secret = options.secret || process.env.OTP_HMAC_SECRET || crypto.randomBytes(32).toString('hex');
    this.ttlMs = options.ttlMs ?? 5 * 60 * 1000; // 5 minutes
    this.maxAttempts = options.maxAttempts ?? 5;
    this.resendCooldownMs = options.resendCooldownMs ?? 60 * 1000; // 60 seconds
    this.maxRequestsPerWindow = options.maxRequestsPerWindow ?? 5;
    this.rateWindowMs = options.rateWindowMs ?? 15 * 60 * 1000; // 15 minutes
    this.verificationTokenTtlMs = options.verificationTokenTtlMs ?? 15 * 60 * 1000; // 15 minutes
  }

  private getKey(email: string, purpose: OtpPurpose): string {
    return `${email.trim().toLowerCase()}::${purpose}`;
  }

  public hashOtp(email: string, purpose: OtpPurpose, otp: string): string {
    return crypto
      .createHmac('sha256', this.secret)
      .update(`${email.trim().toLowerCase()}:${purpose}:${otp.trim()}`)
      .digest('hex');
  }

  public generateSixDigitOtp(): string {
    return String(crypto.randomInt(100000, 1000000));
  }

  private checkRateLimit(rateKey: string, now: number): { allowed: boolean; retryAfterSec?: number } {
    const timestamps = (this.rateLimitStore.get(rateKey) || []).filter(ts => now - ts < this.rateWindowMs);
    if (timestamps.length >= this.maxRequestsPerWindow) {
      const oldest = timestamps[0];
      const retryAfterSec = Math.max(1, Math.ceil((this.rateWindowMs - (now - oldest)) / 1000));
      this.rateLimitStore.set(rateKey, timestamps);
      return { allowed: false, retryAfterSec };
    }
    timestamps.push(now);
    this.rateLimitStore.set(rateKey, timestamps);
    return { allowed: true };
  }

  public createOtp(
    email: string,
    purpose: OtpPurpose,
    clientIp = 'unknown',
    now = Date.now()
  ): {
    success: boolean;
    otp?: string;
    expiresAt?: number;
    resendAvailableAt?: number;
    errorCode?: 'INVALID_EMAIL' | 'COOLDOWN_ACTIVE' | 'RATE_LIMITED';
    message: string;
  } {
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return {
        success: false,
        errorCode: 'INVALID_EMAIL',
        message: 'সঠিক ইমেইল ঠিকানা প্রদান করুন।'
      };
    }

    const key = this.getKey(cleanEmail, purpose);
    const existing = this.otpStore.get(key);

    // Check 60s resend cooldown
    if (existing && !existing.consumed && now < existing.resendAvailableAt) {
      const waitSec = Math.max(1, Math.ceil((existing.resendAvailableAt - now) / 1000));
      return {
        success: false,
        errorCode: 'COOLDOWN_ACTIVE',
        message: `অনুগ্রহ করে ${waitSec} সেকেন্ড পর আবার নতুন OTP অনুরোধ করুন।`
      };
    }

    // Check rate limit by email and IP
    const emailRate = this.checkRateLimit(`email:${cleanEmail}`, now);
    if (!emailRate.allowed) {
      return {
        success: false,
        errorCode: 'RATE_LIMITED',
        message: `অতিরিক্ত OTP অনুরোধ করা হয়েছে। অনুগ্রহ করে ${emailRate.retryAfterSec} সেকেন্ড পর আবার চেষ্টা করুন।`
      };
    }

    if (clientIp && clientIp !== 'unknown') {
      const ipRate = this.checkRateLimit(`ip:${clientIp}`, now);
      if (!ipRate.allowed) {
        return {
          success: false,
          errorCode: 'RATE_LIMITED',
          message: `এই নেটওয়ার্ক থেকে অতিরিক্ত অনুরোধ করা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।`
        };
      }
    }

    // Generate new OTP and overwrite/invalidate any previous OTP for this email + purpose
    const otp = this.generateSixDigitOtp();
    const otpHash = this.hashOtp(cleanEmail, purpose, otp);
    const expiresAt = now + this.ttlMs;
    const resendAvailableAt = now + this.resendCooldownMs;

    this.otpStore.set(key, {
      email: cleanEmail,
      purpose,
      otpHash,
      createdAt: now,
      expiresAt,
      attempts: 0,
      maxAttempts: this.maxAttempts,
      resendAvailableAt,
      consumed: false
    });

    return {
      success: true,
      otp,
      expiresAt,
      resendAvailableAt,
      message: '৬-ডিজিটের OTP তৈরি হয়েছে।'
    };
  }

  public rollbackOtpOnDeliveryFailure(email: string, purpose: OtpPurpose): void {
    const cleanEmail = (email || '').trim().toLowerCase();
    const key = this.getKey(cleanEmail, purpose);
    this.otpStore.delete(key);
    const timestamps = this.rateLimitStore.get(`email:${cleanEmail}`);
    if (timestamps && timestamps.length > 0) {
      timestamps.pop();
      this.rateLimitStore.set(`email:${cleanEmail}`, timestamps);
    }
  }

  public verifyOtp(
    email: string,
    purpose: OtpPurpose,
    enteredOtp: string,
    now = Date.now()
  ): {
    success: boolean;
    verificationToken?: string;
    remainingAttempts?: number;
    errorCode?: 'NOT_FOUND' | 'EXPIRED' | 'MAX_ATTEMPTS' | 'INVALID_OTP';
    message: string;
  } {
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanOtp = (enteredOtp || '').trim();
    const key = this.getKey(cleanEmail, purpose);
    const record = this.otpStore.get(key);

    if (!record || record.consumed) {
      return {
        success: false,
        errorCode: 'NOT_FOUND',
        message: 'কোনো সক্রিয় OTP পাওয়া যায়নি। অনুগ্রহ করে আবার নতুন OTP পাঠান।'
      };
    }

    if (now > record.expiresAt) {
      this.otpStore.delete(key);
      return {
        success: false,
        errorCode: 'EXPIRED',
        message: 'OTP-এর মেয়াদ (৫ মিনিট) শেষ হয়ে গেছে। অনুগ্রহ করে Resend OTP ক্লিক করুন।'
      };
    }

    if (record.attempts >= record.maxAttempts) {
      this.otpStore.delete(key);
      return {
        success: false,
        errorCode: 'MAX_ATTEMPTS',
        message: '৫ বার ভুল OTP দেওয়ার কারণে এই কোডটি বাতিল হয়েছে। নতুন OTP অনুরোধ করুন।'
      };
    }

    if (!/^\d{6}$/.test(cleanOtp)) {
      record.attempts += 1;
      const remaining = Math.max(0, record.maxAttempts - record.attempts);
      if (remaining === 0) {
        this.otpStore.delete(key);
        return {
          success: false,
          remainingAttempts: 0,
          errorCode: 'MAX_ATTEMPTS',
          message: '৫ বার ভুল OTP দেওয়ার কারণে এই কোডটি বাতিল হয়েছে। নতুন OTP অনুরোধ করুন।'
        };
      }
      return {
        success: false,
        remainingAttempts: remaining,
        errorCode: 'INVALID_OTP',
        message: `ভুল OTP কোড! আপনার আরও ${remaining} বার চেষ্টা করার সুযোগ আছে।`
      };
    }

    const candidateHash = this.hashOtp(cleanEmail, purpose, cleanOtp);
    const isMatch = crypto.timingSafeEqual(
      Buffer.from(candidateHash, 'hex'),
      Buffer.from(record.otpHash, 'hex')
    );

    if (!isMatch) {
      record.attempts += 1;
      const remaining = Math.max(0, record.maxAttempts - record.attempts);
      if (remaining === 0) {
        this.otpStore.delete(key);
        return {
          success: false,
          remainingAttempts: 0,
          errorCode: 'MAX_ATTEMPTS',
          message: '৫ বার ভুল OTP দেওয়ার কারণে এই কোডটি বাতিল হয়েছে। নতুন OTP অনুরোধ করুন।'
        };
      }
      return {
        success: false,
        remainingAttempts: remaining,
        errorCode: 'INVALID_OTP',
        message: `ভুল OTP কোড! আপনার আরও ${remaining} বার চেষ্টা করার সুযোগ আছে।`
      };
    }

    // Valid OTP! Mark consumed and delete from active OTP store
    record.consumed = true;
    this.otpStore.delete(key);

    // Issue single-use signed verification token
    const rawToken = crypto.randomBytes(24).toString('hex');
    const signature = crypto
      .createHmac('sha256', this.secret)
      .update(`${cleanEmail}:${purpose}:${rawToken}`)
      .digest('hex');
    const verificationToken = `${rawToken}.${signature}`;

    this.verificationTokens.set(verificationToken, {
      token: verificationToken,
      email: cleanEmail,
      purpose,
      verifiedAt: now,
      expiresAt: now + this.verificationTokenTtlMs,
      consumed: false
    });

    return {
      success: true,
      verificationToken,
      message: 'OTP সফলভাবে যাচাই হয়েছে।'
    };
  }

  public consumeVerificationToken(
    email: string,
    purpose: OtpPurpose,
    token: string,
    now = Date.now()
  ): boolean {
    const cleanEmail = (email || '').trim().toLowerCase();
    const record = this.verificationTokens.get(token);
    if (!record || record.consumed) return false;
    if (record.email !== cleanEmail || record.purpose !== purpose) return false;
    if (now > record.expiresAt) {
      this.verificationTokens.delete(token);
      return false;
    }
    record.consumed = true;
    this.verificationTokens.delete(token);
    return true;
  }
}
