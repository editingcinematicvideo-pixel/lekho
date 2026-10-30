import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type { FloorOverrideToken, SecurityAuditLog } from '../types';

export function generatePinSalt(): string {
  return crypto.randomBytes(16).toString('hex');
}

export function hashOwnerPin(pin: string, salt: string): string {
  const cleanPin = String(pin || '').trim();
  const cleanSalt = String(salt || 'lekho_owner_pin_salt_default').trim();
  return crypto.createHmac('sha256', cleanSalt).update(cleanPin).digest('hex');
}

export function verifyPinHash(candidatePin: string, storedHash: string, salt: string): boolean {
  if (!candidatePin || !storedHash || !salt) return false;
  if (!/^\d{4}$/.test(candidatePin.trim())) return false;

  const candidateHash = hashOwnerPin(candidatePin, salt);
  const bufA = Buffer.from(candidateHash, 'hex');
  const bufB = Buffer.from(storedHash, 'hex');

  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export interface LockoutStatus {
  isLocked: boolean;
  remainingLockSeconds: number;
  remainingAttempts: number;
  failedAttempts: number;
}

export class LockoutTracker {
  private attempts = new Map<string, { failedAttempts: number; lockedUntilMs: number }>();
  private readonly maxAttempts: number;
  private readonly lockoutDurationMs: number;

  constructor(maxAttempts: number = 5, lockoutDurationMs: number = 60_000) {
    this.maxAttempts = maxAttempts;
    this.lockoutDurationMs = lockoutDurationMs;
  }

  getKey(shopId: string, ip: string = 'unknown'): string {
    return `${shopId}:${ip}`;
  }

  checkLockout(key: string, nowMs: number = Date.now()): LockoutStatus {
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

  recordFailure(key: string, nowMs: number = Date.now()): LockoutStatus {
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

  clearAll(): void {
    this.attempts.clear();
  }
}

export class FloorOverrideTokenVault {
  private tokens = new Map<string, FloorOverrideToken>();
  private readonly defaultTtlMs: number;

  constructor(defaultTtlMs: number = 300_000) { // 5 minutes
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

    // Mark as consumed immediately
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

  getToken(tokenString: string): FloorOverrideToken | undefined {
    return this.tokens.get(tokenString);
  }

  clearAll(): void {
    this.tokens.clear();
  }
}

export class AuditLogManager {
  private logsFile: string;
  private logs: SecurityAuditLog[] = [];

  constructor(filePath?: string) {
    this.logsFile = filePath || path.resolve(process.cwd(), '.lekho-audit-log.json');
    this.loadLogs();
  }

  private loadLogs(): void {
    try {
      if (fs.existsSync(this.logsFile)) {
        const raw = fs.readFileSync(this.logsFile, 'utf-8');
        this.logs = JSON.parse(raw);
      }
    } catch {
      this.logs = [];
    }
  }

  private saveLogs(): void {
    try {
      fs.writeFileSync(this.logsFile, JSON.stringify(this.logs, null, 2), 'utf-8');
    } catch {}
  }

  record(params: {
    shopId: string;
    action: SecurityAuditLog['action'];
    actorUid: string;
    actorRole: string;
    actorEmail?: string;
    details: SecurityAuditLog['details'];
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
    // Keep last 1000 logs in storage
    if (this.logs.length > 1000) {
      this.logs = this.logs.slice(0, 1000);
    }
    this.saveLogs();
    return entry;
  }

  getLogsForShop(shopId: string, limit: number = 50): SecurityAuditLog[] {
    return this.logs.filter((l) => l.shopId === shopId).slice(0, limit);
  }

  clearLogsForShop(shopId: string): void {
    this.logs = this.logs.filter((l) => l.shopId !== shopId);
    this.saveLogs();
  }
}
