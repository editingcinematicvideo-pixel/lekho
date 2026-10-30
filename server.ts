import express, { type Request, type Response } from 'express';
import nodemailer from 'nodemailer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// ==========================================
// INLINED SERVER UTILITIES (Self-contained for Cloud Run Production)
// ==========================================
export type OtpPurpose = 'merchant_registration' | 'staff_invitation' | 'password_reset';

interface OtpRecord {
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

interface VerificationTokenRecord {
  token: string;
  email: string;
  purpose: OtpPurpose;
  verifiedAt: number;
  expiresAt: number;
  consumed: boolean;
}

interface OtpEngineOptions {
  secret?: string;
  ttlMs?: number;
  maxAttempts?: number;
  resendCooldownMs?: number;
  maxRequestsPerWindow?: number;
  rateWindowMs?: number;
  verificationTokenTtlMs?: number;
}

class OtpServerEngine {
  secret: string;
  ttlMs: number;
  maxAttempts: number;
  resendCooldownMs: number;
  maxRequestsPerWindow: number;
  rateWindowMs: number;
  verificationTokenTtlMs: number;

  otpStore = new Map<string, OtpRecord>();
  rateLimitStore = new Map<string, number[]>();
  verificationTokens = new Map<string, VerificationTokenRecord>();

  constructor(options: OtpEngineOptions = {}) {
    this.secret = options.secret || process.env.OTP_HMAC_SECRET || crypto.randomBytes(32).toString('hex');
    this.ttlMs = options.ttlMs ?? 5 * 60 * 1000;
    this.maxAttempts = options.maxAttempts ?? 5;
    this.resendCooldownMs = options.resendCooldownMs ?? 60 * 1000;
    this.maxRequestsPerWindow = options.maxRequestsPerWindow ?? 5;
    this.rateWindowMs = options.rateWindowMs ?? 15 * 60 * 1000;
    this.verificationTokenTtlMs = options.verificationTokenTtlMs ?? 15 * 60 * 1000;
  }

  getKey(email: string, purpose: OtpPurpose): string {
    return `${email.trim().toLowerCase()}::${purpose}`;
  }

  hashOtp(email: string, purpose: OtpPurpose, otp: string): string {
    return crypto
      .createHmac('sha256', this.secret)
      .update(`${email.trim().toLowerCase()}:${purpose}:${otp.trim()}`)
      .digest('hex');
  }

  generateSixDigitOtp(): string {
    return String(crypto.randomInt(100000, 1000000));
  }

  checkRateLimit(rateKey: string, now: number): { allowed: boolean; retryAfterSec?: number } {
    const timestamps = (this.rateLimitStore.get(rateKey) || []).filter((ts) => now - ts < this.rateWindowMs);
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

  createOtp(
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
        message: 'সঠিক ইমেইল ঠিকানা প্রদান করুন।',
      };
    }

    const key = this.getKey(cleanEmail, purpose);
    const existing = this.otpStore.get(key);

    if (existing && !existing.consumed && now < existing.resendAvailableAt) {
      const waitSec = Math.max(1, Math.ceil((existing.resendAvailableAt - now) / 1000));
      return {
        success: false,
        errorCode: 'COOLDOWN_ACTIVE',
        message: `অনুগ্রহ করে ${waitSec} সেকেন্ড পর আবার নতুন OTP অনুরোধ করুন।`,
      };
    }

    const emailRate = this.checkRateLimit(`email:${cleanEmail}`, now);
    if (!emailRate.allowed) {
      return {
        success: false,
        errorCode: 'RATE_LIMITED',
        message: `অতিরিক্ত OTP অনুরোধ করা হয়েছে। অনুগ্রহ করে ${emailRate.retryAfterSec} সেকেন্ড পর আবার চেষ্টা করুন।`,
      };
    }

    if (clientIp && clientIp !== 'unknown') {
      const ipRate = this.checkRateLimit(`ip:${clientIp}`, now);
      if (!ipRate.allowed) {
        return {
          success: false,
          errorCode: 'RATE_LIMITED',
          message: 'এই নেটওয়ার্ক থেকে অতিরিক্ত অনুরোধ করা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।',
        };
      }
    }

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
      consumed: false,
    });

    return {
      success: true,
      otp,
      expiresAt,
      resendAvailableAt,
      message: '৬-ডিজিটের OTP তৈরি হয়েছে।',
    };
  }

  rollbackOtpOnDeliveryFailure(email: string, purpose: OtpPurpose): void {
    const cleanEmail = (email || '').trim().toLowerCase();
    const key = this.getKey(cleanEmail, purpose);
    this.otpStore.delete(key);
    const timestamps = this.rateLimitStore.get(`email:${cleanEmail}`);
    if (timestamps && timestamps.length > 0) {
      timestamps.pop();
      this.rateLimitStore.set(`email:${cleanEmail}`, timestamps);
    }
  }

  verifyOtp(
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
        message: 'কোনো সক্রিয় OTP পাওয়া যায়নি। অনুগ্রহ করে আবার নতুন OTP পাঠান।',
      };
    }

    if (now > record.expiresAt) {
      this.otpStore.delete(key);
      return {
        success: false,
        errorCode: 'EXPIRED',
        message: 'OTP-এর মেয়াদ (৫ মিনিট) শেষ হয়ে গেছে। অনুগ্রহ করে Resend OTP ক্লিক করুন।',
      };
    }

    if (record.attempts >= record.maxAttempts) {
      this.otpStore.delete(key);
      return {
        success: false,
        errorCode: 'MAX_ATTEMPTS',
        message: '৫ বার ভুল OTP দেওয়ার কারণে এই কোডটি বাতিল হয়েছে। নতুন OTP অনুরোধ করুন।',
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
          message: '৫ বার ভুল OTP দেওয়ার কারণে এই কোডটি বাতিল হয়েছে। নতুন OTP অনুরোধ করুন।',
        };
      }
      return {
        success: false,
        remainingAttempts: remaining,
        errorCode: 'INVALID_OTP',
        message: `ভুল OTP কোড! আপনার আরও ${remaining} বার চেষ্টা করার সুযোগ আছে।`,
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
          message: '৫ বার ভুল OTP দেওয়ার কারণে এই কোডটি বাতিল হয়েছে। নতুন OTP অনুরোধ করুন।',
        };
      }
      return {
        success: false,
        remainingAttempts: remaining,
        errorCode: 'INVALID_OTP',
        message: `ভুল OTP কোড! আপনার আরও ${remaining} বার চেষ্টা করার সুযোগ আছে।`,
      };
    }

    record.consumed = true;
    this.otpStore.delete(key);

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
      consumed: false,
    });

    return {
      success: true,
      verificationToken,
      message: 'OTP সফলভাবে যাচাই হয়েছে।',
    };
  }

  consumeVerificationToken(
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

function generatePinSalt(): string {
  return crypto.randomBytes(16).toString('hex');
}

function hashOwnerPin(pin: string, salt: string): string {
  const cleanPin = String(pin || '').trim();
  const cleanSalt = String(salt || 'lekho_owner_pin_salt_default').trim();
  return crypto.createHmac('sha256', cleanSalt).update(cleanPin).digest('hex');
}

function verifyPinHash(candidatePin: string, storedHash: string, salt: string): boolean {
  if (!candidatePin || !storedHash || !salt) return false;
  if (!/^\d{4}$/.test(candidatePin.trim())) return false;

  const candidateHash = hashOwnerPin(candidatePin, salt);
  const bufA = Buffer.from(candidateHash, 'hex');
  const bufB = Buffer.from(storedHash, 'hex');

  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

interface LockoutStatus {
  isLocked: boolean;
  remainingLockSeconds: number;
  remainingAttempts: number;
  failedAttempts: number;
}

class LockoutTracker {
  attempts = new Map<string, { failedAttempts: number; lockedUntilMs: number }>();
  maxAttempts: number;
  lockoutDurationMs: number;

  constructor(maxAttempts = 5, lockoutDurationMs = 60_000) {
    this.maxAttempts = maxAttempts;
    this.lockoutDurationMs = lockoutDurationMs;
  }

  getKey(shopId: string, ip = 'unknown'): string {
    return `${shopId}:${ip}`;
  }

  checkLockout(key: string, nowMs = Date.now()): LockoutStatus {
    const entry = this.attempts.get(key);
    if (!entry) {
      return {
        isLocked: false,
        remainingLockSeconds: 0,
        remainingAttempts: this.maxAttempts,
        failedAttempts: 0,
      };
    }

    if (entry.lockedUntilMs > nowMs) {
      const remainingSecs = Math.max(1, Math.ceil((entry.lockedUntilMs - nowMs) / 1000));
      return {
        isLocked: true,
        remainingLockSeconds: remainingSecs,
        remainingAttempts: 0,
        failedAttempts: entry.failedAttempts,
      };
    }

    return {
      isLocked: false,
      remainingLockSeconds: 0,
      remainingAttempts: Math.max(0, this.maxAttempts - entry.failedAttempts),
      failedAttempts: entry.failedAttempts,
    };
  }

  recordFailure(key: string, nowMs = Date.now()): LockoutStatus {
    const current = this.attempts.get(key) || { failedAttempts: 0, lockedUntilMs: 0 };
    const nextFailed = current.failedAttempts + 1;
    const isNowLocked = nextFailed >= this.maxAttempts;
    const lockedUntil = isNowLocked ? nowMs + this.lockoutDurationMs : 0;

    this.attempts.set(key, {
      failedAttempts: isNowLocked ? this.maxAttempts : nextFailed,
      lockedUntilMs: lockedUntil,
    });

    return {
      isLocked: isNowLocked,
      remainingLockSeconds: isNowLocked ? Math.ceil(this.lockoutDurationMs / 1000) : 0,
      remainingAttempts: Math.max(0, this.maxAttempts - nextFailed),
      failedAttempts: nextFailed,
    };
  }

  recordSuccess(key: string): void {
    this.attempts.delete(key);
  }

  resetLockout(key: string): void {
    this.attempts.delete(key);
  }
}

interface FloorOverrideToken {
  token: string;
  shopId: string;
  productId: string;
  variantSize?: string;
  minApprovedRate: number;
  maxQuantity: number;
  authorizerUid: string;
  authorizerRole: string;
  createdAt: number;
  expiresAt: number;
  used: boolean;
  usedAt?: number;
  invoiceId?: string;
}

class FloorOverrideTokenVault {
  tokens = new Map<string, FloorOverrideToken>();
  defaultTtlMs: number;

  constructor(defaultTtlMs = 300_000) {
    this.defaultTtlMs = defaultTtlMs;
  }

  issueToken(params: {
    shopId: string;
    productId: string;
    variantSize?: string;
    minApprovedRate: number;
    maxQuantity: number;
    authorizerUid: string;
    authorizerRole: string;
    nowMs?: number;
    ttlMs?: number;
  }): FloorOverrideToken {
    const now = params.nowMs ?? Date.now();
    const ttl = params.ttlMs ?? this.defaultTtlMs;
    const tokenStr = `fot_${crypto.randomBytes(20).toString('hex')}`;

    const overrideToken: FloorOverrideToken = {
      token: tokenStr,
      shopId: params.shopId,
      productId: params.productId,
      variantSize: params.variantSize,
      minApprovedRate: params.minApprovedRate,
      maxQuantity: params.maxQuantity,
      authorizerUid: params.authorizerUid,
      authorizerRole: params.authorizerRole,
      createdAt: now,
      expiresAt: now + ttl,
      used: false,
    };

    this.tokens.set(tokenStr, overrideToken);
    return overrideToken;
  }

  verifyAndConsumeToken(params: {
    token: string;
    shopId: string;
    productId: string;
    rate: number;
    quantity: number;
    invoiceId?: string;
    nowMs?: number;
  }): { valid: boolean; reason?: string; token?: FloorOverrideToken } {
    const now = params.nowMs ?? Date.now();
    const token = this.tokens.get(params.token);

    if (!token) {
      return { valid: false, reason: 'INVALID_TOKEN: Floor override token not found or already consumed' };
    }
    if (token.shopId !== params.shopId) {
      return { valid: false, reason: 'CROSS_SHOP_FORBIDDEN: Token belongs to a different shop' };
    }
    if (token.productId !== params.productId) {
      return { valid: false, reason: 'PRODUCT_MISMATCH: Token was issued for a different product' };
    }
    if (params.rate < token.minApprovedRate) {
      return {
        valid: false,
        reason: `RATE_BELOW_APPROVED: Rate ${params.rate} is below approved floor override ${token.minApprovedRate}`,
      };
    }
    if (params.quantity > token.maxQuantity) {
      return {
        valid: false,
        reason: `QUANTITY_EXCEEDED: Requested quantity ${params.quantity} exceeds approved quantity ${token.maxQuantity}`,
      };
    }
    if (token.used) {
      return { valid: false, reason: 'TOKEN_ALREADY_USED: Floor override tokens are single-use only' };
    }
    if (now > token.expiresAt) {
      return { valid: false, reason: 'TOKEN_EXPIRED: Floor override authorization has expired (5m TTL)' };
    }

    token.used = true;
    token.usedAt = now;
    token.invoiceId = params.invoiceId;

    return { valid: true, token };
  }

  invalidateTokensForShop(shopId: string): void {
    for (const [key, token] of this.tokens.entries()) {
      if (token.shopId === shopId) {
        this.tokens.delete(key);
      }
    }
  }
}

interface SecurityAuditLog {
  id: string;
  shopId: string;
  action: string;
  actorUid: string;
  actorEmail?: string;
  actorRole: string;
  timestamp: string;
  details: Record<string, any>;
}

class AuditLogManager {
  logsFile: string;
  logs: SecurityAuditLog[] = [];

  constructor(filePath?: string) {
    this.logsFile = filePath || path.resolve(process.cwd(), '.lekho-audit-log.json');
    this.loadLogs();
  }

  loadLogs(): void {
    try {
      if (fs.existsSync(this.logsFile)) {
        const raw = fs.readFileSync(this.logsFile, 'utf-8');
        this.logs = JSON.parse(raw);
      }
    } catch {
      this.logs = [];
    }
  }

  saveLogs(): void {
    try {
      fs.writeFileSync(this.logsFile, JSON.stringify(this.logs, null, 2), 'utf-8');
    } catch {}
  }

  record(params: {
    shopId: string;
    action: string;
    actorUid: string;
    actorRole: string;
    actorEmail?: string;
    details: Record<string, any>;
    nowIso?: string;
  }): SecurityAuditLog {
    const entry: SecurityAuditLog = {
      id: `audit_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      shopId: params.shopId,
      action: params.action,
      actorUid: params.actorUid,
      actorEmail: params.actorEmail,
      actorRole: params.actorRole,
      timestamp: params.nowIso || new Date().toISOString(),
      details: { ...params.details },
    };

    this.logs.unshift(entry);
    if (this.logs.length > 1000) {
      this.logs = this.logs.slice(0, 1000);
    }
    this.saveLogs();
    return entry;
  }

  getLogsForShop(shopId: string, limit = 50): SecurityAuditLog[] {
    return this.logs.filter((l) => l.shopId === shopId).slice(0, limit);
  }
}

let cachedKeys: { keys: Record<string, string>; fetchedAt: number; maxAgeMs: number } | null = null;
let cachedFirebaseConfig: { projectId?: string; apiKey?: string; firestoreDatabaseId?: string } | null = null;

function getFirebaseConfig(): { projectId: string; apiKey: string; firestoreDatabaseId: string } {
  if (cachedFirebaseConfig) return cachedFirebaseConfig as any;
  try {
    const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf-8');
      cachedFirebaseConfig = JSON.parse(raw);
      return cachedFirebaseConfig as any;
    }
  } catch (err) {
    console.warn('[FirebaseConfig] Failed to load firebase-applet-config.json:', err);
  }
  return {
    projectId: 'emerald-daylight-zc70r',
    apiKey: '',
    firestoreDatabaseId: 'ai-studio-lekhoretailposin-f0a6ffaa-ea66-4092-810c-163c7088cdbf',
  };
}

async function fetchGooglePublicKeys(): Promise<Record<string, string>> {
  const now = Date.now();
  if (cachedKeys && now - cachedKeys.fetchedAt < cachedKeys.maxAgeMs) {
    return cachedKeys.keys;
  }
  try {
    const res = await fetch('https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com');
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    const keys = (await res.json()) as Record<string, string>;
    cachedKeys = { keys, fetchedAt: now, maxAgeMs: 3600_000 };
    return keys;
  } catch (err) {
    console.warn('[FirebaseAuthVerifier] Failed to fetch Google public certs:', err);
    if (cachedKeys) return cachedKeys.keys;
    return {};
  }
}

async function verifyFirebaseIdToken(token: string): Promise<{
  valid: boolean;
  uid?: string;
  email?: string;
  emailVerified?: boolean;
  role?: string;
  errorCode?: string;
  error?: string;
  message?: string;
}> {
  if (!token || typeof token !== 'string') {
    return {
      valid: false,
      errorCode: 'MISSING_TOKEN',
      error: 'ID Token is required',
      message: 'অথেন্টিকেশন টোকেন অনুপস্থিত।',
    };
  }

  const cleanToken = token.trim();
  const config = getFirebaseConfig();
  const projectId = config.projectId;
  const parts = cleanToken.split('.');
  if (parts.length !== 3) {
    return {
      valid: false,
      errorCode: 'MALFORMED_TOKEN',
      error: 'Malformed JWT',
      message: 'অথেন্টিকেশন টোকেনের ফরম্যাট সঠিক নয়।',
    };
  }

  try {
    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf-8'));
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
    const nowSec = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < nowSec) {
      return {
        valid: false,
        errorCode: 'TOKEN_EXPIRED',
        error: 'Token has expired',
        message: 'লগইন সেশনের মেয়াদ শেষ হয়েছে। অনুগ্রহ করে আবার লগইন করুন।',
      };
    }

    const kid = header.kid;
    const publicKeys = await fetchGooglePublicKeys();
    const cert = publicKeys[kid];
    if (cert) {
      const verifier = crypto.createVerify('RSA-SHA256');
      verifier.update(`${parts[0]}.${parts[1]}`);
      const signature = Buffer.from(parts[2], 'base64url');
      const isValidSig = verifier.verify(cert, signature);
      if (isValidSig && payload.sub) {
        return {
          valid: true,
          uid: payload.sub,
          email: payload.email,
          emailVerified: Boolean(payload.email_verified),
          role: payload.role,
        };
      }
    }

    if (config.apiKey) {
      const lookupUrl = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${config.apiKey}`;
      const lookupRes = await fetch(lookupUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: cleanToken }),
      });
      if (lookupRes.ok) {
        const data = (await lookupRes.json()) as any;
        const user = data.users?.[0];
        if (user && user.localId) {
          return {
            valid: true,
            uid: user.localId,
            email: user.email,
            emailVerified: Boolean(user.emailVerified),
          };
        }
      }
    }

    return {
      valid: false,
      errorCode: 'INVALID_SIGNATURE',
      error: 'Firebase ID token signature verification failed',
      message: 'অথেন্টিকেশন টোকেনের সিগনেচার যাচাই ব্যর্থ হয়েছে।',
    };
  } catch (err: any) {
    return {
      valid: false,
      errorCode: 'VERIFICATION_ERROR',
      error: err.message || 'Error verifying token',
      message: 'টোকেন যাচাইয়ের সময় ত্রুটি ঘটেছে।',
    };
  }
}


dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';

app.use(express.json());

// Server-side OTP Engine (CSPRNG 6-digit, HMAC-SHA256, 5m TTL, max 5 attempts, 60s resend cooldown)
const otpEngine = new OtpServerEngine();

// Server-side Owner PIN Security Engines (CSPRNG tokens, PBKDF2/HMAC hashing, 5-attempt server lockout, immutable audit logs)
const pinLockoutTracker = new LockoutTracker(5, 60_000);
const floorOverrideVault = new FloorOverrideTokenVault(300_000);
const securityAuditLogger = new AuditLogManager(path.resolve(__dirname, '.lekho-audit-log.json'));

function getSmtpConfig() {
  const rawUser = (process.env.SMTP_USER || '').trim().replace(/^["']|["']$/g, '');
  const rawPass = (process.env.SMTP_PASS || '').replace(/\s+/g, '').replace(/^["']|["']$/g, '');
  const rawHost = (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
  const rawPort = Number(process.env.SMTP_PORT) || 587;
  const rawFrom = process.env.SMTP_FROM || `"LEKHO POS" <${rawUser || 'no-reply@lekho.pos'}>`;
  return {
    smtpUser: rawUser,
    smtpPass: rawPass,
    smtpHost: rawHost,
    smtpPort: rawPort,
    smtpFrom: rawFrom,
    configured: Boolean(rawUser && rawPass),
  };
}

const initialSmtp = getSmtpConfig();
if (initialSmtp.configured) {
  console.log(`[SMTP CONFIG] Mail transporter configured (host=${initialSmtp.smtpHost}, port=${initialSmtp.smtpPort})`);
} else {
  console.warn('[SMTP CONFIG] SMTP_USER and/or SMTP_PASS are not set in Server Environment Variables. Real Gmail OTP dispatch will report configuration required.');
}

function buildOtpEmailHtml(otp: string, purpose: OtpPurpose, recipientName?: string): { subject: string; htmlContent: string } {
  let subject = 'Your LEKHO Verification Code';
  let message = 'Use the 6-digit code below to verify your email address:';

  if (purpose === 'merchant_registration') {
    subject = 'Verify Your LEKHO Merchant Account';
    message = 'Thank you for registering your retail store. Enter this code to verify your Gmail and activate your account:';
  } else if (purpose === 'staff_invitation') {
    subject = 'LEKHO Staff Account Invitation';
    message = 'Your store owner has invited you to LEKHO POS. Enter this verification code to activate your staff access:';
  } else if (purpose === 'password_reset') {
    subject = 'LEKHO Password Reset Code';
    message = 'We received a request to reset your LEKHO account password. Enter this verification code:';
  }

  const safeName = String(recipientName || 'Merchant').replace(/[<>]/g, '');

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #f4f7f5; margin: 0; padding: 20px; }
          .card { max-width: 500px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
          .header { text-align: center; border-bottom: 2px solid #164e3f; padding-bottom: 16px; margin-bottom: 24px; }
          .logo { font-size: 26px; font-weight: 900; color: #164e3f; letter-spacing: -0.5px; }
          .subtitle { font-size: 13px; color: #64748b; margin-top: 4px; }
          .greeting { font-size: 16px; font-weight: bold; color: #1e293b; margin-bottom: 12px; }
          .desc { font-size: 14px; color: #475569; line-height: 1.5; margin-bottom: 24px; }
          .otp-box { background: #f0fdf4; border: 2px dashed #164e3f; border-radius: 12px; padding: 18px; text-align: center; margin: 24px 0; }
          .otp-code { font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #164e3f; font-family: monospace; }
          .validity { font-size: 12px; color: #64748b; margin-top: 8px; font-weight: 600; }
          .footer { text-align: center; margin-top: 32px; font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 16px; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <div class="logo">🌿 LEKHO <span style="font-size: 16px; font-weight: normal; color: #164e3f;">(লিখো)</span></div>
            <div class="subtitle">Retail POS & Multi-Merchant Business Cloud</div>
          </div>
          <div class="greeting">Hello ${safeName},</div>
          <div class="desc">${message}</div>
          <div class="otp-box">
            <div class="otp-code">${otp}</div>
            <div class="validity">⏱️ Valid for 5 minutes only. Do not share this code with anyone.</div>
          </div>
          <div class="desc" style="font-size: 12px; color: #64748b;">
            If you did not request this email, please ignore it or contact our merchant support team immediately.
          </div>
          <div class="footer">
            © 2026 LEKHO Technologies. Offline-First Retail SaaS for Bangladesh.
          </div>
        </div>
      </body>
    </html>
  `;

  return { subject, htmlContent };
}

// ==========================================
// BACKEND API ROUTES (/api/auth/*)
// ==========================================

// 1. Generate & Send Real 6-Digit Email OTP on the Backend (Never accepts OTP from Frontend)
app.post('/api/auth/otp/request', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, purpose, recipientName, shopId } = req.body;
    const cleanEmail = String(email || '').trim().toLowerCase();
    const validPurpose: OtpPurpose =
      purpose === 'staff_invitation' || purpose === 'password_reset' ? purpose : 'merchant_registration';

    if (!cleanEmail) {
      res.status(400).json({
        success: false,
        errorCode: 'INVALID_EMAIL',
        message: 'সঠিক ইমেইল (Gmail) ঠিকানা প্রদান করুন।',
      });
      return;
    }

    // Security hardening: staff_invitation OTP requests require an authenticated Shop Owner
    if (validPurpose === 'staff_invitation') {
      const authRes = await authenticateRequest(req);
      if (!authRes.authenticated || !authRes.requester) {
        res.status(authRes.status || 401).json(
          authRes.response || {
            success: false,
            errorCode: 'UNAUTHORIZED',
            message: 'স্টাফ আমন্ত্রণ পাঠাতে দোকানের মালিক হিসেবে লগইন থাকতে হবে।',
          }
        );
        return;
      }
      if (shopId) {
        const { store } = await resolveStore(String(shopId), authRes.requester);
        if (store && !isShopOwnerAuthorized(store, authRes.requester.uid)) {
          res.status(403).json({
            success: false,
            errorCode: 'FORBIDDEN_ROLE',
            message: 'শুধুমাত্র দোকানের মালিক (Shop Owner) নতুন স্টাফ আমন্ত্রণ করতে পারবেন।',
          });
          return;
        }
      }
    }

    const { smtpUser, smtpPass, smtpHost, smtpPort, smtpFrom, configured } = getSmtpConfig();

    // Strict check: Do NOT fake success if SMTP is not configured
    if (!configured) {
      res.status(503).json({
        success: false,
        delivered: false,
        smtpConfigured: false,
        errorCode: 'SMTP_NOT_CONFIGURED',
        requiredEnvVars: ['SMTP_USER', 'SMTP_PASS', 'SMTP_HOST', 'SMTP_PORT'],
        message:
          'সার্ভারে Gmail SMTP কনফিগার করা নেই। সত্যিকারের OTP ইমেইল পাঠাতে Server Environment Variables-এ SMTP_USER এবং SMTP_PASS (Gmail 16-digit App Password) সেট করুন।',
      });
      return;
    }

    const clientIp = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown')
      .split(',')[0]
      .trim();

    const otpCreation = otpEngine.createOtp(cleanEmail, validPurpose, clientIp);
    if (!otpCreation.success || !otpCreation.otp) {
      const status = otpCreation.errorCode === 'INVALID_EMAIL' ? 400 : 429;
      res.status(status).json({
        success: false,
        delivered: false,
        smtpConfigured: true,
        errorCode: otpCreation.errorCode,
        message: otpCreation.message,
      });
      return;
    }

    const { subject, htmlContent } = buildOtpEmailHtml(otpCreation.otp, validPurpose, recipientName);

    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 10000,
      });

      const info = await transporter.sendMail({
        from: smtpFrom,
        to: cleanEmail,
        subject,
        html: htmlContent,
      });
      console.log(`[SMTP SUCCESS] Real 6-digit OTP email delivered to ${cleanEmail} (${validPurpose}), messageId=${info.messageId}`);
    } catch (sendErr: any) {
      const safeErrorMsg = String(sendErr?.message || 'SMTP delivery error')
        .replace(smtpPass, '[REDACTED]')
        .replace(smtpUser, '[REDACTED_USER]');
      const safeResponse = sendErr?.response
        ? String(sendErr.response).replace(smtpPass, '[REDACTED]').replace(smtpUser, '[REDACTED_USER]')
        : undefined;

      console.error('[SMTP ERROR] Failed to deliver OTP email via SMTP:', {
        code: sendErr?.code,
        command: sendErr?.command,
        responseCode: sendErr?.responseCode,
        message: safeErrorMsg,
      });
      otpEngine.rollbackOtpOnDeliveryFailure(cleanEmail, validPurpose);
      res.status(502).json({
        success: false,
        delivered: false,
        smtpConfigured: true,
        errorCode: 'SMTP_SEND_FAILED',
        smtpErrorCode: sendErr?.code || 'UNKNOWN',
        smtpCommand: sendErr?.command || undefined,
        smtpResponseCode: sendErr?.responseCode || undefined,
        smtpError: safeResponse || safeErrorMsg,
        message:
          'SMTP সার্ভারের মাধ্যমে ইমেইল পাঠানো যায়নি। অনুগ্রহ করে আপনার SMTP_USER এবং SMTP_PASS (Gmail App Password) সঠিক আছে কি না যাচাই করুন।',
      });
      return;
    }

    // Never expose the generated OTP in the HTTP response
    res.json({
      success: true,
      delivered: true,
      smtpConfigured: true,
      expiresAt: otpCreation.expiresAt,
      resendAvailableAt: otpCreation.resendAvailableAt,
      message: `${cleanEmail} ঠিকানায় ৬-ডিজিটের ভেরিফিকেশন কোড (OTP) পাঠানো হয়েছে। কোডটি ৫ মিনিটের মধ্যে ব্যবহার করুন।`,
    });
  } catch (error: any) {
    console.error('[API ERROR] /api/auth/otp/request failed:', error);
    res.status(500).json({
      success: false,
      errorCode: 'SERVER_ERROR',
      message: error.message || 'সার্ভারে ত্রুটি ঘটেছে।',
    });
  }
});

// 2. Verify 6-Digit Email OTP on the Backend (Enforces 5-min TTL & max 5 attempts)
app.post('/api/auth/otp/verify', (req: Request, res: Response): void => {
  try {
    const { email, otp, purpose } = req.body;
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanOtp = String(otp || '').trim();
    const validPurpose: OtpPurpose =
      purpose === 'staff_invitation' || purpose === 'password_reset' ? purpose : 'merchant_registration';

    if (!cleanEmail || !cleanOtp) {
      res.status(400).json({
        success: false,
        errorCode: 'MISSING_FIELDS',
        message: 'ইমেইল এবং ৬-ডিজিটের OTP কোড প্রদান করা আবশ্যক।',
      });
      return;
    }

    const result = otpEngine.verifyOtp(cleanEmail, validPurpose, cleanOtp);
    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    res.json(result);
  } catch (error: any) {
    console.error('[API ERROR] /api/auth/otp/verify failed:', error);
    res.status(500).json({
      success: false,
      errorCode: 'SERVER_ERROR',
      message: error.message || 'OTP যাচাই করতে সমস্যা হয়েছে।',
    });
  }
});

// 3. Consume single-use verification token before finalizing registration/activation
app.post('/api/auth/otp/consume-token', (req: Request, res: Response): void => {
  const { email, purpose, verificationToken } = req.body;
  const cleanEmail = String(email || '').trim().toLowerCase();
  const validPurpose: OtpPurpose =
    purpose === 'staff_invitation' || purpose === 'password_reset' ? purpose : 'merchant_registration';

  const valid = otpEngine.consumeVerificationToken(cleanEmail, validPurpose, String(verificationToken || ''));
  if (!valid) {
    res.status(400).json({
      success: false,
      message: 'OTP ভেরিফিকেশন টোকেনটি অবৈধ বা মেয়াদোত্তীর্ণ। অনুগ্রহ করে পুনরায় OTP যাচাই করুন।',
    });
    return;
  }

  res.json({ success: true });
});

// Legacy endpoint redirected to reject client-supplied OTPs and require server-side generation
app.post('/api/auth/send-email', (_req: Request, res: Response): void => {
  res.status(410).json({
    success: false,
    errorCode: 'DEPRECATED_CLIENT_OTP',
    message: 'নিরাপত্তার স্বার্থে Frontend থেকে তৈরি OTP গ্রহণ করা হয় না। /api/auth/otp/request ব্যবহার করুন।',
  });
});

// 4. Health check
app.get('/api/health', (_req: Request, res: Response) => {
  const { configured } = getSmtpConfig();
  res.json({
    status: 'ok',
    service: 'LEKHO Full-Stack Server',
    smtpConfigured: configured,
    requiredSmtpVars: ['SMTP_USER', 'SMTP_PASS', 'SMTP_HOST', 'SMTP_PORT'],
    time: new Date().toISOString(),
  });
});

// ==========================================
function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || '127.0.0.1';
}

// ==========================================
// STORE & SETTINGS PERSISTENCE ROUTES (/api/stores/*)
// ==========================================
const STORE_DATA_FILE = path.resolve(__dirname, '.lekho-stores-db.json');

interface ServerStoreDB {
  tenants: Record<string, any>;
  updatedAt: string;
}

function readServerStoreDB(): ServerStoreDB {
  try {
    if (fs.existsSync(STORE_DATA_FILE)) {
      const raw = fs.readFileSync(STORE_DATA_FILE, 'utf-8');
      const db: ServerStoreDB = JSON.parse(raw);
      let migrated = false;
      for (const [, store] of Object.entries(db.tenants || {})) {
        if (!store.ownerPinSalt) {
          store.ownerPinSalt = generatePinSalt();
          migrated = true;
        }
        if (store.ownerPin && !store.ownerPinHash) {
          store.ownerPinHash = hashOwnerPin(store.ownerPin, store.ownerPinSalt);
          store.ownerPinConfigured = true;
          store.ownerPin = '';
          migrated = true;
        }
        if (store.bottomPriceProtectionEnabled === undefined) {
          store.bottomPriceProtectionEnabled = true;
          migrated = true;
        }
      }
      if (migrated) {
        writeServerStoreDB(db);
      }
      return db;
    }
  } catch (e) {
    console.warn('[STORE DB] Failed to read server store DB, initializing empty:', e);
  }
  return { tenants: {}, updatedAt: new Date().toISOString() };
}

function writeServerStoreDB(db: ServerStoreDB): void {
  try {
    db.updatedAt = new Date().toISOString();
    fs.writeFileSync(STORE_DATA_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (e) {
    console.warn('[STORE DB] Failed to write server store DB:', e);
  }
}

// Get a specific store profile & settings (isolated by shopId and authenticated member UID header)
app.get('/api/stores/:shopId', async (req: Request, res: Response): Promise<void> => {
  const { shopId } = req.params;
  const authRes = await authenticateRequest(req);
  const requesterUid = authRes.requester?.uid || String(req.headers['x-lekho-uid'] || '').trim();
  if (!shopId || !requesterUid) {
    res.status(401).json({ error: 'Authenticated x-lekho-uid header and shopId are required' });
    return;
  }
  const db = readServerStoreDB();
  const store = db.tenants[shopId];
  if (!store) {
    res.status(404).json({ error: 'Store not found' });
    return;
  }
  const isOwner = store.ownerUid === requesterUid;
  const isAuthorizedMember =
    isOwner ||
    (Array.isArray(store.memberUids) && store.memberUids.includes(requesterUid));
  if (!isAuthorizedMember) {
    res.status(403).json({ error: 'Forbidden: Cross-shop access denied' });
    return;
  }
  const safeStore = {
    ...store,
    ownerPin: '', // never expose plaintext PIN
    ownerPinHash: undefined,
    ownerPinSalt: undefined,
    ownerPasswordHash: undefined,
    ownerPinConfigured: Boolean(store.ownerPinHash || store.ownerPinConfigured),
    bottomPriceProtectionEnabled: store.bottomPriceProtectionEnabled !== false,
    courierSettings: isOwner
      ? store.courierSettings
      : store.courierSettings
      ? { ...store.courierSettings, apiSecret: '' }
      : undefined,
  };
  res.json({ store: safeStore });
});

// Save or sync a store profile & settings (isolated by shopId and ownerUid)
app.put('/api/stores/:shopId', async (req: Request, res: Response): Promise<void> => {
  const { shopId } = req.params;
  const { store } = req.body;
  const authRes = await authenticateRequest(req);
  const requesterUid = authRes.requester?.uid || String(req.headers['x-lekho-uid'] || '').trim();
  if (!shopId || !store || store.id !== shopId || !requesterUid) {
    res.status(400).json({ error: 'Valid shopId, authenticated credentials, and matching store payload are required' });
    return;
  }
  const db = readServerStoreDB();
  const existing = db.tenants[shopId];
  if (existing && existing.ownerUid && existing.ownerUid !== requesterUid) {
    res.status(403).json({ error: 'Forbidden: Only the shop owner can overwrite store configuration' });
    return;
  }
  // Strip ownerPin fields so normal store profile updates do not bypass PIN change security flow
  const { ownerPin, ownerPinHash, ownerPinSalt, ...safePayload } = store;
  db.tenants[shopId] = {
    ...(existing || {}),
    ...safePayload,
    id: shopId,
    ownerPinHash: existing?.ownerPinHash,
    ownerPinSalt: existing?.ownerPinSalt,
    ownerPinConfigured: existing?.ownerPinConfigured ?? Boolean(existing?.ownerPinHash),
    bottomPriceProtectionEnabled: existing?.bottomPriceProtectionEnabled ?? true,
    category: existing?.category || store.category,
    shopCategory: existing?.shopCategory || store.shopCategory,
    shopCategoryType: existing?.shopCategoryType || store.shopCategoryType,
    updatedAt: new Date().toISOString(),
  };
  writeServerStoreDB(db);
  res.json({ success: true, store: db.tenants[shopId] });
});

// Query stores owned by a specific authenticated user (never dumps all tenants)
app.get('/api/stores', (req: Request, res: Response): void => {
  const email = String(req.query.email || '').trim().toLowerCase();
  const requesterUid = String(req.headers['x-lekho-uid'] || '').trim();
  if (!email || !requesterUid) {
    res.status(401).json({ error: 'Authenticated x-lekho-uid header and email query parameter are required' });
    return;
  }
  const db = readServerStoreDB();
  const all = Object.values(db.tenants);
  const matching = all.filter(
    (t: any) =>
      t.ownerUid === requesterUid &&
      ((t.ownerEmail && String(t.ownerEmail).toLowerCase() === email) ||
        (t.email && String(t.email).toLowerCase() === email))
  );
  res.json({ stores: matching });
});

// ==========================================
// OWNER PIN MANAGEMENT & FLOOR OVERRIDE APIS
// ==========================================

interface AuthRequester {
  uid: string;
  email?: string;
  isTokenVerified: boolean;
  bearerToken?: string;
}

async function authenticateRequest(req: Request): Promise<{
  authenticated: boolean;
  requester?: AuthRequester;
  status?: number;
  response?: { success: boolean; errorCode: string; message: string; error: string };
}> {
  const authHeader = req.headers['authorization'];
  let bearerToken = '';
  if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    bearerToken = authHeader.slice(7).trim();
  }

  const rawHeaderUid = String(req.headers['x-lekho-uid'] || '').trim();

  // 1. If Bearer token is provided, verify it against Firebase Auth
  if (bearerToken) {
    const verified = await verifyFirebaseIdToken(bearerToken);
    if (!verified.valid || !verified.uid) {
      return {
        authenticated: false,
        status: 401,
        response: {
          success: false,
          errorCode: verified.errorCode || 'INVALID_TOKEN',
          message: verified.message || 'অথেন্টিকেশন টোকেন অবৈধ বা মেয়াদোত্তীর্ণ। পুনরায় লগইন করুন।',
          error: verified.error || 'Invalid or expired Firebase ID token',
        },
      };
    }
    return {
      authenticated: true,
      requester: {
        uid: verified.uid,
        email: verified.email,
        isTokenVerified: true,
        bearerToken,
      },
    };
  }

  // 2. Fallback to x-lekho-uid (allowed for local tests/sessions where token is not provided)
  if (rawHeaderUid) {
    return {
      authenticated: true,
      requester: {
        uid: rawHeaderUid,
        isTokenVerified: false,
      },
    };
  }

  return {
    authenticated: false,
    status: 401,
    response: {
      success: false,
      errorCode: 'UNAUTHORIZED',
      message: 'অননুমোদিত অনুরোধ। কোনো লগইন টোকেন বা ইউজার আইডি পাওয়া যায়নি।',
      error: 'Unauthorized: Missing Authorization header or x-lekho-uid',
    },
  };
}

async function resolveStore(
  shopId: string,
  requester: AuthRequester,
  optionalStoreInfo?: any
): Promise<{
  store?: any;
  errorResponse?: { status: number; body: { success: boolean; errorCode: string; message: string; error: string } };
}> {
  const db = readServerStoreDB();
  let store = db.tenants[shopId];

  // 1. Check default seed stores if not present in db
  if (!store) {
    if (shopId === 'shop_galleria_sports') {
      store = {
        id: 'shop_galleria_sports',
        name: 'Galleria Sports BD',
        bengaliName: 'গ্যালারিয়া স্পোর্টস বিডি',
        ownerName: 'Mahmudul Hasan',
        ownerEmail: 'galleria.sports.bd@gmail.com',
        ownerPhone: '01711223344',
        ownerUid: requester.uid,
        category: 'jersey',
        shopCategory: 'SPORTS WEAR',
        ownerPinConfigured: false,
        bottomPriceProtectionEnabled: true,
      };
      db.tenants[shopId] = store;
      writeServerStoreDB(db);
    } else if (shopId === 'shop_vogue_apparel') {
      store = {
        id: 'shop_vogue_apparel',
        name: 'Vogue Denim & Panjabi House',
        bengaliName: 'ভোগ ডেনিম ও পাঞ্জাবি হাউস',
        ownerName: 'Rafiqul Islam',
        ownerEmail: 'vogue.denim.bd@gmail.com',
        ownerPhone: '01819556677',
        ownerUid: requester.uid,
        category: 'clothing',
        shopCategory: 'CLOTHING',
        ownerPinConfigured: false,
        bottomPriceProtectionEnabled: true,
      };
      db.tenants[shopId] = store;
      writeServerStoreDB(db);
    }
  }

  // 2. Check if client passed store payload (from currentTenant state)
  if (!store && optionalStoreInfo && (optionalStoreInfo.id === shopId || optionalStoreInfo.name)) {
    store = {
      ...optionalStoreInfo,
      id: shopId,
      ownerUid: optionalStoreInfo.ownerUid || requester.uid,
      ownerPinConfigured: optionalStoreInfo.ownerPinConfigured ?? false,
      bottomPriceProtectionEnabled: optionalStoreInfo.bottomPriceProtectionEnabled ?? true,
    };
    db.tenants[shopId] = store;
    writeServerStoreDB(db);
  }

  // 3. If still not in db and Bearer token is available, query Firestore REST API
  if (!store && requester.bearerToken) {
    try {
      const config = getFirebaseConfig();
      const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/${config.firestoreDatabaseId}/documents/shops/${encodeURIComponent(shopId)}`;
      const res = await fetch(firestoreUrl, {
        headers: { Authorization: `Bearer ${requester.bearerToken}` },
      });
      if (res.ok) {
        const docData = (await res.json()) as any;
        if (docData && docData.fields) {
          const parsedShop: any = { id: shopId };
          for (const [k, v] of Object.entries<any>(docData.fields)) {
            if (v.stringValue !== undefined) parsedShop[k] = v.stringValue;
            else if (v.booleanValue !== undefined) parsedShop[k] = v.booleanValue;
            else if (v.integerValue !== undefined) parsedShop[k] = Number(v.integerValue);
            else if (v.doubleValue !== undefined) parsedShop[k] = Number(v.doubleValue);
          }
          parsedShop.ownerUid = parsedShop.ownerUid || requester.uid;
          db.tenants[shopId] = parsedShop;
          writeServerStoreDB(db);
          store = parsedShop;
        }
      }
    } catch (err) {
      console.warn('[Server] Firestore shop lookup error:', err);
    }
  }

  // If still not found
  if (!store) {
    return {
      errorResponse: {
        status: 404,
        body: {
          success: false,
          errorCode: 'STORE_NOT_FOUND',
          message: 'দোকানটির তথ্য সার্ভারে পাওয়া যায়নি। পৃষ্ঠাটি রিফ্রেশ করে পুনরায় চেষ্টা করুন।',
          error: `Store ${shopId} not found on server`,
        },
      },
    };
  }

  // Auto-bind ownerUid if it was undefined
  if (!store.ownerUid) {
    store.ownerUid = requester.uid;
    db.tenants[shopId] = store;
    writeServerStoreDB(db);
  }

  return { store };
}

function isShopOwnerAuthorized(store: any, requesterUid: string): boolean {
  if (!store.ownerUid) return true;
  if (store.ownerUid === requesterUid) return true;
  if (store.memberRoles && store.memberRoles[requesterUid] === 'shop_owner') return true;
  if (store.memberUids && Array.isArray(store.memberUids) && store.memberUids.includes(requesterUid)) {
    if (!store.memberRoles || store.memberRoles[requesterUid] !== 'salesman') return true;
  }
  return false;
}

// 1. PIN Status & Lockout check
app.get('/api/shops/:shopId/owner-pin/status', async (req: Request, res: Response): Promise<void> => {
  const { shopId } = req.params;
  const authRes = await authenticateRequest(req);
  if (!authRes.authenticated || !authRes.requester) {
    res.status(authRes.status || 401).json(authRes.response);
    return;
  }

  const { store, errorResponse } = await resolveStore(shopId, authRes.requester);
  if (errorResponse) {
    res.status(errorResponse.status).json(errorResponse.body);
    return;
  }

  const requesterUid = authRes.requester.uid;
  const isMember =
    store.ownerUid === requesterUid ||
    (Array.isArray(store.memberUids) && store.memberUids.includes(requesterUid));
  if (!isMember) {
    res.status(403).json({
      success: false,
      errorCode: 'FORBIDDEN_NOT_MEMBER',
      message: 'এই দোকানের তথ্যে প্রবেশাধিকার নেই।',
      error: 'Forbidden: Not a member of this shop',
    });
    return;
  }

  const clientKey = pinLockoutTracker.getKey(shopId, getClientIp(req));
  const lockout = pinLockoutTracker.checkLockout(clientKey);

  res.json({
    success: true,
    isConfigured: Boolean(store.ownerPinHash || store.ownerPinConfigured),
    protectionEnabled: store.bottomPriceProtectionEnabled !== false,
    isLockedOut: lockout.isLocked,
    remainingLockSeconds: lockout.remainingLockSeconds,
    remainingAttempts: lockout.remainingAttempts,
  });
});

// 2. First-time Owner PIN Setup (Shop Owner only)
app.post('/api/shops/:shopId/owner-pin/setup', async (req: Request, res: Response): Promise<void> => {
  const { shopId } = req.params;
  const authRes = await authenticateRequest(req);
  if (!authRes.authenticated || !authRes.requester) {
    res.status(authRes.status || 401).json(authRes.response);
    return;
  }

  const { pin, confirmPin, storeInfo } = req.body;
  const { store, errorResponse } = await resolveStore(shopId, authRes.requester, storeInfo);
  if (errorResponse) {
    res.status(errorResponse.status).json(errorResponse.body);
    return;
  }

  const requesterUid = authRes.requester.uid;
  if (!isShopOwnerAuthorized(store, requesterUid)) {
    res.status(403).json({
      success: false,
      errorCode: 'FORBIDDEN_ROLE',
      message: 'শুধুমাত্র দোকানের স্বত্বাধিকারী (Shop Owner) সিকিউরিটি পিন সেট করতে পারবেন।',
      error: 'Forbidden: Only the Shop Owner can setup Owner PIN',
    });
    return;
  }

  const cleanPin = String(pin || '').trim();
  const cleanConfirm = String(confirmPin || '').trim();

  if (!/^\d{4}$/.test(cleanPin)) {
    res.status(400).json({
      success: false,
      errorCode: 'INVALID_FORMAT',
      message: 'PIN অবশ্যই ৪ সংখ্যার (4-digit numeric) হতে হবে।',
      error: 'PIN must be a 4-digit number',
    });
    return;
  }

  if (cleanPin !== cleanConfirm) {
    res.status(400).json({
      success: false,
      errorCode: 'PIN_MISMATCH',
      message: 'উভয় ঘরে প্রদত্ত পিন নম্বর একই হতে হবে।',
      error: 'PIN confirmation does not match',
    });
    return;
  }

  if (['0000', '1234', '5555', '9999', '1111', '2222'].includes(cleanPin)) {
    res.status(400).json({
      success: false,
      errorCode: 'WEAK_PIN',
      message: 'নিরাপত্তার স্বার্থে সাধারণ বা অনুমানযোগ্য পিন (যেমন ১২৩৪, ০০০০) ব্যবহার করা যাবে না।',
      error: 'Weak PIN is not allowed',
    });
    return;
  }

  const salt = generatePinSalt();
  const hash = hashOwnerPin(cleanPin, salt);

  const db = readServerStoreDB();
  store.ownerPinHash = hash;
  store.ownerPinSalt = salt;
  store.ownerPinConfigured = true;
  store.bottomPriceProtectionEnabled = store.bottomPriceProtectionEnabled ?? true;
  store.ownerPinUpdatedAt = new Date().toISOString();
  store.ownerPin = '';
  db.tenants[shopId] = store;
  writeServerStoreDB(db);

  floorOverrideVault.invalidateTokensForShop(shopId);

  securityAuditLogger.record({
    shopId,
    action: 'pin_setup',
    actorUid: requesterUid,
    actorEmail: authRes.requester.email || store.ownerEmail || store.email,
    actorRole: 'shop_owner',
    details: {
      note: 'Initial Owner 4-digit PIN setup completed',
      ipAddress: getClientIp(req),
    },
  });

  res.json({
    success: true,
    message: 'Store Owner ৪-ডিজিট সিকিউরিটি পিন সফলভাবে সংরক্ষিত হয়েছে।',
  });
});

// 3. Change Owner PIN (Requires current PIN + new PIN confirmation)
app.post('/api/shops/:shopId/owner-pin/change', async (req: Request, res: Response): Promise<void> => {
  const { shopId } = req.params;
  const authRes = await authenticateRequest(req);
  if (!authRes.authenticated || !authRes.requester) {
    res.status(authRes.status || 401).json(authRes.response);
    return;
  }

  const { currentPin, newPin, confirmPin, storeInfo } = req.body;
  const clientKey = pinLockoutTracker.getKey(shopId, getClientIp(req));
  const lockout = pinLockoutTracker.checkLockout(clientKey);
  if (lockout.isLocked) {
    res.status(429).json({
      success: false,
      isLocked: true,
      remainingLockSeconds: lockout.remainingLockSeconds,
      errorCode: 'LOCKOUT_ACTIVE',
      message: `অতিরিক্ত ভুল পিন চেষ্টার কারণে লকআউট সক্রিয় রয়েছে। আরও ${lockout.remainingLockSeconds} সেকেন্ড পর চেষ্টা করুন।`,
      error: 'PIN verification temporarily locked out',
    });
    return;
  }

  const { store, errorResponse } = await resolveStore(shopId, authRes.requester, storeInfo);
  if (errorResponse) {
    res.status(errorResponse.status).json(errorResponse.body);
    return;
  }

  const requesterUid = authRes.requester.uid;
  if (!isShopOwnerAuthorized(store, requesterUid)) {
    res.status(403).json({
      success: false,
      errorCode: 'FORBIDDEN_ROLE',
      message: 'শুধুমাত্র দোকানের স্বত্বাধিকারী (Shop Owner) পিন পরিবর্তন করতে পারবেন।',
      error: 'Forbidden: Only the Shop Owner can change owner PIN',
    });
    return;
  }

  const cleanCurrent = String(currentPin || '').trim();
  const cleanNew = String(newPin || '').trim();
  const cleanConfirm = String(confirmPin || '').trim();

  let isCurrentValid = false;
  if (store.ownerPinHash && store.ownerPinSalt) {
    isCurrentValid = verifyPinHash(cleanCurrent, store.ownerPinHash, store.ownerPinSalt);
  } else if (store.ownerPin) {
    isCurrentValid = cleanCurrent === store.ownerPin;
  }

  if (!isCurrentValid) {
    const failStatus = pinLockoutTracker.recordFailure(clientKey);
    securityAuditLogger.record({
      shopId,
      action: 'pin_attempt_lockout',
      actorUid: requesterUid,
      actorRole: 'shop_owner',
      details: {
        reason: 'Incorrect current PIN entered during change attempt',
        isLocked: failStatus.isLocked,
        remainingAttempts: failStatus.remainingAttempts,
        ipAddress: getClientIp(req),
      },
    });

    res.status(400).json({
      success: false,
      isLocked: failStatus.isLocked,
      remainingAttempts: failStatus.remainingAttempts,
      remainingLockSeconds: failStatus.remainingLockSeconds,
      errorCode: 'INVALID_CURRENT_PIN',
      message: failStatus.isLocked
        ? `অতিরিক্ত ভুল পিন চেষ্টার কারণে ১ মিনিটের লকআউট সক্রিয় হয়েছে।`
        : `বর্তমান পিন সঠিক নয়। আর ${failStatus.remainingAttempts} বার চেষ্টা করা যাবে।`,
      error: 'Current PIN is invalid',
    });
    return;
  }

  pinLockoutTracker.recordSuccess(clientKey);

  if (!/^\d{4}$/.test(cleanNew)) {
    res.status(400).json({
      success: false,
      errorCode: 'INVALID_FORMAT',
      message: 'নতুন PIN অবশ্যই ৪ সংখ্যার (4-digit numeric) হতে হবে।',
      error: 'PIN must be a 4-digit number',
    });
    return;
  }

  if (cleanNew !== cleanConfirm) {
    res.status(400).json({
      success: false,
      errorCode: 'PIN_MISMATCH',
      message: 'নতুন পিন ও কনফার্ম পিন মিলছে না।',
      error: 'PIN confirmation does not match',
    });
    return;
  }

  if (['0000', '1234', '5555', '9999', '1111', '2222'].includes(cleanNew)) {
    res.status(400).json({
      success: false,
      errorCode: 'WEAK_PIN',
      message: 'অনুমানযোগ্য সাধারণ পিন ব্যবহার করা যাবে না।',
      error: 'Weak PIN is not allowed',
    });
    return;
  }

  const salt = generatePinSalt();
  const hash = hashOwnerPin(cleanNew, salt);

  const db = readServerStoreDB();
  store.ownerPinHash = hash;
  store.ownerPinSalt = salt;
  store.ownerPinConfigured = true;
  store.ownerPinUpdatedAt = new Date().toISOString();
  store.ownerPin = '';
  db.tenants[shopId] = store;
  writeServerStoreDB(db);

  floorOverrideVault.invalidateTokensForShop(shopId);

  securityAuditLogger.record({
    shopId,
    action: 'pin_change',
    actorUid: requesterUid,
    actorEmail: authRes.requester.email || store.ownerEmail || store.email,
    actorRole: 'shop_owner',
    details: {
      note: 'Owner PIN successfully changed. All prior override sessions invalidated.',
      ipAddress: getClientIp(req),
    },
  });

  res.json({
    success: true,
    message: 'Owner PIN সফলভাবে পরিবর্তন হয়েছে এবং পূর্বের সকল সেশন বাতিল করা হয়েছে।',
  });
});

// 4. Reset Owner PIN via Verified Reauthentication
app.post('/api/shops/:shopId/owner-pin/reset', async (req: Request, res: Response): Promise<void> => {
  const { shopId } = req.params;
  const authRes = await authenticateRequest(req);
  if (!authRes.authenticated || !authRes.requester) {
    res.status(authRes.status || 401).json(authRes.response);
    return;
  }

  const { newPin, confirmPin, ownerPassword, verifiedResetToken, storeInfo } = req.body;
  const { store, errorResponse } = await resolveStore(shopId, authRes.requester, storeInfo);
  if (errorResponse) {
    res.status(errorResponse.status).json(errorResponse.body);
    return;
  }

  const requesterUid = authRes.requester.uid;
  if (!isShopOwnerAuthorized(store, requesterUid)) {
    res.status(403).json({
      success: false,
      errorCode: 'FORBIDDEN_ROLE',
      message: 'শুধুমাত্র আসল দোকানের মালিক পিন রিসেট করতে পারবেন।',
      error: 'Forbidden: Only the Shop Owner can reset PIN',
    });
    return;
  }

  let isIdentityVerified = false;
  if (authRes.requester.isTokenVerified && (store.ownerUid === requesterUid || !store.ownerUid)) {
    // Verified Firebase ID Token belongs to shop owner
    isIdentityVerified = true;
  } else if (ownerPassword && store.ownerPasswordHash) {
    const candidateHash = crypto.createHmac('sha256', 'lekho_pwd_salt').update(String(ownerPassword).trim()).digest('hex');
    isIdentityVerified = candidateHash === store.ownerPasswordHash;
  } else if (ownerPassword && store.password) {
    isIdentityVerified = String(ownerPassword).trim() === store.password;
  } else if (verifiedResetToken) {
    isIdentityVerified = otpEngine.consumeVerificationToken(
      store.ownerEmail || store.email || '',
      'password_reset',
      String(verifiedResetToken)
    );
  } else {
    // Authenticated Shop Owner session
    isIdentityVerified = Boolean(requesterUid && store.ownerUid === requesterUid);
  }

  if (!isIdentityVerified) {
    res.status(401).json({
      success: false,
      errorCode: 'IDENTITY_VERIFICATION_FAILED',
      message: 'মালিকের পরিচয় যাচাই ব্যর্থ হয়েছে। সঠিক পাসওয়ার্ড বা ভেরিফিকেশন প্রদান করুন।',
      error: 'Identity verification failed',
    });
    return;
  }

  const cleanNew = String(newPin || '').trim();
  const cleanConfirm = String(confirmPin || '').trim();

  if (!/^\d{4}$/.test(cleanNew)) {
    res.status(400).json({
      success: false,
      errorCode: 'INVALID_FORMAT',
      message: 'নতুন PIN অবশ্যই ৪ সংখ্যার হতে হবে।',
      error: 'PIN must be a 4-digit number',
    });
    return;
  }

  if (cleanNew !== cleanConfirm) {
    res.status(400).json({
      success: false,
      errorCode: 'PIN_MISMATCH',
      message: 'নতুন পিন ও কনফার্ম পিন মিলছে না।',
      error: 'PIN confirmation does not match',
    });
    return;
  }

  if (['0000', '1234', '5555', '9999', '1111', '2222'].includes(cleanNew)) {
    res.status(400).json({
      success: false,
      errorCode: 'WEAK_PIN',
      message: 'অনুমানযোগ্য সাধারণ পিন ব্যবহার করা যাবে না।',
      error: 'Weak PIN is not allowed',
    });
    return;
  }

  const salt = generatePinSalt();
  const hash = hashOwnerPin(cleanNew, salt);

  const db = readServerStoreDB();
  store.ownerPinHash = hash;
  store.ownerPinSalt = salt;
  store.ownerPinConfigured = true;
  store.ownerPinUpdatedAt = new Date().toISOString();
  store.ownerPin = '';
  db.tenants[shopId] = store;
  writeServerStoreDB(db);

  floorOverrideVault.invalidateTokensForShop(shopId);
  const clientKey = pinLockoutTracker.getKey(shopId, getClientIp(req));
  pinLockoutTracker.resetLockout(clientKey);

  securityAuditLogger.record({
    shopId,
    action: 'pin_reset',
    actorUid: requesterUid,
    actorEmail: authRes.requester.email || store.ownerEmail || store.email,
    actorRole: 'shop_owner',
    details: {
      note: 'Owner PIN reset via verified identity reauthentication. All prior authorizations invalidated.',
      ipAddress: getClientIp(req),
    },
  });

  res.json({
    success: true,
    message: 'Owner PIN সফলভাবে রিসেট হয়েছে। নতুন পিন ব্যবহার করে কাউন্টার আনলক করতে পারবেন।',
  });
});

// 5. Toggle Bottom Price PIN Protection (ON/OFF)
app.post('/api/shops/:shopId/owner-pin/toggle-protection', async (req: Request, res: Response): Promise<void> => {
  const { shopId } = req.params;
  const authRes = await authenticateRequest(req);
  if (!authRes.authenticated || !authRes.requester) {
    res.status(authRes.status || 401).json(authRes.response);
    return;
  }

  const { enabled, storeInfo } = req.body;
  const { store, errorResponse } = await resolveStore(shopId, authRes.requester, storeInfo);
  if (errorResponse) {
    res.status(errorResponse.status).json(errorResponse.body);
    return;
  }

  const requesterUid = authRes.requester.uid;
  if (!isShopOwnerAuthorized(store, requesterUid)) {
    res.status(403).json({
      success: false,
      errorCode: 'FORBIDDEN_ROLE',
      message: 'শুধুমাত্র দোকানের স্বত্বাধিকারী বটম-প্রাইস প্রোটেকশন চালু বা বন্ধ করতে পারবেন।',
      error: 'Forbidden: Only the Shop Owner can toggle bottom price protection',
    });
    return;
  }

  const prevStatus = store.bottomPriceProtectionEnabled !== false;
  const newStatus = Boolean(enabled);

  const db = readServerStoreDB();
  store.bottomPriceProtectionEnabled = newStatus;
  store.updatedAt = new Date().toISOString();
  db.tenants[shopId] = store;
  writeServerStoreDB(db);

  floorOverrideVault.invalidateTokensForShop(shopId);

  securityAuditLogger.record({
    shopId,
    action: 'protection_toggle',
    actorUid: requesterUid,
    actorEmail: authRes.requester.email || store.ownerEmail || store.email,
    actorRole: 'shop_owner',
    details: {
      previousStatus: prevStatus,
      newStatus,
      note: newStatus
        ? 'Owner enabled Bottom Price PIN Protection (Salesmen require PIN for below-floor sales)'
        : 'Owner disabled Bottom Price PIN Protection (Below-floor sales allowed without entering PIN)',
      ipAddress: getClientIp(req),
    },
  });

  res.json({
    success: true,
    protectionEnabled: newStatus,
    message: newStatus
      ? 'Bottom Price PIN Protection চালু করা হয়েছে। ফ্লোর প্রাইসের নিচে বিক্রিতে ওনার পিন লাগবে।'
      : 'Bottom Price PIN Protection নিষ্ক্রিয় করা হয়েছে। ওনার পিন ছাড়াই ফ্লোর প্রাইসের নিচে বিল তৈরি করা যাবে।',
  });
});

// 6. Authorize Below-Floor Single-Use Token (Server verification with lockout)
app.post('/api/shops/:shopId/owner-pin/authorize-override', async (req: Request, res: Response): Promise<void> => {
  const { shopId } = req.params;
  const authRes = await authenticateRequest(req);
  if (!authRes.authenticated || !authRes.requester) {
    res.status(authRes.status || 401).json(authRes.response);
    return;
  }

  const { pin, productId, productName, attemptedRate, quantity, bottomPrice, storeInfo } = req.body;
  const clientKey = pinLockoutTracker.getKey(shopId, getClientIp(req));
  const lockout = pinLockoutTracker.checkLockout(clientKey);
  if (lockout.isLocked) {
    res.status(429).json({
      success: false,
      isLocked: true,
      remainingLockSeconds: lockout.remainingLockSeconds,
      errorCode: 'LOCKOUT_ACTIVE',
      message: `অতিরিক্ত ভুল পিন চেষ্টার কারণে লকআউট সক্রিয় রয়েছে। অনুগ্রহ করে আরও ${lockout.remainingLockSeconds} সেকেন্ড অপেক্ষা করুন।`,
      error: 'PIN authorization temporarily locked out',
    });
    return;
  }

  const { store, errorResponse } = await resolveStore(shopId, authRes.requester, storeInfo);
  if (errorResponse) {
    res.status(errorResponse.status).json(errorResponse.body);
    return;
  }

  const requesterUid = authRes.requester.uid;
  const isMember =
    store.ownerUid === requesterUid ||
    (Array.isArray(store.memberUids) && store.memberUids.includes(requesterUid));
  if (!isMember) {
    res.status(403).json({
      success: false,
      errorCode: 'FORBIDDEN_NOT_MEMBER',
      message: 'অননুমোদিত একাউন্ট। এই দোকানে ডিসকাউন্ট অনুমোদনের অধিকার নেই।',
      error: 'Forbidden: Cross-shop authorization denied',
    });
    return;
  }

  if (!store.ownerPinHash && !store.ownerPin) {
    res.status(400).json({
      success: false,
      errorCode: 'PIN_NOT_CONFIGURED',
      message: 'এই দোকানে ওনার পিন কনফিগার করা হয়নি। Settings থেকে ওনার পিন সেট করুন।',
      error: 'Owner PIN is not configured for this shop',
    });
    return;
  }

  const cleanPin = String(pin || '').trim();
  let isValid = false;
  if (store.ownerPinHash && store.ownerPinSalt) {
    isValid = verifyPinHash(cleanPin, store.ownerPinHash, store.ownerPinSalt);
  } else if (store.ownerPin) {
    isValid = cleanPin === store.ownerPin;
  }

  if (!isValid) {
    const failStatus = pinLockoutTracker.recordFailure(clientKey);
    securityAuditLogger.record({
      shopId,
      action: 'pin_attempt_lockout',
      actorUid: requesterUid,
      actorRole: 'cashier',
      details: {
        reason: 'Failed Owner PIN attempt at counter discount lock',
        attemptedRate: Number(attemptedRate),
        bottomPrice: Number(bottomPrice),
        productId,
        isLocked: failStatus.isLocked,
        remainingAttempts: failStatus.remainingAttempts,
        ipAddress: getClientIp(req),
      },
    });

    res.status(401).json({
      success: false,
      isLocked: failStatus.isLocked,
      remainingAttempts: failStatus.remainingAttempts,
      remainingLockSeconds: failStatus.remainingLockSeconds,
      errorCode: 'INVALID_PIN',
      message: failStatus.isLocked
        ? 'ভুল পিন দেওয়ার কারণে ১ মিনিটের জন্য লকআউট করা হয়েছে।'
        : `ভুল ওনার পিন। আর ${failStatus.remainingAttempts} বার চেষ্টা করা যাবে।`,
      error: 'Invalid Owner PIN',
    });
    return;
  }

  pinLockoutTracker.recordSuccess(clientKey);

  const overrideToken = floorOverrideVault.issueToken({
    shopId,
    productId: String(productId),
    minApprovedRate: Number(attemptedRate) || 0,
    maxQuantity: Number(quantity) || 1,
    authorizerUid: store.ownerUid || requesterUid,
    authorizerRole: store.ownerUid === requesterUid ? 'shop_owner' : 'counter_authorized_by_pin',
  });

  securityAuditLogger.record({
    shopId,
    action: 'override_approved',
    actorUid: requesterUid,
    actorRole: store.ownerUid === requesterUid ? 'shop_owner' : 'salesman_with_pin',
    details: {
      productId,
      productName,
      attemptedRate: Number(attemptedRate),
      bottomPrice: Number(bottomPrice),
      quantity: Number(quantity) || 1,
      tokenSnippet: overrideToken.token.slice(-6),
      ipAddress: getClientIp(req),
    },
  });

  res.json({
    success: true,
    overrideToken: overrideToken.token,
    expiresAt: overrideToken.expiresAt,
    message: 'Store Owner অনুমোদন নিশ্চিত হয়েছে (এককালীন সিঙ্গেল-ইউজ টোকেন ইস্যু করা হলো)।',
  });
});

// 7. Trusted Server Invoice Verification & Creation
app.post('/api/shops/:shopId/invoices/create', async (req: Request, res: Response): Promise<void> => {
  const { shopId } = req.params;
  const authRes = await authenticateRequest(req);
  if (!authRes.authenticated || !authRes.requester) {
    res.status(authRes.status || 401).json(authRes.response);
    return;
  }

  const { invoice, overrideTokens, storeInfo } = req.body;
  if (!invoice) {
    res.status(400).json({
      success: false,
      errorCode: 'MISSING_INVOICE',
      message: 'ইনভয়েস ডেটা অনুপস্থিত।',
      error: 'Invoice payload is required',
    });
    return;
  }

  const { store, errorResponse } = await resolveStore(shopId, authRes.requester, storeInfo);
  if (errorResponse) {
    res.status(errorResponse.status).json(errorResponse.body);
    return;
  }

  const requesterUid = authRes.requester.uid;
  const isMember =
    store.ownerUid === requesterUid ||
    (Array.isArray(store.memberUids) && store.memberUids.includes(requesterUid));
  if (!isMember) {
    res.status(403).json({
      success: false,
      errorCode: 'FORBIDDEN_NOT_MEMBER',
      message: 'অননুমোদিত একাউন্ট। এই দোকানে ইনভয়েস তৈরির অধিকার নেই।',
      error: 'Forbidden: Not a member of this shop',
    });
    return;
  }

  const isProtectionEnabled = store.bottomPriceProtectionEnabled !== false;
  const items = Array.isArray(invoice.items) ? invoice.items : [];
  let hasBelowFloorDiscount = false;

  for (const item of items) {
    const rate = Number(item.rate) || 0;
    const bottom = Number(item.bottomPrice) || 0;
    if (bottom > 0 && rate < bottom) {
      hasBelowFloorDiscount = true;
      if (isProtectionEnabled) {
        const tokenStr =
          (overrideTokens && (overrideTokens[item.id] || overrideTokens[item.productId])) ||
          item.overrideToken;

        if (!tokenStr) {
          res.status(400).json({
            success: false,
            errorCode: 'BOTTOM_PRICE_VIOLATION',
            message: `বিক্রয় প্রত্যাখ্যান: "${item.title}"-এর মূল্য (৳${rate}) বটম প্রাইস (৳${bottom})-এর চেয়ে কম। ওনার পিন ভেরিফিকেশন ছাড়া বিক্রি সম্ভব নয়।`,
            error: `Bottom price violation on item ${item.title}`,
          });
          return;
        }

        const consume = floorOverrideVault.verifyAndConsumeToken({
          token: tokenStr,
          shopId,
          productId: item.productId,
          rate,
          quantity: item.quantity || 1,
          invoiceId: invoice.id || invoice.invoiceNo,
        });

        if (!consume.valid) {
          res.status(403).json({
            success: false,
            errorCode: 'INVALID_OVERRIDE_TOKEN',
            message: `নিরাপত্তা ত্রুটি: বটম-প্রাইস অনুমোদন টোকেনটি অবৈধ বা ইতিমধ্যে ব্যবহৃত হয়েছে (${consume.reason})`,
            error: consume.reason || 'Invalid override token',
          });
          return;
        }
      } else {
        securityAuditLogger.record({
          shopId,
          action: 'below_floor_sale',
          actorUid: requesterUid,
          actorRole: 'salesman',
          details: {
            invoiceNo: invoice.invoiceNo,
            productId: item.productId,
            productName: item.title,
            rate,
            bottomPrice: bottom,
            quantity: item.quantity,
            protectionStatus: 'OFF',
            ipAddress: getClientIp(req),
          },
        });
      }
    }
  }

  invoice.hasBelowFloorDiscount = hasBelowFloorDiscount;
  invoice.ownerPinAuthorized = hasBelowFloorDiscount;

  res.json({
    success: true,
    invoice,
    message: 'Invoice successfully verified and authorized.',
  });
});

// 8. Immutable Security Audit Log (Owner & Super Admin only)
app.get('/api/shops/:shopId/audit-logs', async (req: Request, res: Response): Promise<void> => {
  const { shopId } = req.params;
  const authRes = await authenticateRequest(req);
  if (!authRes.authenticated || !authRes.requester) {
    res.status(authRes.status || 401).json(authRes.response);
    return;
  }

  const { store, errorResponse } = await resolveStore(shopId, authRes.requester);
  if (errorResponse) {
    res.status(errorResponse.status).json(errorResponse.body);
    return;
  }

  const requesterUid = authRes.requester.uid;
  const isOwner = store.ownerUid === requesterUid || (store.memberRoles && store.memberRoles[requesterUid] === 'shop_owner');
  if (!isOwner) {
    res.status(403).json({
      success: false,
      errorCode: 'FORBIDDEN_ROLE',
      message: 'সিকিউরিটি অডিট হিস্টোরি শুধুমাত্র দোকানের মালিক (Shop Owner) দেখতে পারবেন।',
      error: 'Forbidden: Only the Shop Owner can view audit logs',
    });
    return;
  }

  const logs = securityAuditLogger.getLogsForShop(shopId, 100);
  res.json({ success: true, logs });
});

// 9. Server-Side Partner & Withdrawal Password Management (Owner & Super Admin Only)
app.get('/api/shops/:shopId/partners', async (req: Request, res: Response): Promise<void> => {
  const { shopId } = req.params;
  const authRes = await authenticateRequest(req);
  if (!authRes.authenticated || !authRes.requester) {
    res.status(authRes.status || 401).json(authRes.response);
    return;
  }
  const { store, errorResponse } = await resolveStore(shopId, authRes.requester);
  if (errorResponse) {
    res.status(errorResponse.status).json(errorResponse.body);
    return;
  }
  if (!isShopOwnerAuthorized(store, authRes.requester.uid)) {
    res.status(403).json({
      success: false,
      errorCode: 'FORBIDDEN_ROLE',
      message: 'শুধুমাত্র দোকানের মালিক (Shop Owner) পার্টনারদের তথ্য দেখতে পারবেন।',
    });
    return;
  }
  const partners = Array.isArray(store.partners) ? store.partners : [];
  const safePartners = partners.map((p: any) => ({
    id: p.id,
    shopId: p.shopId || shopId,
    name: p.name,
    role: p.role,
    sharePercentage: p.sharePercentage,
    totalWithdrawn: p.totalWithdrawn || 0,
    totalDeposited: p.totalDeposited || 0,
    password: '',
    hasPasswordSet: Boolean(p.passwordHash || p.password),
  }));
  res.json({ success: true, partners: safePartners });
});

app.post('/api/shops/:shopId/partners/verify-password', async (req: Request, res: Response): Promise<void> => {
  const { shopId } = req.params;
  const authRes = await authenticateRequest(req);
  if (!authRes.authenticated || !authRes.requester) {
    res.status(authRes.status || 401).json(authRes.response);
    return;
  }
  const { partnerId, password, storeInfo } = req.body;
  const { store, errorResponse } = await resolveStore(shopId, authRes.requester, storeInfo);
  if (errorResponse) {
    res.status(errorResponse.status).json(errorResponse.body);
    return;
  }
  if (!isShopOwnerAuthorized(store, authRes.requester.uid)) {
    res.status(403).json({
      success: false,
      errorCode: 'FORBIDDEN_ROLE',
      message: 'শুধুমাত্র দোকানের মালিক (Shop Owner) পার্টনার লেনদেন অনুমোদন করতে পারবেন।',
    });
    return;
  }
  const partners = Array.isArray(store.partners) ? store.partners : [];
  const target = partners.find((p: any) => p.id === partnerId);
  if (!target) {
    res.status(404).json({
      success: false,
      errorCode: 'PARTNER_NOT_FOUND',
      message: 'পার্টনার একাউন্ট পাওয়া যায়নি।',
    });
    return;
  }
  const cleanPwd = String(password || '').trim();
  let verified = false;
  if (target.passwordHash && target.passwordSalt) {
    verified = verifyPinHash(cleanPwd, target.passwordHash, target.passwordSalt);
  } else if (target.password) {
    verified = cleanPwd === String(target.password).trim();
  }
  if (!verified) {
    res.status(401).json({
      success: false,
      verified: false,
      errorCode: 'INVALID_PARTNER_PASSWORD',
      message: 'ভুল পার্টনার পাসওয়ার্ড! লেনদেন বাতিল করা হয়েছে।',
    });
    return;
  }
  res.json({ success: true, verified: true });
});

// 10. Server-Side Staff Counter PIN Verification (Never exposes Staff PINs)
app.post('/api/shops/:shopId/staff/verify-pin', async (req: Request, res: Response): Promise<void> => {
  const { shopId } = req.params;
  const authRes = await authenticateRequest(req);
  if (!authRes.authenticated || !authRes.requester) {
    res.status(authRes.status || 401).json(authRes.response);
    return;
  }
  const { staffId, pin } = req.body;
  const { store, errorResponse } = await resolveStore(shopId, authRes.requester);
  if (errorResponse) {
    res.status(errorResponse.status).json(errorResponse.body);
    return;
  }
  const requesterUid = authRes.requester.uid;
  const isMember =
    store.ownerUid === requesterUid ||
    (Array.isArray(store.memberUids) && store.memberUids.includes(requesterUid));
  if (!isMember) {
    res.status(403).json({
      success: false,
      errorCode: 'FORBIDDEN_NOT_MEMBER',
      message: 'এই দোকানের তথ্যে প্রবেশাধিকার নেই।',
    });
    return;
  }
  const staffList = Array.isArray(store.staffList) ? store.staffList : [];
  const cleanPin = String(pin || '').trim();
  const matched = staffList.find((s: any) => {
    if (s.active === false) return false;
    if (staffId && s.id !== staffId) return false;
    if (s.pinHash && s.pinSalt) {
      return verifyPinHash(cleanPin, s.pinHash, s.pinSalt);
    }
    return Boolean(s.pin && String(s.pin).trim() === cleanPin);
  });
  if (!matched) {
    res.status(401).json({
      success: false,
      verified: false,
      errorCode: 'INVALID_STAFF_PIN',
      message: 'ভুল কাউন্টার পিন।',
    });
    return;
  }
  res.json({
    success: true,
    verified: true,
    staff: {
      id: matched.id,
      name: matched.name,
      role: matched.role,
    },
  });
});


// ==========================================
// VITE DEV SERVER / STATIC SERVING
// ==========================================
async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get(/.*/, (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SERVER] LEKHO POS Server running at http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[SERVER ERROR] Failed to start server:', err);
});
