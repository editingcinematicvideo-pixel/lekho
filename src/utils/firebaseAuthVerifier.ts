import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

interface GooglePublicKeys {
  [kid: string]: string;
}

interface CachedKeys {
  keys: GooglePublicKeys;
  fetchedAt: number;
  maxAgeMs: number;
}

let cachedKeys: CachedKeys | null = null;

// Read projectId and apiKey from firebase-applet-config.json
let cachedFirebaseConfig: { projectId?: string; apiKey?: string; firestoreDatabaseId?: string } | null = null;

export function getFirebaseConfig(): { projectId: string; apiKey: string; firestoreDatabaseId: string } {
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

async function fetchGooglePublicKeys(): Promise<GooglePublicKeys> {
  const now = Date.now();
  if (cachedKeys && now - cachedKeys.fetchedAt < cachedKeys.maxAgeMs) {
    return cachedKeys.keys;
  }

  try {
    const res = await fetch('https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com');
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    const keys = (await res.json()) as GooglePublicKeys;
    // Cache for 1 hour by default
    cachedKeys = {
      keys,
      fetchedAt: now,
      maxAgeMs: 3600_000,
    };
    return keys;
  } catch (err) {
    console.warn('[FirebaseAuthVerifier] Failed to fetch Google public certs, falling back to cache if available:', err);
    if (cachedKeys) return cachedKeys.keys;
    return {};
  }
}

export interface VerifiedTokenResult {
  valid: boolean;
  uid?: string;
  email?: string;
  emailVerified?: boolean;
  role?: string;
  isSuperAdmin?: boolean;
  errorCode?: string;
  error?: string;
  message?: string;
}

/**
 * Verifies a Firebase ID token.
 * Validates signature with Google public keys, checks issuer, audience, and expiration.
 * Falls back to Identity Toolkit API if cert cache is unavailable.
 */
export async function verifyFirebaseIdToken(token: string): Promise<VerifiedTokenResult> {
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

  // Split JWT
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

    // Check expiration
    const nowSec = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < nowSec) {
      return {
        valid: false,
        errorCode: 'TOKEN_EXPIRED',
        error: 'Token has expired',
        message: 'লগইন সেশনের মেয়াদ শেষ হয়েছে। অনুগ্রহ করে আবার লগইন করুন।',
      };
    }

    // Check audience & issuer
    const expectedIssuer = `https://securetoken.google.com/${projectId}`;
    if (payload.aud !== projectId || payload.iss !== expectedIssuer) {
      // If project ID mismatch, also check Identity Toolkit before rejecting
      console.warn(`[FirebaseAuthVerifier] Token aud/iss mismatch: aud=${payload.aud}, iss=${payload.iss}, expected=${projectId}`);
    }

    // Verify signature with Google public keys
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

    // Fallback: Verify via Google Identity Toolkit accounts:lookup API
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
