import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { authService } from '../../services/authService';
import { OfficialShopCategory } from '../../types';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Store,
  User,
  Phone,
  Sparkles,
  TrendingUp,
  Package,
  PieChart,
  CheckCircle2,
  ShieldCheck,
  Building2,
  Shirt,
  ShoppingBag,
  ArrowLeft,
  KeyRound,
  Users,
  RefreshCw,
  AlertCircle,
  Clock,
  Send,
  HelpCircle,
} from 'lucide-react';

export type AuthMode =
  | 'landing'
  | 'merchant_login'
  | 'merchant_signup'
  | 'merchant_otp'
  | 'forgot_password'
  | 'reset_password'
  | 'staff_login'
  | 'staff_otp';

interface AuthPageProps {
  onSuccess?: () => void;
  onBypass?: () => void;
  initialMode?: AuthMode;
}

export const AuthPage: React.FC<AuthPageProps> = ({
  onSuccess,
  onBypass,
  initialMode = 'landing',
}) => {
  const { syncFromAuthSession, showToast } = useApp();

  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // 1. Merchant Sign In state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // 2. Merchant Sign Up state
  const [fullName, setFullName] = useState('');
  const [shopName, setShopName] = useState('');
  const [shopCategory, setShopCategory] = useState<OfficialShopCategory>('SPORTS WEAR');
  const [phone, setPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // 3. OTP verification state
  const [otpTargetEmail, setOtpTargetEmail] = useState('');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [otpCountdown, setOtpCountdown] = useState(300); // 5 minutes
  const [resendCooldown, setResendCooldown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [devOtpBadge, setDevOtpBadge] = useState<string | null>(null);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // 4. Password Recovery state
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetOtp, setResetOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  // 5. Staff Sign In state
  const [staffEmail, setStaffEmail] = useState('');
  const [staffPassword, setStaffPassword] = useState('');

  // Timer effect for OTP countdown (5 mins) & resend cooldown (60s)
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (mode === 'merchant_otp' || mode === 'staff_otp') {
      timer = setInterval(() => {
        setOtpCountdown((prev) => (prev > 0 ? prev - 1 : 0));
        setResendCooldown((prev) => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [mode]);

  // Format MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // ----------------------------------------------------
  // ACTION: MERCHANT REGISTRATION SUBMISSION
  // ----------------------------------------------------
  const handleMerchantSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    // Field Validations
    if (!fullName.trim()) {
      setErrorMessage('Please enter your full name (আপনার পূর্ণ নাম লিখুন)');
      return;
    }
    if (!shopName.trim()) {
      setErrorMessage('Please enter your shop name (দোকানের নাম লিখুন)');
      return;
    }
    if (!phone.trim()) {
      setErrorMessage('Please enter your mobile phone number (মোবাইল নম্বর লিখুন)');
      return;
    }
    // BD phone validation (11 digits, starts with 01)
    const cleanPhone = phone.trim().replace(/[- ]/g, '');
    if (!/^01[3-9]\d{8}$/.test(cleanPhone)) {
      setErrorMessage('Please enter a valid 11-digit Bangladeshi mobile number (e.g. 017xxxxxxxx)');
      return;
    }
    // Gmail / Email validation
    const cleanEmail = regEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMessage('Please enter a valid Gmail address (সঠিক জিমেইল এড্রেস লিখুন)');
      return;
    }
    // Password validation (min 6 chars)
    if (regPassword.length < 6) {
      setErrorMessage('Password must be at least 6 characters long (পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে)');
      return;
    }
    if (regPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match (উভয় পাসওয়ার্ড হুবহু এক হতে হবে)');
      return;
    }

    setIsLoading(true);

    try {
      const res = await authService.initiateMerchantRegistration({
        fullName: fullName.trim(),
        shopName: shopName.trim(),
        shopCategory,
        phone: cleanPhone,
        email: cleanEmail,
        password: regPassword,
      });

      setIsLoading(false);

      if (res.success) {
        if ((res as any).directCreated && (res as any).session) {
          syncFromAuthSession();
          showToast(res.message, 'success');
          if (onSuccess) onSuccess();
          return;
        }
        setOtpTargetEmail(cleanEmail);
        setOtpDigits(['', '', '', '', '', '']);
        setOtpCountdown(300);
        setResendCooldown(60);
        setCanResend(false);
        setDevOtpBadge(res.devOtp || null);
        setSuccessMessage(res.message);
        setMode('merchant_otp');
        showToast('6-digit OTP code sent to your Gmail inbox!', 'success');
      } else {
        setErrorMessage(res.message);
      }
    } catch (err: any) {
      setIsLoading(false);
      setErrorMessage(err.message || 'Registration failed. Please check details and try again.');
    }
  };

  // ----------------------------------------------------
  // ACTION: GOOGLE SIGN-IN / SIGN-UP
  // ----------------------------------------------------
  const handleGoogleSignIn = async () => {
    setErrorMessage('');
    setSuccessMessage('');
    setIsLoading(true);
    try {
      const res = await authService.signInWithGoogle(
        mode === 'merchant_signup' && shopName.trim() && phone.trim()
          ? {
              fullName: fullName.trim() || undefined,
              shopName: shopName.trim(),
              shopCategory,
              phone: phone.trim().replace(/[- ]/g, ''),
            }
          : undefined
      );
      setIsLoading(false);

      if (res.success && res.session) {
        syncFromAuthSession();
        showToast(res.message, 'success');
        if (onSuccess) onSuccess();
        return;
      }

      if (res.needsShopSetup && res.googleProfile) {
        if (res.googleProfile.name && !fullName) setFullName(res.googleProfile.name);
        if (res.googleProfile.email) setRegEmail(res.googleProfile.email);
        setSuccessMessage(res.message);
        setMode('merchant_signup');
        return;
      }

      if (!res.success) {
        setErrorMessage(res.message);
      }
    } catch (err: any) {
      setIsLoading(false);
      setErrorMessage(err.message || 'Google Sign-In failed.');
    }
  };

  // ----------------------------------------------------
  // ACTION: OTP INPUT HANDLING
  // ----------------------------------------------------
  const handleOtpDigitChange = (index: number, value: string) => {
    const val = value.replace(/\D/g, '').slice(-1);
    const updated = [...otpDigits];
    updated[index] = val;
    setOtpDigits(updated);

    // Auto advance focus to next box
    if (val && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }

    // Auto-submit if all 6 boxes filled
    if (val && index === 5 && updated.every((d) => d !== '')) {
      verifySubmittedOTP(updated.join(''));
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasteData) return;
    const updated = [...otpDigits];
    for (let i = 0; i < pasteData.length; i++) {
      updated[i] = pasteData[i];
    }
    setOtpDigits(updated);
    if (pasteData.length === 6) {
      verifySubmittedOTP(pasteData);
    } else {
      otpInputRefs.current[pasteData.length]?.focus();
    }
  };

  const verifySubmittedOTP = async (code: string) => {
    setErrorMessage('');
    setSuccessMessage('');

    if (code.length !== 6) {
      setErrorMessage('Please enter the complete 6-digit OTP code.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await authService.verifyMerchantRegistration(otpTargetEmail, code);
      setIsLoading(false);

      if (res.success && res.session) {
        syncFromAuthSession();
        showToast(`Email verified! Welcome to ${res.session.shopName}.`, 'success');
        if (onSuccess) onSuccess();
      } else {
        setErrorMessage(res.message);
      }
    } catch (err: any) {
      setIsLoading(false);
      setErrorMessage(err.message || 'OTP verification failed.');
    }
  };

  // Resend OTP
  const handleResendOTP = async () => {
    if (!canResend) return;
    setErrorMessage('');
    setIsLoading(true);

    const res = await authService.resendOTP(otpTargetEmail, 'merchant_registration');
    setIsLoading(false);

    if (res.success) {
      setOtpCountdown(300);
      setResendCooldown(60);
      setCanResend(false);
      setDevOtpBadge(res.devOtp || null);
      setSuccessMessage(res.message);
      showToast('A new OTP code has been sent to your Gmail inbox.', 'info');
    } else {
      setErrorMessage(res.message);
    }
  };

  // ----------------------------------------------------
  // ACTION: MERCHANT LOGIN SUBMISSION
  // ----------------------------------------------------
  const handleMerchantLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!loginEmail.trim()) {
      setErrorMessage('Please enter your Gmail address (জিমেইল দিন)');
      return;
    }
    if (!loginPassword.trim()) {
      setErrorMessage('Please enter your password (পাসওয়ার্ড দিন)');
      return;
    }

    setIsLoading(true);

    try {
      const res = await authService.loginMerchant(loginEmail.trim(), loginPassword.trim());
      setIsLoading(false);

      if (res.success && res.session) {
        syncFromAuthSession();
        showToast(res.message, 'success');
        if (onSuccess) onSuccess();
      } else {
        setErrorMessage(res.message);
        if (res.needsVerification && res.email) {
          setOtpTargetEmail(res.email);
        }
      }
    } catch (err: any) {
      setIsLoading(false);
      setErrorMessage(err.message || 'Login failed. Please check credentials.');
    }
  };

  // ----------------------------------------------------
  // ACTION: STAFF LOGIN SUBMISSION
  // ----------------------------------------------------
  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!staffEmail.trim()) {
      setErrorMessage('Please enter your staff Gmail address');
      return;
    }
    if (!staffPassword.trim()) {
      setErrorMessage('Please enter your staff password');
      return;
    }

    setIsLoading(true);

    try {
      const res = await authService.loginStaff(staffEmail.trim(), staffPassword.trim());
      setIsLoading(false);

      if (res.success && res.session) {
        syncFromAuthSession();
        showToast(res.message, 'success');
        if (onSuccess) onSuccess();
      } else {
        setErrorMessage(res.message);
      }
    } catch (err: any) {
      setIsLoading(false);
      setErrorMessage(err.message || 'Staff login failed. Please try again.');
    }
  };

  // ----------------------------------------------------
  // ACTION: FORGOT & RESET PASSWORD
  // ----------------------------------------------------
  const handleForgotRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!forgotEmail.trim()) {
      setErrorMessage('অনুগ্রহ করে আপনার নিবন্ধিত জিমেইল ঠিকানা দিন (Please enter your registered Gmail address)');
      return;
    }

    setIsLoading(true);
    const res = await authService.initiatePasswordReset(forgotEmail.trim());
    setIsLoading(false);

    if (res.success) {
      setDevOtpBadge(null);
      setSuccessMessage(res.message);
      setLoginEmail(forgotEmail.trim());
      showToast('পাসওয়ার্ড রিসেট লিংক আপনার জিমেইল ইনবক্সে পাঠানো হয়েছে।', 'success');
    } else {
      setErrorMessage(res.message);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!resetOtp.trim()) {
      setErrorMessage('Please enter the 6-digit verification code received on Gmail');
      return;
    }
    if (newPassword.length < 6) {
      setErrorMessage('New password must be at least 6 characters long');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setErrorMessage('Passwords do not match');
      return;
    }

    setIsLoading(true);
    const res = await authService.completePasswordReset(forgotEmail.trim(), resetOtp.trim(), newPassword);
    setIsLoading(false);

    if (res.success) {
      showToast(res.message, 'success');
      setMode('merchant_login');
      setLoginEmail(forgotEmail.trim());
      setLoginPassword('');
    } else {
      setErrorMessage(res.message);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-[#f8faf9] dark:bg-zinc-950 font-sans text-slate-800 dark:text-zinc-100 overflow-x-hidden selection:bg-[#164e3f] selection:text-white">
      {/* =========================================================================
          LEFT HERO PANEL: BRAND COVER PHOTO & VALUE PROPOSITIONS
         ========================================================================= */}
      <div className="relative w-full h-64 sm:h-80 lg:h-auto lg:w-[50%] xl:w-[48%] bg-[#0e382d] text-white flex flex-col justify-between overflow-hidden shrink-0 shadow-2xl">
        {/* Cover Photo Artwork */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
          <img
            src="/assets/aistudio/image_a4e83847.png"
            alt="LEKHO Merchant Portal Cover"
            className="w-full h-full object-cover object-left opacity-95 filter brightness-100 contrast-105"
          />
          {/* Subtle gradient vignette */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0e382d]/90 via-transparent to-[#0e382d]/40 lg:hidden" />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-[#0e382d]/15 hidden lg:block" />
        </div>

        {/* Spacer */}
        <div className="flex-1" />
      </div>

      {/* =========================================================================
          RIGHT AUTH INTERFACE: AUTH LANDING, FORMS, OTP, RESET
         ========================================================================= */}
      <div className="flex-1 flex flex-col justify-center items-center p-4 sm:p-8 lg:p-12 xl:p-16 relative">
        <div className="w-full max-w-[480px] space-y-6">

          {/* Dev OTP Helper Banner (Dispatched securely for easy review) */}
          {devOtpBadge && (mode === 'merchant_otp' || mode === 'reset_password' || mode === 'staff_otp') && (
            <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs flex items-center justify-between shadow-xs animate-in fade-in">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <span>
                  <strong>Server OTP Dispatched:</strong> <code className="font-mono font-bold text-sm bg-white dark:bg-zinc-900 px-2 py-0.5 rounded border border-amber-300">{devOtpBadge}</code>
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const digits = devOtpBadge.split('').slice(0, 6);
                  setOtpDigits(digits);
                  verifySubmittedOTP(devOtpBadge);
                }}
                className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] cursor-pointer"
              >
                Auto Fill
              </button>
            </div>
          )}

          {/* Global Error Banner */}
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 dark:bg-rose-950/50 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span>{errorMessage}</span>
                {errorMessage.includes('not been verified') && otpTargetEmail && (
                  <button
                    type="button"
                    onClick={() => setMode('merchant_otp')}
                    className="block mt-1 font-bold underline text-rose-800 dark:text-rose-200 cursor-pointer"
                  >
                    Enter 6-digit OTP code now →
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Global Success Banner */}
          {successMessage && !errorMessage && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/50 dark:border-emerald-900 text-emerald-800 dark:text-emerald-200 text-xs flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* =====================================================================
              VIEW 1: AUTHENTICATION LANDING PAGE (Three Clear Options)
             ===================================================================== */}
          {mode === 'landing' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="text-center sm:text-left">
                <h1 className="text-2xl sm:text-3xl font-black text-[#0e382d] dark:text-emerald-400 tracking-tight">
                  Welcome, Merchant!
                </h1>
              </div>

              {/* Three Clear Options */}
              <div className="space-y-2.5">
                {/* 1. Log In (Existing Shop Owners) */}
                <button
                  type="button"
                  onClick={() => {
                    setMode('merchant_login');
                    setErrorMessage('');
                  }}
                  className="w-full px-4 py-3.5 rounded-2xl bg-white dark:bg-zinc-900 border-2 border-slate-200 dark:border-zinc-800 hover:border-[#164e3f] dark:hover:border-emerald-500 transition-all text-left shadow-sm hover:shadow-md flex items-center justify-between group cursor-pointer active:scale-[0.99]"
                >
                  <span className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                    Merchant Log In
                  </span>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-[#164e3f] dark:group-hover:text-emerald-400 transition-transform group-hover:translate-x-1 shrink-0" />
                </button>

                {/* 2. Sign Up / Create New Account */}
                <button
                  type="button"
                  onClick={() => {
                    setMode('merchant_signup');
                    setErrorMessage('');
                  }}
                  className="w-full px-4 py-3.5 rounded-2xl bg-white dark:bg-zinc-900 border-2 border-slate-200 dark:border-zinc-800 hover:border-[#164e3f] dark:hover:border-emerald-500 transition-all text-left shadow-sm hover:shadow-md flex items-center justify-between group cursor-pointer active:scale-[0.99]"
                >
                  <span className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                    Sign Up / Create New Account
                  </span>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-[#164e3f] dark:group-hover:text-emerald-400 transition-transform group-hover:translate-x-1 shrink-0" />
                </button>

                {/* 3. Staff Log In */}
                <button
                  type="button"
                  onClick={() => {
                    setMode('staff_login');
                    setErrorMessage('');
                  }}
                  className="w-full px-4 py-3.5 rounded-2xl bg-white dark:bg-zinc-900 border-2 border-slate-200 dark:border-zinc-800 hover:border-[#164e3f] dark:hover:border-emerald-500 transition-all text-left shadow-sm hover:shadow-md flex items-center justify-between group cursor-pointer active:scale-[0.99]"
                >
                  <span className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                    Staff Log In
                  </span>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-[#164e3f] dark:group-hover:text-emerald-400 transition-transform group-hover:translate-x-1 shrink-0" />
                </button>

                {/* 4. Quick Google Sign-In */}
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isLoading}
                  className="w-full py-3.5 px-5 rounded-3xl bg-[#0e382d] hover:bg-[#164e3f] text-white font-bold text-sm flex items-center justify-center gap-3 shadow-lg transition-all cursor-pointer active:scale-[0.99] disabled:opacity-60"
                >
                  <Mail className="w-4 h-4 text-emerald-300" />
                  <span>Continue with Google (জিমেইল দিয়ে দ্রুত প্রবেশ করুন)</span>
                </button>

                {/* 5. Demo Store Instant Access */}
                <button
                  type="button"
                  onClick={() => {
                    const session: any = {
                      token: 'demo-token',
                      uid: 'demo_owner_vogue',
                      userType: 'merchant',
                      userId: 'demo_owner_vogue',
                      email: 'demo@lekho.com',
                      name: 'Tanvir Ahmed (Owner)',
                      phone: '01876217089',
                      shopId: 'shop_vogue_apparel',
                      shopName: 'Vogue Apparel',
                      category: 'clothing',
                      officialCategory: 'CLOTHING',
                      role: 'shop_owner',
                      isSuperAdminVerified: false,
                      authProvider: 'demo',
                      createdAt: new Date().toISOString(),
                      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                    };
                    authService.setSession(session);
                    syncFromAuthSession();
                    if (onBypass) onBypass();
                    else if (onSuccess) onSuccess();
                  }}
                  className="w-full py-2.5 px-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 text-[#164e3f] dark:text-emerald-300 font-bold text-xs flex items-center justify-center gap-2 border border-emerald-300 dark:border-emerald-800 transition cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>ডেমো স্টোর এক্সেস (Explore Demo Store)</span>
                </button>
              </div>
            </div>
          )}

          {/* =====================================================================
              VIEW 2: MERCHANT LOG IN
             ===================================================================== */}
          {mode === 'merchant_login' && (
            <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-5 animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
                <button
                  type="button"
                  onClick={() => setMode('landing')}
                  className="text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200 flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode('merchant_signup')}
                  className="text-xs font-bold text-[#164e3f] dark:text-emerald-400 hover:underline cursor-pointer"
                >
                  Create New Account
                </button>
              </div>

              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Merchant Log In
              </h2>

              <form onSubmit={handleMerchantLogin} className="space-y-4">
                {/* Gmail Address */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300">
                    Gmail Address *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="email"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="merchant@gmail.com"
                      className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#164e3f] transition"
                      required
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300">
                      Password *
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setForgotEmail(loginEmail);
                        setMode('forgot_password');
                        setErrorMessage('');
                      }}
                      className="text-xs font-semibold text-[#164e3f] dark:text-emerald-400 hover:underline cursor-pointer"
                    >
                      Forgot Password?
                    </button>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full pl-10 pr-11 py-3 rounded-2xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#164e3f] transition"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Submit CTA */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 px-4 rounded-2xl bg-[#0e382d] hover:bg-[#164e3f] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#0e382d]/20 transition-all cursor-pointer active:scale-[0.99] disabled:opacity-60"
                >
                  {isLoading ? (
                    <span className="inline-flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Authenticating...
                    </span>
                  ) : (
                    <>
                      <span>Log In to Dashboard</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                {/* Google Sign-In Button */}
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isLoading}
                  className="w-full py-3 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-100 font-bold text-xs flex items-center justify-center gap-2 border border-slate-200 dark:border-zinc-700 transition cursor-pointer"
                >
                  <Mail className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Sign In with Google (জিমেইল একাউন্ট দিয়ে লগইন)</span>
                </button>
              </form>

              {/* Switch to Staff Log In */}
              <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 text-center">
                <span className="text-xs text-slate-500 dark:text-zinc-400">
                  Are you an employee / cashier?{' '}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setMode('staff_login');
                    setErrorMessage('');
                  }}
                  className="text-xs font-bold text-[#164e3f] dark:text-emerald-400 hover:underline cursor-pointer"
                >
                  Staff Log In here
                </button>
              </div>
            </div>
          )}

          {/* =====================================================================
              VIEW 3: MERCHANT REGISTRATION FORM
             ===================================================================== */}
          {mode === 'merchant_signup' && (
            <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
                <button
                  type="button"
                  onClick={() => setMode('landing')}
                  className="text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200 flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode('merchant_login')}
                  className="text-xs font-bold text-[#164e3f] dark:text-emerald-400 hover:underline cursor-pointer"
                >
                  Already registered? Log In
                </button>
              </div>

              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Register Your Shop
              </h2>

              <form onSubmit={handleMerchantSignUp} className="space-y-3.5">
                {/* 1. Full Name */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300">
                    Full Name (মালিকের নাম) *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <User className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Tanvir Hossain"
                      className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#164e3f]"
                      required
                    />
                  </div>
                </div>

                {/* 2. Shop Name */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300">
                    Shop Name (দোকানের নাম) *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Store className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={shopName}
                      onChange={(e) => setShopName(e.target.value)}
                      placeholder="e.g. Premier Sportswear & Jersey"
                      className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#164e3f]"
                      required
                    />
                  </div>
                </div>

                {/* 3. Shop Category: EXACTLY TWO OPTIONS AS SPECIFIED */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300">
                    Shop Category (দোকানের ক্যাটাগরি) *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setShopCategory('CLOTHING')}
                      className={`p-3 rounded-2xl border-2 text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                        shopCategory === 'CLOTHING'
                          ? 'border-[#0e382d] bg-emerald-50 dark:bg-emerald-950/40 text-[#0e382d] dark:text-emerald-300 ring-1 ring-[#0e382d]'
                          : 'border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <ShoppingBag className="w-4 h-4" />
                      <span>CLOTHING</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShopCategory('SPORTS WEAR')}
                      className={`p-3 rounded-2xl border-2 text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                        shopCategory === 'SPORTS WEAR'
                          ? 'border-[#0e382d] bg-emerald-50 dark:bg-emerald-950/40 text-[#0e382d] dark:text-emerald-300 ring-1 ring-[#0e382d]'
                          : 'border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <Shirt className="w-4 h-4" />
                      <span>SPORTS WEAR</span>
                    </button>
                  </div>
                </div>

                {/* 4. Phone Number & 5. Gmail Address */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300">
                      Phone Number *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Phone className="w-3.5 h-3.5" />
                      </div>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="017xxxxxxxx"
                        className="w-full pl-9 pr-3 py-2.5 rounded-2xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#164e3f]"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300">
                      Gmail Address *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Mail className="w-3.5 h-3.5" />
                      </div>
                      <input
                        type="email"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="you@gmail.com"
                        className="w-full pl-9 pr-3 py-2.5 rounded-2xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#164e3f]"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* 6. Password & 7. Confirm Password */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300">
                      Password (min 6 chars) *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Lock className="w-3.5 h-3.5" />
                      </div>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="Password"
                        className="w-full pl-9 pr-8 py-2.5 rounded-2xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#164e3f]"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300">
                      Confirm Password *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Lock className="w-3.5 h-3.5" />
                      </div>
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm"
                        className="w-full pl-9 pr-8 py-2.5 rounded-2xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#164e3f]"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 cursor-pointer"
                      >
                        {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Primary CTA */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full mt-2 py-3.5 px-4 rounded-2xl bg-[#0e382d] hover:bg-[#164e3f] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#0e382d]/20 transition-all cursor-pointer active:scale-[0.99] disabled:opacity-60"
                >
                  {isLoading ? (
                    <span className="inline-flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Generating 6-Digit OTP...
                    </span>
                  ) : (
                    <>
                      <span>Create Account & Send Gmail OTP</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* =====================================================================
              VIEW 4: GMAIL OTP VERIFICATION SCREEN
             ===================================================================== */}
          {mode === 'merchant_otp' && (
            <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6 animate-in fade-in duration-200">
              <div className="text-center space-y-1">
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  Verify Your Gmail
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-sm mx-auto">
                  6-digit code sent to <strong className="text-slate-800 dark:text-zinc-200 font-mono text-sm">{otpTargetEmail}</strong>
                </p>
              </div>

              {/* 6 Individual Digit Inputs */}
              <div className="flex justify-center gap-2 sm:gap-3">
                {otpDigits.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => {
                      otpInputRefs.current[idx] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpDigitChange(idx, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                    onPaste={handleOtpPaste}
                    className="w-11 h-13 sm:w-13 sm:h-15 text-center text-xl sm:text-2xl font-mono font-black rounded-2xl border-2 border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-none focus:border-[#164e3f] dark:focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/15 transition shadow-2xs"
                  />
                ))}
              </div>

              {/* Expiry countdown & resend cooldown */}
              <div className="flex items-center justify-between text-xs px-2 text-slate-500 dark:text-zinc-400">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                  <span>
                    Expires in: <strong className="font-mono text-slate-700 dark:text-zinc-200">{formatTime(otpCountdown)}</strong>
                  </span>
                </div>

                <div>
                  {canResend ? (
                    <button
                      type="button"
                      onClick={handleResendOTP}
                      disabled={isLoading}
                      className="font-bold text-[#164e3f] dark:text-emerald-400 hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Resend OTP</span>
                    </button>
                  ) : (
                    <span>Resend in: <strong className="font-mono">{resendCooldown}s</strong></span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => verifySubmittedOTP(otpDigits.join(''))}
                  disabled={isLoading || otpDigits.some((d) => !d)}
                  className="w-full py-3.5 px-4 rounded-2xl bg-[#0e382d] hover:bg-[#164e3f] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#0e382d]/20 transition-all cursor-pointer active:scale-[0.99] disabled:opacity-50"
                >
                  {isLoading ? (
                    <span className="inline-flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Verifying with Server...
                    </span>
                  ) : (
                    <>
                      <span>Verify & Activate Shop</span>
                      <CheckCircle2 className="w-4 h-4" />
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setMode('merchant_signup')}
                  className="w-full py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200 transition cursor-pointer"
                >
                  ← Edit registration details / Change Email
                </button>
              </div>
            </div>
          )}

          {/* =====================================================================
              VIEW 5: STAFF LOG IN (Dedicated Employee / Cashier Portal)
             ===================================================================== */}
          {mode === 'staff_login' && (
            <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-5 animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
                <button
                  type="button"
                  onClick={() => setMode('landing')}
                  className="text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200 flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode('merchant_login')}
                  className="text-xs font-bold text-[#164e3f] dark:text-emerald-400 hover:underline cursor-pointer"
                >
                  Merchant Log In
                </button>
              </div>

              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Staff Log In
              </h2>

              <form onSubmit={handleStaffLogin} className="space-y-4">
                {/* Staff Gmail */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300">
                    Staff Gmail Address *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="email"
                      value={staffEmail}
                      onChange={(e) => setStaffEmail(e.target.value)}
                      placeholder="staff@gmail.com"
                      className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#164e3f] transition"
                      required
                    />
                  </div>
                </div>

                {/* Staff Password */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300">
                    Password *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={staffPassword}
                      onChange={(e) => setStaffPassword(e.target.value)}
                      placeholder="Enter staff password"
                      className="w-full pl-10 pr-11 py-3 rounded-2xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#164e3f] transition"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 px-4 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-600/20 transition-all cursor-pointer active:scale-[0.99] disabled:opacity-60"
                >
                  {isLoading ? (
                    <span className="inline-flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Authenticating Staff Session...
                    </span>
                  ) : (
                    <>
                      <span>Enter Staff Counter</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* =====================================================================
              VIEW 6: FORGOT PASSWORD REQUEST
             ===================================================================== */}
          {mode === 'forgot_password' && (
            <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-5 animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
                <button
                  type="button"
                  onClick={() => setMode('merchant_login')}
                  className="text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200 flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Log In</span>
                </button>
              </div>

              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Recover Password
              </h2>

              <form onSubmit={handleForgotRequest} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300">
                    Registered Gmail Address *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="merchant@gmail.com"
                      className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#164e3f] transition"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 px-4 rounded-2xl bg-[#0e382d] hover:bg-[#164e3f] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer disabled:opacity-60"
                >
                  {isLoading ? 'Sending Reset Link...' : 'Send Password Reset Link'}
                </button>
              </form>
            </div>
          )}

          {/* =====================================================================
              VIEW 7: RESET PASSWORD (NEW PASSWORD ENTRY)
             ===================================================================== */}
          {mode === 'reset_password' && (
            <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-5 animate-in fade-in duration-200">
              <div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  Set New Password
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  Enter the 6-digit verification code sent to <strong className="text-slate-800 dark:text-zinc-200 font-mono">{forgotEmail}</strong> and choose a new password
                </p>
              </div>

              <form onSubmit={handleResetSubmit} className="space-y-4">
                {/* 6-digit Reset OTP */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300">
                    6-Digit Verification Code *
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={resetOtp}
                    onChange={(e) => setResetOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="Enter 6-digit code"
                    className="w-full px-4 py-3 rounded-2xl font-mono text-center tracking-widest text-lg font-bold bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#164e3f]"
                    required
                  />
                </div>

                {/* New Password */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300">
                    New Password *
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#164e3f]"
                    required
                  />
                </div>

                {/* Confirm New Password */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300">
                    Confirm New Password *
                  </label>
                  <input
                    type="password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="Repeat new password"
                    className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#164e3f]"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 px-4 rounded-2xl bg-[#0e382d] hover:bg-[#164e3f] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer disabled:opacity-60"
                >
                  {isLoading ? 'Resetting Password...' : 'Save New Password & Log In'}
                </button>
              </form>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
