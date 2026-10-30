import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { StaffMember, OwnerAccount, DrawerType, TenantShop, StoreConfiguration } from '../../types';
import { dbService } from '../../services/db';
import { TrashBinModal } from '../inventory/TrashBinModal';
import {
  Store,
  Users,
  KeyRound,
  ShieldCheck,
  TrendingUp,
  DollarSign,
  Package,
  Trash2,
  Plus,
  Save,
  Check,
  Building2,
  FileText,
  Lock,
  Eye,
  EyeOff,
  Percent,
  Phone,
  Shield,
  Smartphone,
  CreditCard,
  UserCheck,
  X,
  AlertCircle,
  Coins,
  Printer,
  Sliders,
  Download,
  Upload,
  Sparkles,
  CheckCircle2,
  Globe,
  Truck,
  ExternalLink,
  Code2,
  Image as ImageIcon,
  Edit2,
  CheckCircle,
  RefreshCw,
  Info,
  QrCode,
  Tag,
  ArrowLeft,
  Mail,
  ChevronRight,
  HelpCircle,
  BookOpen,
  Sun,
  Moon,
  Search,
  LayoutGrid,
} from 'lucide-react';
import { CategorySettingsTab } from './CategorySettingsTab';
import { InfoTooltip } from '../ui/InfoTooltip';
import { OwnerSecuritySettingsCard } from './OwnerSecuritySettingsCard';
import { LekhoHelpCenter } from '../help/LekhoHelpCenter';
import { authService } from '../../services/authService';
import {
  canAccessSettingsTab,
  canEditStoreProfile,
  canManageOperators,
  canManagePartners,
  canViewProfitMetrics,
  evaluateSubscriptionStatus,
  getVisibleSettingsGroupsForRole,
  isClothingShop,
  resolveAuthorizedSettingsTab,
  SettingsTabId,
} from '../../utils/securityPolicy';

interface StoreSettingsProps {
  initialTab?: string;
  openHubTrigger?: number;
  onOpenOnboarding?: () => void;
  onBack?: () => void;
  onNavigationStateChange?: (state: {
    showSettingsHub: boolean;
    activeSettingsTab: SettingsTabId;
  }) => void;
}

export const StoreSettings: React.FC<StoreSettingsProps> = ({
  initialTab,
  openHubTrigger,
  onOpenOnboarding,
  onBack,
  onNavigationStateChange,
}) => {
  const {
    currentTenant,
    tenants,
    switchTenant,
    reloadShopData,
    showToast,
    activeStaff,
    role,
    theme,
    toggleTheme,
    language,
    setLanguage,
    pickText,
  } = useApp();
  const isClothingStore = isClothingShop(currentTenant);
  const showFinancialHealth = canViewProfitMetrics(role);
  const canEditProfile = canEditStoreProfile(role);
  const visibleGroups = getVisibleSettingsGroupsForRole(role);

  const [storeConfig, setStoreConfig] = useState<StoreConfiguration>(() =>
    dbService.getStoreConfig(currentTenant.id)
  );

  useEffect(() => {
    setStoreConfig(dbService.getStoreConfig(currentTenant.id));
  }, [currentTenant.id]);

  // Settings Hub mode vs Subpage mode:
  // If no initialTab or initialTab === 'hub', start on the clean 4-section Settings Hub.
  const [showSettingsHub, setShowSettingsHub] = useState<boolean>(
    () => !initialTab || initialTab === 'hub'
  );
  const [settingsSearch, setSettingsSearch] = useState<string>('');

  // Settings active sub-tab (strictly authorized for current role)
  const [activeSettingsTab, setActiveSettingsTab] = useState<SettingsTabId>(() =>
    resolveAuthorizedSettingsTab(role, initialTab && initialTab !== 'hub' ? initialTab : undefined)
  );

  useEffect(() => {
    if (!initialTab || initialTab === 'hub') {
      setShowSettingsHub(true);
    } else {
      setActiveSettingsTab(resolveAuthorizedSettingsTab(role, initialTab));
      setShowSettingsHub(false);
    }
  }, [initialTab, role]);

  useEffect(() => {
    if (openHubTrigger !== undefined && openHubTrigger > 0) {
      setShowSettingsHub(true);
    }
  }, [openHubTrigger]);

  useEffect(() => {
    onNavigationStateChange?.({
      showSettingsHub,
      activeSettingsTab,
    });
  }, [showSettingsHub, activeSettingsTab, onNavigationStateChange]);

  const openSettingsSubpage = (tabId: SettingsTabId) => {
    const resolved = resolveAuthorizedSettingsTab(role, tabId);
    setActiveSettingsTab(resolved);
    setShowSettingsHub(false);
    onNavigationStateChange?.({
      showSettingsHub: false,
      activeSettingsTab: resolved,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const returnToSettingsHub = () => {
    setShowSettingsHub(true);
    onNavigationStateChange?.({
      showSettingsHub: true,
      activeSettingsTab,
    });
  };

  // Store Profile & Owner Info state
  const [merchantId, setMerchantId] = useState(currentTenant.merchantId || '');
  const [ownerName, setOwnerName] = useState(currentTenant.ownerName || '');
  const [ownerEmail, setOwnerEmail] = useState(currentTenant.email || currentTenant.ownerEmail || '');
  const [ownerPhone, setOwnerPhone] = useState(currentTenant.ownerPhone || '');
  const [websiteUrl, setWebsiteUrl] = useState(currentTenant.websiteUrl || '');
  const [facebookUrl, setFacebookUrl] = useState(currentTenant.facebookUrl || '');
  const [shopName, setShopName] = useState(currentTenant.name);
  const [bengaliName, setBengaliName] = useState(currentTenant.bengaliName || '');
  const [marketMallName, setMarketMallName] = useState(currentTenant.marketMallName || '');
  const [shopNo, setShopNo] = useState(currentTenant.shopNo || '');
  const [ownerPin, setOwnerPin] = useState(currentTenant.ownerPin || '');
  const [logoPreview, setLogoPreview] = useState(currentTenant.logoUrl || '');
  const [isEditingLogo, setIsEditingLogo] = useState(false);
  const [newLogoUrlInput, setNewLogoUrlInput] = useState('');

  // Documents & Legal state
  const [binNumber, setBinNumber] = useState(currentTenant.paymentSettings?.binNumber || '');
  const [tradeLicenseNo, setTradeLicenseNo] = useState(
    currentTenant.paymentSettings?.tradeLicenseNo || ''
  );
  const [returnPolicy, setReturnPolicy] = useState(currentTenant.returnPolicy || '');

  // Payment Accounts & Numbers state
  const [bkashMerchant, setBkashMerchant] = useState(
    currentTenant.paymentSettings?.bkashMerchant || currentTenant.ownerPhone || ''
  );
  const [bkashPersonal, setBkashPersonal] = useState(
    currentTenant.paymentSettings?.bkashPersonal || ''
  );
  const [nagadNumber, setNagadNumber] = useState(
    currentTenant.paymentSettings?.nagad || ''
  );
  const [bankName, setBankName] = useState(
    currentTenant.paymentSettings?.bankName || ''
  );
  const [bankBranch, setBankBranch] = useState(
    currentTenant.paymentSettings?.bankBranch || ''
  );
  const [bankAccountNo, setBankAccountNo] = useState(
    currentTenant.paymentSettings?.bankAccountNo || ''
  );
  const [bankRoutingNo, setBankRoutingNo] = useState(
    currentTenant.paymentSettings?.routingNo || ''
  );

  // Courier & Developer API state
  const [courierProvider, setCourierProvider] = useState<'steadfast' | 'pathao' | 'both'>(
    currentTenant.courierSettings?.provider || 'both'
  );
  const [courierApiKey, setCourierApiKey] = useState(
    currentTenant.courierSettings?.apiKey || ''
  );
  const [courierApiSecret, setCourierApiSecret] = useState(
    currentTenant.courierSettings?.apiSecret || ''
  );
  const [courierWebhook, setCourierWebhook] = useState(
    currentTenant.courierSettings?.webhookUrl || ''
  );
  const [isCourierTesting, setIsCourierTesting] = useState(false);

  // Print & Feature Preferences
  const [autoPrintReceipt, setAutoPrintReceipt] = useState(
    currentTenant.paymentSettings?.autoPrintReceipt ?? true
  );
  const [paperWidth, setPaperWidth] = useState<'80mm' | '58mm' | 'custom' | string>(
    currentTenant.paymentSettings?.paperWidth || '80mm'
  );
  const [customPaperWidth, setCustomPaperWidth] = useState<number>(
    currentTenant.paymentSettings?.customPaperWidth || 76
  );

  // Invoice & Receipt Design state
  const [invoicePrefix, setInvoicePrefix] = useState(
    currentTenant.invoiceSettings?.invoicePrefix || 'INV-'
  );
  const [headerSlogan, setHeaderSlogan] = useState(
    currentTenant.invoiceSettings?.headerSlogan || `${currentTenant.name} — Official Retail Memo`
  );
  const [hotlinePhone, setHotlinePhone] = useState(
    currentTenant.invoiceSettings?.hotline || currentTenant.ownerPhone || ''
  );
  const [showBinOnInvoice, setShowBinOnInvoice] = useState(
    currentTenant.invoiceSettings?.showBinNumber ?? true
  );
  const [showSalesmanOnInvoice, setShowSalesmanOnInvoice] = useState(
    currentTenant.invoiceSettings?.showSalesmanName ?? true
  );
  const [showCustomDetailsOnInvoice, setShowCustomDetailsOnInvoice] = useState(
    currentTenant.invoiceSettings?.showCustomizationDetails ?? true
  );
  const [showQrCodeOnInvoice, setShowQrCodeOnInvoice] = useState(
    currentTenant.invoiceSettings?.showQrCode ?? true
  );
  const [qrCodeType, setQrCodeType] = useState<'verification' | 'bkash'>(
    currentTenant.invoiceSettings?.qrCodeType || 'verification'
  );
  const [footerThankYouNote, setFooterThankYouNote] = useState(
    currentTenant.invoiceSettings?.footerNote || 'ধন্যবাদ! আবার আসবেন। Thank you for shopping with us!'
  );
  const [invoiceReturnPolicy, setInvoiceReturnPolicy] = useState(
    currentTenant.invoiceSettings?.returnPolicyNote || currentTenant.returnPolicy
  );

  // Feature Flags
  const [flagJersey, setFlagJersey] = useState(currentTenant.featureFlags.jerseyCustomization ?? true);
  const [flagReseller, setFlagReseller] = useState(currentTenant.featureFlags.resellerCounter ?? true);
  const [flagTeam, setFlagTeam] = useState(currentTenant.featureFlags.teamBulkOrders ?? true);

  // Owners & Partners list (role-guarded)
  const [ownersList, setOwnersList] = useState<OwnerAccount[]>(() =>
    dbService.getShopOwners(currentTenant.id, role)
  );

  // New Owner / Partner modal state
  const [isAddOwnerOpen, setIsAddOwnerOpen] = useState(false);
  const [newOwnerName, setNewOwnerName] = useState('');
  const [newOwnerUsername, setNewOwnerUsername] = useState('');
  const [newOwnerPassword, setNewOwnerPassword] = useState('');
  const [newOwnerPhone, setNewOwnerPhone] = useState('');
  const [newOwnerShare, setNewOwnerShare] = useState<number>(50);
  const [ownerModalError, setOwnerModalError] = useState('');

  // Partner Password Change modal state (No plaintext reveal!)
  const [resetPartnerTarget, setResetPartnerTarget] = useState<OwnerAccount | null>(null);
  const [newPartnerPassInput, setNewPartnerPassInput] = useState('');
  const [confirmPartnerPassInput, setConfirmPartnerPassInput] = useState('');
  const [partnerPassError, setPartnerPassError] = useState('');

  // Operators / Staff list state (role-guarded)
  const [staffList, setStaffList] = useState<StaffMember[]>(() =>
    dbService.getShopStaff(currentTenant.id, role)
  );

  // Staff PIN Reset modal state (No plaintext PIN display!)
  const [resetStaffTarget, setResetStaffTarget] = useState<StaffMember | null>(null);
  const [newStaffResetPinInput, setNewStaffResetPinInput] = useState('');
  const [staffResetPinError, setStaffResetPinError] = useState('');

  useEffect(() => {
    setOwnersList(dbService.getShopOwners(currentTenant.id, role));
    setStaffList(dbService.getShopStaff(currentTenant.id, role));
  }, [currentTenant.id, role]);

  // New Operator modal state
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffUsername, setNewStaffUsername] = useState('');
  const [newStaffPin, setNewStaffPin] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<'salesman' | 'manager' | 'owner'>('salesman');
  const [newStaffCommission, setNewStaffCommission] = useState<number>(25);
  const [newStaffPhone, setNewStaffPhone] = useState('');
  const [newStaffBlindMode, setNewStaffBlindMode] = useState(true);
  const [isVerifyStaffOpen, setIsVerifyStaffOpen] = useState(false);
  const [pendingStaffEmail, setPendingStaffEmail] = useState('');
  const [staffOtpCode, setStaffOtpCode] = useState('');
  const [staffDevOtp, setStaffDevOtp] = useState<string | null>(null);

  // Trash bin modal
  const [isTrashOpen, setIsTrashOpen] = useState(false);

  // Financial summary (role-aware)
  const inventory = dbService.getInventory(currentTenant.id, role);
  const invoices = dbService.getInvoices(currentTenant.id, role);
  const expenses = dbService.getExpenses(currentTenant.id);
  const drawers = dbService.getShopDrawers(currentTenant.id);

  const totalInventoryValuation = showFinancialHealth
    ? inventory.reduce((acc, item) => acc + item.lotCostLandingPrice * item.totalStock, 0)
    : 0;
  const totalSalesRevenue = invoices.reduce((acc, inv) => acc + inv.total, 0);
  const totalCostOfGoods = showFinancialHealth
    ? invoices.reduce(
        (acc, inv) =>
          acc + inv.items.reduce((itemAcc, item) => itemAcc + item.costPrice * item.quantity, 0),
        0
      )
    : 0;
  const totalShopExpenses = expenses.reduce((acc, exp) => acc + exp.amount, 0);
  const estimatedNetProfit = showFinancialHealth
    ? Math.max(0, totalSalesRevenue - totalCostOfGoods - totalShopExpenses)
    : 0;

  // SAVE: Owner Profile (Image 4 Inspired)
  const handleSaveStoreProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditProfile) {
      showToast(
        pickText(
          'স্টোর প্রোফাইল পরিবর্তন শুধুমাত্র দোকানের মালিক (Shop Owner) করতে পারবেন।',
          'Only the Shop Owner can modify store profile settings.'
        ),
        'error'
      );
      return;
    }
    dbService.updateTenant(currentTenant.id, {
      name: shopName.trim(),
      bengaliName: bengaliName.trim() || undefined,
      ownerName: ownerName.trim(),
      ownerPhone: ownerPhone.trim(),
      email: ownerEmail.trim(),
      merchantId: merchantId.trim(),
      facebookUrl: facebookUrl.trim(),
      websiteUrl: websiteUrl.trim(),
      marketMallName: marketMallName.trim(),
      shopNo: shopNo.trim(),
      returnPolicy: returnPolicy.trim(),
      ownerPin: ownerPin.trim(),
      logoUrl: logoPreview.trim() || undefined,
      paymentSettings: {
        ...currentTenant.paymentSettings,
        binNumber: binNumber.trim(),
        tradeLicenseNo: tradeLicenseNo.trim(),
      },
    });
    reloadShopData();
    showToast(
      pickText(
        'দোকানের প্রোফাইল ও ওনার তথ্য সফলভাবে সংরক্ষিত হয়েছে!',
        'Store profile and owner details saved successfully!'
      ),
      'success'
    );
  };

  // SAVE: Payment Settings (Image 3 Inspired)
  const handleSavePaymentSettings = (e: React.FormEvent) => {
    e.preventDefault();
    dbService.updateTenant(currentTenant.id, {
      paymentSettings: {
        ...currentTenant.paymentSettings,
        bkashMerchant: bkashMerchant.trim(),
        bkashPersonal: bkashPersonal.trim(),
        nagad: nagadNumber.trim(),
        bankName: bankName.trim(),
        bankBranch: bankBranch.trim(),
        bankAccountNo: bankAccountNo.trim(),
        routingNo: bankRoutingNo.trim(),
      },
    });
    reloadShopData();
    showToast(
      pickText(
        'পেমেন্ট চ্যানেল ও ব্যাংক অ্যাকাউন্ট তথ্য সফলভাবে আপডেট হয়েছে!',
        'Payment channels and bank account details updated successfully!'
      ),
      'success'
    );
  };

  // SAVE: Courier & API Settings (Image 3 Inspired)
  const handleSaveCourierSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const hasCredentials = Boolean(courierApiKey.trim() && courierApiSecret.trim());
    dbService.updateTenant(currentTenant.id, {
      courierSettings: {
        provider: courierProvider,
        apiKey: courierApiKey.trim(),
        apiSecret: courierApiSecret.trim(),
        webhookUrl: courierWebhook.trim(),
        isConnected: hasCredentials,
      },
    });
    reloadShopData();
    showToast(
      hasCredentials
        ? pickText(
            'কুরিয়ার কনফিগারেশন সংরক্ষিত হয়েছে (Local Mode / Simulation)',
            'Courier configuration saved (Local Mode / Simulation)'
          )
        : pickText(
            'কুরিয়ার সেটিংস আপডেট হয়েছে (কোনো API Key/Secret দেওয়া হয়নি)',
            'Courier settings updated (No API Key/Secret provided)'
          ),
      'info'
    );
  };

  const handleTestCourierConnection = () => {
    setIsCourierTesting(true);
    setTimeout(() => {
      setIsCourierTesting(false);
      if (!courierApiKey.trim() || !courierApiSecret.trim()) {
        showToast(
          pickText(
            'API Key এবং API Secret খালি রয়েছে। বর্তমানে Local Parcel Entry / Simulation Mode চালু আছে।',
            'API Key and Secret are empty. Running in Local Parcel Entry / Simulation Mode.'
          ),
          'error'
        );
        return;
      }
      showToast(
        pickText(
          'Local Mode / Simulation: ক্রেডেনশিয়াল ফরম্যাট সঠিক, তবে বাহ্যিক সার্ভারে লাইভ API কল সংযুক্ত নয়।',
          'Local Mode / Simulation: Credential format is valid; live external API dispatch is not connected.'
        ),
        'info'
      );
    }, 600);
  };

  // SAVE: System & Print Preferences + Full StoreConfiguration
  const handleSavePreferences = (e: React.FormEvent) => {
    e.preventDefault();
    dbService.saveStoreConfig(currentTenant.id, storeConfig);
    dbService.updateTenant(currentTenant.id, {
      returnPolicy: returnPolicy.trim(),
      featureFlags: {
        ...currentTenant.featureFlags,
        jerseyCustomization: flagJersey,
        resellerCounter: flagReseller,
        teamBulkOrders: flagTeam,
      },
      paymentSettings: {
        ...currentTenant.paymentSettings,
        autoPrintReceipt,
        paperWidth,
        customPaperWidth,
      },
    });
    reloadShopData();
    showToast(
      pickText(
        'প্রিন্ট, ইনভেন্টরি ও সিস্টেম সেটিংস সফলভাবে সংরক্ষিত হয়েছে!',
        'Print, inventory & system settings saved successfully!'
      ),
      'success'
    );
  };

  // ADD OPERATOR WITH REAL GMAIL OTP VERIFICATION & FIREBASE AUTH CREATION
  const handleAddOperator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffName.trim() || !newStaffPin.trim()) {
      showToast('অপারেটরের নাম এবং লগইন পাসওয়ার্ড (কমপক্ষে ৬ অক্ষর) প্রদান করুন', 'error');
      return;
    }

    const emailToUse = newStaffEmail.trim().toLowerCase();
    if (!emailToUse || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailToUse)) {
      showToast('স্টাফ একাউন্ট তৈরির জন্য সঠিক জিমেইল এড্রেস প্রদান করা আবশ্যক', 'error');
      return;
    }

    if (newStaffPin.trim().length < 6) {
      showToast('স্টাফ লগইন পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে (প্রথম ৪ ডিজিট কাউন্টার পিন হিসেবে কাজ করবে)', 'error');
      return;
    }

    const res = await authService.inviteStaffMember(currentTenant.id, {
      fullName: newStaffName.trim(),
      email: emailToUse,
      phone: newStaffPhone.trim() || currentTenant.ownerPhone,
      role: newStaffRole,
      pinOrPassword: newStaffPin.trim(),
      commissionPerPiece: Number(newStaffCommission) || 0,
      canViewProfits: !newStaffBlindMode,
      canViewDrawers: newStaffRole === 'owner' || newStaffRole === 'manager',
    });

    if (!res.success) {
      showToast(res.message, 'error');
      return;
    }

    setStaffList(dbService.getShopStaff(currentTenant.id, role));
    setIsAddStaffOpen(false);
    setPendingStaffEmail(emailToUse);
    setStaffDevOtp(res.devOtp || null);
    setStaffOtpCode('');
    setIsVerifyStaffOpen(true);
    setNewStaffName('');
    setNewStaffEmail('');
    setNewStaffUsername('');
    setNewStaffPin('');
    setNewStaffPhone('');
    showToast(res.message, 'success');
  };

  const handleVerifyStaffOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffOtpCode.trim()) return;
    const res = await authService.verifyStaffEmail(pendingStaffEmail, staffOtpCode.trim());
    if (res.success) {
      setStaffList(dbService.getShopStaff(currentTenant.id, role));
      setIsVerifyStaffOpen(false);
      showToast(res.message, 'success');
    } else {
      showToast(res.message, 'error');
    }
  };

  const handleToggleOperatorStatus = (staffId: string) => {
    if (!canManageOperators(role)) {
      showToast('স্টাফ অ্যাকাউন্ট নিয়ন্ত্রণ শুধুমাত্র দোকানের মালিক করতে পারবেন।', 'error');
      return;
    }
    const target = staffList.find((s) => s.id === staffId);
    if (!target) return;
    const nextActive = !target.active;
    authService.toggleStaffStatus(currentTenant.id, staffId, nextActive);
    setStaffList(dbService.getShopStaff(currentTenant.id, role));
    showToast(
      nextActive
        ? 'স্টাফ অ্যাকাউন্ট সক্রিয় (Activated) করা হয়েছে'
        : 'স্টাফ অ্যাকাউন্ট নিষ্ক্রিয় (Deactivated) করা হয়েছে — অ্যাক্সেস বন্ধ',
      'info'
    );
  };

  const handleResetStaffPinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStaffResetPinError('');
    if (!resetStaffTarget || !canManageOperators(role)) return;
    const cleanPin = newStaffResetPinInput.trim();
    if (!/^\d{4}$/.test(cleanPin)) {
      setStaffResetPinError('নতুন কাউন্টার পিন অবশ্যই ৪ সংখ্যার ডিজিট হতে হবে।');
      return;
    }
    const updated = dbService.updateStaffPin(currentTenant.id, resetStaffTarget.id, cleanPin, role);
    if (!updated) {
      setStaffResetPinError('স্টাফ পিন আপডেট করতে সমস্যা হয়েছে।');
      return;
    }
    setStaffList(dbService.getShopStaff(currentTenant.id, role));
    showToast(`${resetStaffTarget.name}-এর কাউন্টার পিন সফলভাবে রিসেট করা হয়েছে!`, 'success');
    setResetStaffTarget(null);
    setNewStaffResetPinInput('');
  };

  // ADD PARTNER
  const handleAddOwner = (e: React.FormEvent) => {
    e.preventDefault();
    setOwnerModalError('');
    if (!canManagePartners(role)) {
      setOwnerModalError('পার্টনার যোগ করার অনুমতি শুধুমাত্র দোকানের মালিকের রয়েছে।');
      return;
    }

    if (!newOwnerName.trim() || !newOwnerUsername.trim() || !newOwnerPassword.trim()) {
      setOwnerModalError('নাম, ইউজারনেম ও গোপন পাসওয়ার্ড প্রদান আবশ্যক');
      return;
    }

    if (newOwnerPassword.trim().length < 4) {
      setOwnerModalError('উত্তোলন পাসওয়ার্ড কমপক্ষে ৪ অক্ষরের হতে হবে।');
      return;
    }

    const cleanUsername = newOwnerUsername.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    const exists = ownersList.some((o) => o.username.toLowerCase() === cleanUsername);
    if (exists) {
      setOwnerModalError(`@${cleanUsername} ইউজারনেমটি ইতিমধ্যে ব্যবহৃত হয়েছে! অন্য একটি দিন।`);
      return;
    }

    const created = dbService.addShopOwner(
      currentTenant.id,
      {
        name: newOwnerName.trim(),
        username: cleanUsername,
        password: newOwnerPassword.trim(),
        phone: newOwnerPhone.trim() || ownerPhone,
        sharePercentage: Number(newOwnerShare) || 50,
      },
      role
    );

    if (!created) {
      setOwnerModalError('পার্টনার আইডি তৈরি করা সম্ভব হয়নি।');
      return;
    }

    const updated = dbService.getShopOwners(currentTenant.id, role);
    setOwnersList(updated);
    setIsAddOwnerOpen(false);
    setNewOwnerName('');
    setNewOwnerUsername('');
    setNewOwnerPassword('');
    setNewOwnerPhone('');
    showToast(`নতুন পার্টনার আইডি তৈরি হয়েছে: ${created.name} (@${created.username})`, 'success');
  };

  const handleUpdatePartnerPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPartnerPassError('');
    if (!resetPartnerTarget || !canManagePartners(role)) return;
    const cleanPass = newPartnerPassInput.trim();
    if (cleanPass.length < 4) {
      setPartnerPassError('নতুন উত্তোলন পাসওয়ার্ড কমপক্ষে ৪ অক্ষরের হতে হবে।');
      return;
    }
    if (cleanPass !== confirmPartnerPassInput.trim()) {
      setPartnerPassError('নতুন পাসওয়ার্ড এবং নিশ্চিতকরণ পাসওয়ার্ড মিলছে না।');
      return;
    }
    const ok = dbService.updateShopOwnerPassword(currentTenant.id, resetPartnerTarget.id, cleanPass, role);
    if (!ok) {
      setPartnerPassError('পাসওয়ার্ড আপডেট করা সম্ভব হয়নি।');
      return;
    }
    setOwnersList(dbService.getShopOwners(currentTenant.id, role));
    showToast(`${resetPartnerTarget.name}-এর উত্তোলন পাসওয়ার্ড নিরাপদে আপডেট করা হয়েছে!`, 'success');
    setResetPartnerTarget(null);
    setNewPartnerPassInput('');
    setConfirmPartnerPassInput('');
  };

  const handleDeleteOwner = (ownerId: string, name: string) => {
    if (!canManagePartners(role)) return;
    if (ownersList.length <= 1) {
      showToast('কমপক্ষে একজন প্রধান ওনার আইডি থাকা বাধ্যতামূলক!', 'error');
      return;
    }

    dbService.deleteShopOwner(currentTenant.id, ownerId, role);
    const updated = dbService.getShopOwners(currentTenant.id, role);
    setOwnersList(updated);
    showToast(`${name}-এর পার্টনার আইডি সফলভাবে মুছে ফেলা হয়েছে`, 'info');
  };

  const handleSaveInvoiceSettings = (e: React.FormEvent) => {
    e.preventDefault();
    dbService.updateTenant(currentTenant.id, {
      returnPolicy: invoiceReturnPolicy.trim() || currentTenant.returnPolicy,
      invoiceSettings: {
        invoicePrefix: invoicePrefix.trim() || 'INV-',
        headerSlogan: headerSlogan.trim(),
        hotline: hotlinePhone.trim(),
        showBinNumber: showBinOnInvoice,
        showSalesmanName: showSalesmanOnInvoice,
        showCustomizationDetails: showCustomDetailsOnInvoice,
        showQrCode: showQrCodeOnInvoice,
        qrCodeType,
        paperWidth,
        customPaperWidth,
        footerNote: footerThankYouNote.trim(),
        returnPolicyNote: invoiceReturnPolicy.trim(),
      },
      paymentSettings: {
        ...currentTenant.paymentSettings,
        paperWidth,
        customPaperWidth,
        autoPrintReceipt,
      },
    });
    reloadShopData();
    showToast(
      pickText(
        'ইনভয়েস ও রসিদ সেটিংস সফলভাবে সংরক্ষিত হয়েছে!',
        'Invoice & receipt settings saved successfully!'
      ),
      'success'
    );
  };

  const subCheck = evaluateSubscriptionStatus(currentTenant.subscription);
  const isInvTrackingOn =
    storeConfig.inventoryTrackingEnabled !== false &&
    storeConfig.autoDeductStockOnConfirm !== false;

  // Modern 4-Section Settings Directory (A. Account & Profile, B. Preferences, C. Shop Management, D. Help & Information)
  const settingsDirectorySections = [
    {
      id: 'account_profile',
      badge: 'A',
      titleBn: 'অ্যাকাউন্ট ও প্রোফাইল',
      titleEn: 'Account & Profile',
      descBn: 'দোকানের পরিচয়, মালিকের তথ্য, পার্টনার ও নিরাপত্তা পিন',
      descEn: 'Shop identity, owner details, partners & security PIN',
      items: [
        canAccessSettingsTab(role, 'profile') && {
          id: 'profile' as SettingsTabId,
          icon: <Store className="w-4 h-4 text-[#164e3f] dark:text-emerald-400" />,
          titleBn: 'দোকানের প্রোফাইল ও তথ্য',
          titleEn: 'Shop Profile & Identity',
          descBn: `${currentTenant.name} • ${currentTenant.marketMallName}`,
          descEn: `${currentTenant.name} • ${currentTenant.marketMallName}`,
          valueBadge: currentTenant.merchantId || 'Verified',
        },
        canAccessSettingsTab(role, 'security') && {
          id: 'security' as SettingsTabId,
          icon: <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400" />,
          titleBn: 'ওনার সিকিউরিটি পিন ও ফ্লোর প্রাইস লক',
          titleEn: 'Security & Floor Price PIN',
          descBn: '৪-ডিজিট ওনার পিন এবং সর্বনিম্ন বিক্রয়মূল্য সুরক্ষা',
          descEn: '4-digit Owner PIN & bottom price protection policy',
          valueBadge: currentTenant.bottomPriceProtectionEnabled !== false ? 'PIN Protected' : 'Unlocked',
        },
        canAccessSettingsTab(role, 'partners') && {
          id: 'partners' as SettingsTabId,
          icon: <KeyRound className="w-4 h-4 text-[#164e3f] dark:text-emerald-400" />,
          titleBn: 'পার্টনার ও উত্তোলন পাসওয়ার্ড',
          titleEn: 'Partners & Withdrawal Passwords',
          descBn: 'অংশীদারদের শেয়ার শতাংশ ও এনক্রিপ্টেড পাসওয়ার্ড',
          descEn: 'Partner equity shares & encrypted withdrawal credentials',
          valueBadge: `${ownersList.length} Partners`,
        },
      ].filter(Boolean) as Array<{
        id: SettingsTabId;
        icon: React.ReactNode;
        titleBn: string;
        titleEn: string;
        descBn: string;
        descEn: string;
        valueBadge: string;
      }>,
    },
    {
      id: 'preferences',
      badge: 'B',
      titleBn: 'পছন্দসমূহ ও ডিসপ্লে',
      titleEn: 'Preferences',
      descBn: 'ভাষা নির্বাচন, থিম, রিসিট প্রিন্ট এবং মেমো লেআউট',
      descEn: 'Language selection, display theme, receipt printing & memo layout',
      items: [
        canAccessSettingsTab(role, 'invoices') && {
          id: 'invoices' as SettingsTabId,
          icon: <FileText className="w-4 h-4 text-[#164e3f] dark:text-emerald-400" />,
          titleBn: 'ইনভয়েস ও রিসিট প্রিন্ট লেআউট',
          titleEn: 'Invoices & Receipt Layout',
          descBn: 'থার্মাল স্লিপ সাইজ (80mm/58mm), স্লোগান ও লাইভ প্রিভিউ',
          descEn: 'Thermal paper width (80mm/58mm), header slogan & live preview',
          valueBadge: paperWidth === 'custom' ? `${customPaperWidth}mm` : paperWidth,
        },
        canAccessSettingsTab(role, 'security_tools') && {
          id: 'security_tools' as SettingsTabId,
          icon: <Printer className="w-4 h-4 text-[#164e3f] dark:text-emerald-400" />,
          titleBn: 'প্রিন্ট, পিওএস ও স্টক নিয়মাবলী',
          titleEn: 'Print, POS & Inventory Rules',
          descBn: 'অটো প্রিন্ট, ডিসকাউন্ট সীমা এবং রিসাইকেল বিন (Trash)',
          descEn: 'Auto-print receipt, discount limits & 30-day Trash Bin',
          valueBadge: autoPrintReceipt ? 'Auto-Print ON' : 'Manual Print',
        },
      ].filter(Boolean) as Array<{
        id: SettingsTabId;
        icon: React.ReactNode;
        titleBn: string;
        titleEn: string;
        descBn: string;
        descEn: string;
        valueBadge: string;
      }>,
    },
    {
      id: 'shop_management',
      badge: 'C',
      titleBn: 'দোকান ও ব্যবসা ব্যবস্থাপনা',
      titleEn: 'Shop Management',
      descBn: 'ক্যাটাগরি ও দর, ইনভেন্টরি স্টক ট্র্যাকিং, স্টাফ, পেমেন্ট ও সাবস্ক্রিপশন',
      descEn: 'Categories & price, inventory tracking, staff, payments & subscription',
      items: [
        canAccessSettingsTab(role, 'categories') && {
          id: 'categories' as SettingsTabId,
          icon: <Tag className="w-4 h-4 text-[#164e3f] dark:text-emerald-400" />,
          titleBn: 'ক্যাটাগরি ও পণ্যের দর',
          titleEn: 'Categories & Price',
          descBn: 'পণ্যের ক্যাটাগরি, সাইজ প্রিসেট ও ফুল-স্ক্রিন মাল্টি-ভ্যারিয়েন্ট এন্ট্রি',
          descEn: 'Product categories, size presets & full-screen multi-variant catalog',
          valueBadge: isClothingStore ? 'CLOTHING' : 'SPORTSWEAR',
        },
        canAccessSettingsTab(role, 'security_tools') && {
          id: 'security_tools' as SettingsTabId,
          icon: <Package className="w-4 h-4 text-[#164e3f] dark:text-emerald-400" />,
          titleBn: 'ইনভেন্টরি ট্র্যাকিং ও স্টক অ্যালার্ট',
          titleEn: 'Inventory Tracking & Thresholds',
          descBn: 'POS বিক্রয়ে অটো স্টক বিয়োগ চালু/বন্ধ এবং লো-স্টক অ্যালার্ট',
          descEn: 'Toggle Inventory Tracking ON/OFF & configure low-stock alerts',
          valueBadge: isInvTrackingOn ? 'Tracking: ON' : 'Tracking: OFF',
        },
        canAccessSettingsTab(role, 'operators') && {
          id: 'operators' as SettingsTabId,
          icon: <Users className="w-4 h-4 text-[#164e3f] dark:text-emerald-400" />,
          titleBn: 'স্টাফ ও অপারেটর পারমিশন',
          titleEn: 'Staff & Operator Permissions',
          descBn: 'ক্যাশিয়ার ও ম্যানেজার রোল, কমিশন, Blind Mode এবং পিন রিসেট',
          descEn: 'Manage counter staff, commission, Blind Profit Mode & PIN reset',
          valueBadge: `${staffList.length} Staff`,
        },
        canAccessSettingsTab(role, 'payments') && {
          id: 'payments' as SettingsTabId,
          icon: <CreditCard className="w-4 h-4 text-[#164e3f] dark:text-emerald-400" />,
          titleBn: 'পেমেন্ট অ্যাকাউন্ট ও ড্রয়ার',
          titleEn: 'Payment Accounts & Drawers',
          descBn: 'বিকাশ মার্চেন্ট/পার্সোনাল, নগদ এবং ব্যাংক অ্যাকাউন্ট কনফিগারেশন',
          descEn: 'Configure bKash, Nagad, Bank accounts & multi-drawer balances',
          valueBadge: '5 Drawers',
        },
        canAccessSettingsTab(role, 'subscription') && {
          id: 'subscription' as SettingsTabId,
          icon: <Building2 className="w-4 h-4 text-[#164e3f] dark:text-emerald-400" />,
          titleBn: 'সাবস্ক্রিপশন ও আউটলেট তালিকা',
          titleEn: 'Subscription & Stores Directory',
          descBn: 'সক্রিয় আউটলেট পরিবর্তন এবং নতুন শাখা তৈরি',
          descEn: 'Manage store outlets, active branch & subscription plan',
          valueBadge: `${subCheck.status.toUpperCase()}`,
        },
      ].filter(Boolean) as Array<{
        id: SettingsTabId;
        icon: React.ReactNode;
        titleBn: string;
        titleEn: string;
        descBn: string;
        descEn: string;
        valueBadge: string;
      }>,
    },
    {
      id: 'help_info',
      badge: 'D',
      titleBn: 'হেল্প সেন্টার ও তথ্য',
      titleEn: 'Help & Information',
      descBn: 'টিউটোরিয়াল, প্রশ্নোত্তর, পলিসি, অ্যাপ আপডেট এবং সাপোর্ট যোগাযোগ',
      descEn: 'Video tutorials, FAQs, legal policies, app updates & support',
      items: [
        {
          id: 'help' as SettingsTabId,
          icon: <HelpCircle className="w-4 h-4 text-[#164e3f] dark:text-emerald-400" />,
          titleBn: 'হেল্প সেন্টার ও ভিডিও টিউটোরিয়াল',
          titleEn: 'Help Center & Video Tutorials',
          descBn: 'ধাপে ধাপে গাইড, সাধারণ প্রশ্নের উত্তর ও সাপোর্ট টিকেট',
          descEn: 'Tutorials, troubleshooting FAQs, billing help & support tickets',
          valueBadge: '6 Guides',
        },
        {
          id: 'policies' as SettingsTabId,
          icon: <Shield className="w-4 h-4 text-[#164e3f] dark:text-emerald-400" />,
          titleBn: 'পলিসি ও আইনি নীতিমালা',
          titleEn: 'Policies & Legal Documents',
          descBn: 'শর্তাবলী, গোপনীয়তা, রিফান্ড এবং ডাটা সুরক্ষা নীতিমালা',
          descEn: 'Terms, Privacy, Subscription, Refund & Data Retention policies',
          valueBadge: '6 Policies',
        },
        {
          id: 'updates' as SettingsTabId,
          icon: <Sparkles className="w-4 h-4 text-[#164e3f] dark:text-emerald-400" />,
          titleBn: 'আপডেট, ঘোষণা ও অ্যাপ তথ্য',
          titleEn: 'Updates, Announcements & App Info',
          descBn: 'LEKHO POS রিলিজ নোট, নতুন ফিচার এবং ভার্সন তথ্য',
          descEn: 'Verified release notes, feature announcements & version info',
          valueBadge: 'v2.6.0',
        },
      ],
    },
  ].filter((sec) => sec.items.length > 0);

  const cleanSettingsQuery = settingsSearch.trim().toLowerCase();

  return (
    <div className="space-y-4 animate-in fade-in duration-200 pb-20 lg:pb-8 min-w-0 max-w-full">


      {/* ===================================================================== */}
      {/* MODERN MOBILE-APP-STYLE GROUPED SETTINGS HUB                          */}
      {/* ===================================================================== */}
      {showSettingsHub ? (
        <div className="space-y-4">
          {/* Compact Search Bar & Quick Theme/Language Preferences */}
          <div className="bg-transparent border-0 p-0 shadow-none flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={settingsSearch}
                onChange={(e) => setSettingsSearch(e.target.value)}
                placeholder={pickText(
                  'সেটিংস খুঁজুন (যেমন: প্রোফাইল, ভাষা, ক্যাটাগরি, প্রিন্টার, পিন, হেল্প)...',
                  'Search settings (e.g. profile, language, categories, printer, PIN, help)...'
                )}
                className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl pl-10 pr-8 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#164e3f]"
              />
              {settingsSearch && (
                <button
                  type="button"
                  onClick={() => setSettingsSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={toggleTheme}
              className="flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-zinc-950 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-800 text-xs font-bold text-slate-700 dark:text-zinc-300 transition cursor-pointer shrink-0"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span>{pickText('থিম: ডার্ক মোড', 'Theme: Dark Mode')}</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-slate-600" />
                  <span>{pickText('থিম: লাইট মোড', 'Theme: Light Mode')}</span>
                </>
              )}
            </button>
          </div>

          {/* 4 Grouped Settings Sections */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {settingsDirectorySections.map((section) => {
              const filteredItems = section.items.filter((item) => {
                if (!cleanSettingsQuery) return true;
                const hay = `${item.titleBn} ${item.titleEn} ${item.descBn} ${item.descEn} ${item.valueBadge}`.toLowerCase();
                return hay.includes(cleanSettingsQuery);
              });
              if (filteredItems.length === 0) return null;

              return (
                <div
                  key={section.id}
                  className="bg-transparent border-0 p-0 shadow-none flex flex-col"
                >
                  {/* Group Header */}
                  <div className="px-0 py-1 bg-transparent border-0">
                    <h2 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white truncate">
                      {pickText(section.titleBn, section.titleEn)}
                    </h2>
                  </div>

                  {/* Compact Interactive List Rows */}
                  <div className="divide-y divide-slate-100 dark:divide-zinc-800/80">
                    {filteredItems.map((item, idx) => (
                      <button
                        key={`${section.id}_${item.id}_${idx}`}
                        type="button"
                        onClick={() => openSettingsSubpage(item.id)}
                        className="w-full px-0 py-2.5 text-left hover:bg-[#e6f4ea]/40 dark:hover:bg-zinc-800/60 transition flex items-center justify-between gap-3 cursor-pointer group min-h-[48px]"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-6 h-6 bg-transparent border-0 flex items-center justify-center shrink-0 transition">
                            {item.icon}
                          </div>
                          <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white group-hover:text-[#164e3f] dark:group-hover:text-emerald-400 truncate">
                            {pickText(item.titleBn, item.titleEn)}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="hidden sm:inline-block text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200/70 dark:border-zinc-700">
                            {item.valueBadge}
                          </span>
                          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#164e3f] dark:group-hover:text-emerald-400 transition-transform group-hover:translate-x-0.5" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={returnToSettingsHub}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 text-xs font-extrabold transition cursor-pointer shrink-0"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{pickText('সব সেটিংস', 'All Settings')}</span>
        </button>
      )}

      {/* ========================================================================= */}
      {/* SUBPAGE CONTENT (Shown when a specific setting is open)                   */}
      {/* ========================================================================= */}
      {!showSettingsHub && (
        <>
          {/* TAB: LANGUAGE PREFERENCE (Accessible to all roles, scoped per shop/user) */}
          {activeSettingsTab === 'language' && (
            <div className="bg-transparent border-0 p-1 sm:p-2 space-y-5 shadow-none">
              <div className="pb-4 border-b border-slate-200 dark:border-zinc-800">
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <Globe className="w-4 h-4 text-[#164e3f] dark:text-emerald-400" />
                  <span>{pickText('ভাষা সেটিংস', 'Language Settings')}</span>
                  <InfoTooltip text={pickText(
                    'আপনার দোকানের নেভিগেশন মেনু, সেটিংস এবং হেল্প সেন্টারের ভাষা নির্বাচন করুন।',
                    'Select your preferred language for navigation, settings, and Help Center.'
                  )} />
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setLanguage('bn');
                    showToast('ভাষা পরিবর্তন: বাংলা (Bangla) সক্রিয় করা হয়েছে', 'success');
                  }}
                  className={`p-4 rounded-2xl border text-left transition cursor-pointer flex items-start justify-between gap-3 ${
                    language === 'bn'
                      ? 'border-[#164e3f] bg-[#e6f4ea]/60 dark:bg-emerald-950/40 ring-1 ring-[#164e3f]/20'
                      : 'border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950'
                  }`}
                >
                    <div className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span>{pickText('বাংলা (ডিফল্ট রিটেইল মোড)', 'Bangla (Default Retail Mode)')}</span>
                      <InfoTooltip text={pickText('বাংলাদেশি রিটেইল শপ, ক্যাশ মেমো, বাকি খাতা ও কাউন্টার স্টাফদের জন্য সহজ বাংলা ইন্টারফেস।', 'Bangla interface for retail shops, cash memos, credit ledgers, and staff.')} />
                    </div>
                  {language === 'bn' && (
                    <CheckCircle2 className="w-5 h-5 text-[#164e3f] dark:text-emerald-400 shrink-0" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setLanguage('en');
                    showToast('Language preference saved: English', 'success');
                  }}
                  className={`p-4 rounded-2xl border text-left transition cursor-pointer flex items-start justify-between gap-3 ${
                    language === 'en'
                      ? 'border-[#164e3f] bg-[#e6f4ea]/60 dark:bg-emerald-950/40 ring-1 ring-[#164e3f]/20'
                      : 'border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span>{pickText('ইংরেজি (ইন্টারন্যাশনাল রিটেইল মোড)', 'English (International Retail Mode)')}</span>
                      <InfoTooltip text={pickText('নেভিগেশন, সেটিংস, হেল্প সেন্টার এবং অ্যাকশন বাটনগুলোতে পরিষ্কার ইংরেজি লেবেল।', 'Clean English labels across navigation, Settings, Help Center, and action buttons.')} />
                    </div>
                  </div>
                  {language === 'en' && (
                    <CheckCircle2 className="w-5 h-5 text-[#164e3f] dark:text-emerald-400 shrink-0" />
                  )}
                </button>
              </div>
            </div>
          )}

          {/* TAB: HELP CENTER, POLICIES & UPDATES (Embedded inside Settings) */}
          {(activeSettingsTab === 'help' ||
            activeSettingsTab === 'policies' ||
            activeSettingsTab === 'updates') && (
            <LekhoHelpCenter
              initialCategory={
                activeSettingsTab === 'policies'
                  ? 'policies'
                  : activeSettingsTab === 'updates'
                  ? 'updates'
                  : 'tutorials'
              }
              embeddedInSettings={true}
            />
          )}

          {/* ========================================================================= */}
          {/* TAB: OWNER SECURITY PIN & BOTTOM PRICE POLICY (Owner Only)                */}
          {/* ========================================================================= */}
          {activeSettingsTab === 'security' && canAccessSettingsTab(role, 'security') && (
            <OwnerSecuritySettingsCard />
          )}

      {/* ========================================================================= */}
      {/* TAB 1: PROFILE & OWNER INFO (Pathao Image 4 Inspired Clean UI)             */}
      {/* ========================================================================= */}
      {activeSettingsTab === 'profile' && canAccessSettingsTab(role, 'profile') && (
        <div className="bg-transparent border-0 p-1 sm:p-2 space-y-6 shadow-none">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-zinc-800">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Store className="w-4 h-4 text-emerald-600 dark:text-emerald-400" strokeWidth={1.75} />
                <span>{pickText('দোকানের প্রোফাইল ও তথ্য', 'Profile & Store Information')}</span>
                {!canEditProfile && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-bold">
                    {pickText('শুধুমাত্র দেখার অনুমতি', 'Read-Only')}
                  </span>
                )}
                <InfoTooltip text={pickText('ক্যাশ মেমো, ইনভয়েস প্রিন্ট ও রসিদে প্রদর্শিত অফিশিয়াল তথ্য', 'Official store details displayed on cash memo & invoices')} />
              </h3>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className="text-xs text-slate-500 dark:text-zinc-400 font-medium">
                {pickText('মার্চেন্ট আইডি:', 'Merchant ID:')}
              </span>
              <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 font-mono font-bold border border-slate-200 dark:border-zinc-700">
                {merchantId || currentTenant.id}
              </span>
            </div>
          </div>

          <form onSubmit={handleSaveStoreProfile} className="space-y-5">
            {/* Owner Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                {pickText('মালিকের পূর্ণ নাম', 'Owner / Merchant Name')} *
              </label>
              <input
                type="text"
                required
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder={pickText('যেমন: আসাদুর রহমান / মাহমুদুল হাসান', 'e.g. Asadur Rahman / Mahmudul Hasan')}
                className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            {/* Email and Phone with Verified Badges (Image 4 Inspired) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 dark:bg-zinc-950/60 p-4 rounded-2xl border border-slate-200 dark:border-zinc-800">
              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5 flex items-center justify-between">
                  <span>{pickText('ইমেইল ঠিকানা', 'Email Address')}</span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-emerald-500" />
                    {pickText('ভেরিফাইড', 'Verified')}
                  </span>
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={ownerEmail}
                    onChange={(e) => setOwnerEmail(e.target.value)}
                    className="w-full bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white pr-9 focus:outline-none focus:border-emerald-500"
                  />
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 absolute right-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5 flex items-center justify-between">
                  <span>{pickText('মোবাইল নম্বর', 'Phone Number')}</span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-emerald-500" />
                    {pickText('ভেরিফাইড', 'Verified')}
                  </span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={ownerPhone}
                    onChange={(e) => setOwnerPhone(e.target.value)}
                    className="w-full bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white pr-9 font-mono focus:outline-none focus:border-emerald-500"
                  />
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 absolute right-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>
            </div>

            {/* Website / Facebook Page (Optional) with Info tooltip (Image 4 Inspired) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5 flex items-center gap-1.5">
                <span>{pickText('ওয়েবসাইট / ফেসবুক পেইজ (ঐচ্ছিক)', 'Website / Facebook Page (Optional)')}</span>
                <div className="group relative cursor-help">
                  <Info className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300" />
                  <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block w-64 p-2 rounded-lg bg-slate-900 text-white text-[10px] leading-tight shadow-xl z-30">
                    {pickText(
                      'আপনার দোকানের অফিশিয়াল ফেসবুক পেইজ বা ওয়েবসাইটের লিঙ্ক দিন, যা কাস্টমার ক্যাশ মেমোতে প্রিন্ট হবে।',
                      'Enter your official Facebook page or website link to print on customer cash memos.'
                    )}
                  </div>
                </div>
              </label>
              <div className="relative">
                <Globe className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="url"
                  value={facebookUrl}
                  onChange={(e) => setFacebookUrl(e.target.value)}
                  placeholder="https://www.facebook.com/your-store-page"
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-800 rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Store Names & Mall Location */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                  {pickText('দোকানের ইংরেজি নাম', 'Store Name (English)')}
                </label>
                <input
                  type="text"
                  required
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                  {pickText('দোকানের বাংলা নাম', 'Bengali Name')}
                </label>
                <input
                  type="text"
                  value={bengaliName}
                  onChange={(e) => setBengaliName(e.target.value)}
                  placeholder={pickText('যেমন: গ্যালারিয়া স্পোর্টস বিডি', 'e.g. Galleria Sports BD')}
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white font-bengali focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                  {pickText('মার্কেট বা শপিং মল ঠিকানা', 'Market / Shopping Mall Address')}
                </label>
                <input
                  type="text"
                  value={marketMallName}
                  onChange={(e) => setMarketMallName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                  {pickText('দোকান নং / ব্লক / লেভেল', 'Shop No. / Block / Level')}
                </label>
                <input
                  type="text"
                  value={shopNo}
                  onChange={(e) => setShopNo(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Logo (Optional) with preview box & Edit button (Image 4 Inspired) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                {pickText('লোগো (ঐচ্ছিক)', 'Logo (Optional)')}
              </label>
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800">
                <div className="w-48 h-20 bg-slate-200/80 dark:bg-zinc-900 rounded-xl border border-slate-300 dark:border-zinc-800 flex items-center justify-center p-2 overflow-hidden relative group">
                  {logoPreview ? (
                    <img src={logoPreview} alt="Store Logo" className="max-h-full max-w-full object-contain" />
                  ) : (
                    <div className="text-center">
                      <span className="font-extrabold text-sm tracking-tight text-slate-800 dark:text-zinc-200 uppercase">
                        [{shopName || 'STORE LOGO'}]
                      </span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsEditingLogo(!isEditingLogo)}
                    className="absolute bottom-1.5 right-1.5 bg-white dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 border border-slate-300 dark:border-zinc-700 text-[10px] font-semibold px-2 py-0.5 rounded-lg flex items-center gap-1 shadow-xs cursor-pointer"
                  >
                    <Edit2 className="w-2.5 h-2.5" />
                    <span>{pickText('এডিট', 'Edit')}</span>
                  </button>
                </div>

                <div className="flex-1 text-xs text-slate-500 dark:text-zinc-400 space-y-1">
                  <div className="font-semibold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5">
                    <span>{pickText('দোকানের ব্র্যান্ড লোগো', 'Shop Brand Logo')}</span>
                    <InfoTooltip text={pickText('থার্মাল ক্যাশ মেমোর শীর্ষে এই লোগোটি প্রিন্ট হবে।', 'This logo will be printed on thermal cash receipt.')} />
                  </div>
                  {isEditingLogo && (
                    <div className="flex items-center gap-2 pt-2 animate-in fade-in">
                      <input
                        type="url"
                        value={newLogoUrlInput}
                        onChange={(e) => setNewLogoUrlInput(e.target.value)}
                        placeholder={pickText('ইমেজ URL দিন (https://...)', 'Enter Image URL (https://...)')}
                        className="flex-1 bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (newLogoUrlInput.trim()) {
                            setLogoPreview(newLogoUrlInput.trim());
                            setIsEditingLogo(false);
                            showToast(pickText('লোগো প্রিভিউ আপডেট করা হয়েছে!', 'Logo preview updated!'), 'info');
                          }
                        }}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold cursor-pointer"
                      >
                        {pickText('প্রয়োগ করুন', 'Apply')}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons: Save & Cancel (Owner Only) */}
            {canEditProfile && (
              <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => {
                    setOwnerName(currentTenant.ownerName);
                    setOwnerEmail(currentTenant.email || '');
                    setOwnerPhone(currentTenant.ownerPhone);
                    showToast(pickText('পরিবর্তন বাতিল করা হয়েছে', 'Changes discarded'), 'info');
                  }}
                  className="px-5 py-2.5 rounded-xl border border-rose-300 dark:border-rose-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-semibold transition cursor-pointer"
                >
                  {pickText('বাতিল', 'Cancel')}
                </button>

                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-[#164e3f] hover:bg-[#123e32] text-white font-bold text-xs flex items-center gap-2 transition shadow-xs cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{pickText('সেভ করুন', 'Save')}</span>
                </button>
              </div>
            )}
          </form>

          {/* OWNER-ONLY CUSTOMER LOYALTY PROGRAM CONFIGURATION (PHASE 4) */}
          {canEditProfile && (() => {
            const loyaltyCfg = storeConfig.loyaltySettings || dbService.getLoyaltySettings(currentTenant.id);
            const updateLoyaltyCfg = (patch: Partial<typeof loyaltyCfg>) => {
              const nextLoyalty = { ...loyaltyCfg, ...patch };
              setStoreConfig({
                ...storeConfig,
                loyaltySettings: nextLoyalty,
              });
            };
            return (
              <div className="pt-6 border-t border-slate-200 dark:border-zinc-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-[#164e3f] dark:text-emerald-400" />
                      <span>{pickText('কাস্টমার লয়্যালটি ও রিওয়ার্ড পয়েন্ট সেটিংস', 'Customer Loyalty Program Settings')}</span>
                      <InfoTooltip text={pickText('শুধুমাত্র দোকানের মালিক (Owner) পয়েন্ট অর্জনের নিয়ম এবং রিওয়ার্ড ডিসকাウント টিয়ার কনফিগার করতে পারবেন', 'Only Store Owner can configure point earning rules and reward discount tiers')} />
                    </h3>
                  </div>

                  <label className="inline-flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-[#f4f7f5] dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 cursor-pointer self-start sm:self-auto">
                    <input
                      type="checkbox"
                      checked={loyaltyCfg.enabled}
                      onChange={(e) => {
                        const nextLoyalty = { ...loyaltyCfg, enabled: e.target.checked };
                        setStoreConfig({ ...storeConfig, loyaltySettings: nextLoyalty });
                        dbService.saveLoyaltySettings(currentTenant.id, nextLoyalty, role);
                        showToast(
                          e.target.checked
                            ? pickText('লয়্যালটি পয়েন্ট সিস্টেম চালু করা হয়েছে', 'Loyalty point system enabled')
                            : pickText('লয়্যালটি পয়েন্ট সিস্টেম বন্ধ করা হয়েছে', 'Loyalty point system disabled'),
                          'info'
                        );
                      }}
                      className="w-4 h-4 rounded accent-[#164e3f] cursor-pointer"
                    />
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      {loyaltyCfg.enabled ? pickText('লয়্যালটি প্রোগ্রাম: সক্রিয়', 'Loyalty Program: Active') : pickText('লয়্যালটি প্রোগ্রাম: বন্ধ', 'Loyalty Program: Disabled')}
                    </span>
                  </label>
                </div>

                {/* Point Earning Mode Selector: Mode A vs Mode B */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div
                    onClick={() => updateLoyaltyCfg({ earningMode: 'per_amount_spent' })}
                    className={`p-4 rounded-2xl border transition cursor-pointer space-y-2.5 ${
                      loyaltyCfg.earningMode === 'per_amount_spent'
                        ? 'bg-[#e6f4ea]/60 dark:bg-emerald-950/30 border-[#164e3f] ring-1 ring-[#164e3f]/20'
                        : 'bg-[#f4f7f5] dark:bg-zinc-950 border-slate-200 dark:border-zinc-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span>{pickText('মোড বি — খরচ অনুযায়ী পয়েন্ট', 'Mode B — Points per Amount Spent')}</span>
                        <InfoTooltip text={pickText('যেমন: প্রতি ৳১,০০০ কেনাকাটায় ১০ পয়েন্ট যোগ হবে', 'e.g., 10 points added per ৳1,000 spent')} />
                      </span>
                      <input
                        type="radio"
                        checked={loyaltyCfg.earningMode === 'per_amount_spent'}
                        onChange={() => {}}
                        className="accent-[#164e3f]"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2.5 pt-1" onClick={(e) => e.stopPropagation()}>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 dark:text-zinc-400 mb-1">
                          {pickText('প্রতি কত টাকায় (৳)', 'Amount Unit (৳)')}
                        </label>
                        <input
                          type="number"
                          min={100}
                          value={loyaltyCfg.amountUnitForPoints}
                          onChange={(e) =>
                            updateLoyaltyCfg({
                              amountUnitForPoints: Math.max(1, Number(e.target.value) || 1000),
                            })
                          }
                          className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-2.5 py-1.5 font-mono font-bold text-slate-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 dark:text-zinc-400 mb-1">
                          {pickText('কত পয়েন্ট পাবে', 'Points Earned')}
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={loyaltyCfg.pointsPerAmountUnit}
                          onChange={(e) =>
                            updateLoyaltyCfg({
                              pointsPerAmountUnit: Math.max(0, Number(e.target.value) || 10),
                            })
                          }
                          className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-2.5 py-1.5 font-mono font-bold text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>
                  </div>

                  <div
                    onClick={() => updateLoyaltyCfg({ earningMode: 'per_purchase' })}
                    className={`p-4 rounded-2xl border transition cursor-pointer space-y-2.5 ${
                      loyaltyCfg.earningMode === 'per_purchase'
                        ? 'bg-[#e6f4ea]/60 dark:bg-emerald-950/30 border-[#164e3f] ring-1 ring-[#164e3f]/20'
                        : 'bg-[#f4f7f5] dark:bg-zinc-950 border-slate-200 dark:border-zinc-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span>{pickText('মোড এ — প্রতি ইনভয়েসে নির্দিষ্ট পয়েন্ট', 'Mode A — Points per Purchase')}</span>
                        <InfoTooltip text={pickText('যেমন: ন্যূনতম ৳৫০০ টাকার প্রতিটি সফল কেনাকাটায় ১০ পয়েন্ট', 'e.g., 10 points per purchase above ৳500 min bill')} />
                      </span>
                      <input
                        type="radio"
                        checked={loyaltyCfg.earningMode === 'per_purchase'}
                        onChange={() => {}}
                        className="accent-[#164e3f]"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2.5 pt-1" onClick={(e) => e.stopPropagation()}>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 dark:text-zinc-400 mb-1">
                          {pickText('ন্যূনতম বিল (৳)', 'Min Bill (৳)')}
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={loyaltyCfg.minPurchaseAmountForPoints}
                          onChange={(e) =>
                            updateLoyaltyCfg({
                              minPurchaseAmountForPoints: Math.max(0, Number(e.target.value) || 0),
                            })
                          }
                          className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-2.5 py-1.5 font-mono font-bold text-slate-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 dark:text-zinc-400 mb-1">
                          {pickText('প্রতি কেনাকাটায় পয়েন্ট', 'Points per Purchase')}
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={loyaltyCfg.pointsPerPurchase}
                          onChange={(e) =>
                            updateLoyaltyCfg({
                              pointsPerPurchase: Math.max(0, Number(e.target.value) || 10),
                            })
                          }
                          className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-2.5 py-1.5 font-mono font-bold text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Configurable Reward Tiers */}
                <div className="p-4 rounded-2xl bg-[#f4f7f5] dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span>{pickText('রিওয়ার্ড ডিসকাウント টিয়ার', 'Reward Redemption Tiers')}</span>
                        <InfoTooltip text={pickText('যেমন: ৫০ পয়েন্ট = ২% ডিসকাউন্ট, ১০০ পয়েন্ট = ৫% ডিসকাউন্ট', 'e.g., 50 points = 2% discount, 100 points = 5% discount')} />
                      </h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const nextTiers = [
                          ...(loyaltyCfg.rewardTiers || []),
                          {
                            id: `tier_${Date.now()}`,
                            pointsRequired: 300,
                            discountPercent: 15,
                            label: '300 Points = 15% Discount',
                            isActive: true,
                          },
                        ];
                        updateLoyaltyCfg({ rewardTiers: nextTiers });
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-[#164e3f] dark:text-emerald-400 font-bold text-[11px] hover:bg-emerald-50 transition cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{pickText('নতুন টিয়ার যোগ করুন', '+ Add Tier')}</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {loyaltyCfg.rewardTiers.map((tier, idx) => (
                      <div
                        key={tier.id}
                        className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-extrabold text-[#164e3f] dark:text-emerald-400">
                            Tier #{idx + 1}
                          </span>
                          {loyaltyCfg.rewardTiers.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                const nextTiers = loyaltyCfg.rewardTiers.filter((t) => t.id !== tier.id);
                                updateLoyaltyCfg({ rewardTiers: nextTiers });
                              }}
                              className="text-slate-400 hover:text-rose-600 cursor-pointer"
                              title={pickText('টিয়ার মুছুন', 'Delete Tier')}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] text-slate-500 mb-0.5">{pickText('প্রয়োজনীয় পয়েন্ট', 'Points Required')}</label>
                            <input
                              type="number"
                              min={1}
                              value={tier.pointsRequired}
                              onChange={(e) => {
                                const pts = Math.max(1, Number(e.target.value) || 1);
                                const nextTiers = loyaltyCfg.rewardTiers.map((t) =>
                                  t.id === tier.id
                                    ? {
                                        ...t,
                                        pointsRequired: pts,
                                        label: `${pts} Points = ${t.discountPercent}% Discount`,
                                      }
                                    : t
                                );
                                updateLoyaltyCfg({ rewardTiers: nextTiers });
                              }}
                              className="w-full bg-[#f4f7f5] dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-2 py-1 font-mono font-bold text-slate-900 dark:text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-500 mb-0.5">{pickText('ডিসকাউন্ট (%)', 'Discount (%)')}</label>
                            <input
                              type="number"
                              min={1}
                              max={100}
                              value={tier.discountPercent}
                              onChange={(e) => {
                                const pct = Math.min(100, Math.max(1, Number(e.target.value) || 1));
                                const nextTiers = loyaltyCfg.rewardTiers.map((t) =>
                                  t.id === tier.id
                                    ? {
                                        ...t,
                                        discountPercent: pct,
                                        label: `${t.pointsRequired} Points = ${pct}% Discount`,
                                      }
                                    : t
                                );
                                updateLoyaltyCfg({ rewardTiers: nextTiers });
                              }}
                              className="w-full bg-[#f4f7f5] dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-2 py-1 font-mono font-bold text-slate-900 dark:text-white"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        dbService.saveLoyaltySettings(currentTenant.id, loyaltyCfg, role);
                        reloadShopData();
                        showToast(
                          pickText(
                            'কাস্টমার লয়্যালটি ও রিওয়ার্ড পয়েন্ট সেটিংস সংরক্ষিত হয়েছে!',
                            'Customer loyalty & reward settings saved!'
                          ),
                          'success'
                        );
                      }}
                      className="px-5 py-2 rounded-xl bg-[#164e3f] hover:bg-[#123e32] text-white font-bold text-xs flex items-center gap-2 transition shadow-xs cursor-pointer"
                    >
                      <Save className="w-4 h-4" />
                      <span>{pickText('পয়েন্ট সেটিংস সেভ করুন', 'Save Loyalty Settings')}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: INVOICE & RECEIPT DESIGN (With Live Interactive Thermal Slip Preview) */}
      {/* ========================================================================= */}
      {activeSettingsTab === 'invoices' && canAccessSettingsTab(role, 'invoices') && (
        <div className="bg-transparent border-0 p-1 sm:p-2 space-y-6 shadow-none">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-zinc-800">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" strokeWidth={1.75} />
                <span>{pickText('ক্যাশ মেমো ও রসিদ ডিজাইন', 'Invoice & Thermal Receipt Settings')}</span>
                <InfoTooltip text={pickText(
                  'কাস্টমারের থার্মাল পেপার স্লিপ, স্লোগান, কিউআর কোড, ভ্যাট/ট্যাক্স এবং রিটার্ন পলিসি কাস্টমাইজ করুন',
                  'Customize thermal paper slip layout, header slogan, QR code, VAT and return policies'
                )} />
              </h3>
            </div>

            <button
              type="button"
              onClick={() => {
                window.print();
                showToast(pickText('নমুনা রসিদ প্রিন্টারে পাঠানো হয়েছে', 'Sample slip sent to printer'), 'info');
              }}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-750 text-slate-800 dark:text-zinc-200 text-xs font-bold flex items-center gap-2 cursor-pointer transition"
            >
              <Printer className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>{pickText('নমুনা রসিদ প্রিন্ট করুন', 'Print Sample Slip')}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Form Controls (7 cols) */}
            <form onSubmit={handleSaveInvoiceSettings} className="lg:col-span-7 space-y-4 text-xs">
              {/* Header Branding */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-950/70 border border-slate-200 dark:border-zinc-800 space-y-3">
                <h4 className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
                  <Store className="w-3.5 h-3.5 text-emerald-600" />
                  {pickText('রিসিদের শীর্ষ হেডার ও স্লোগান', 'Receipt Top Header & Tagline')}
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 dark:text-zinc-400 font-semibold mb-1">
                      {pickText('দোকানের নাম', 'Store Name')}
                    </label>
                    <input
                      type="text"
                      value={shopName}
                      onChange={(e) => setShopName(e.target.value)}
                      className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 dark:text-zinc-400 font-semibold mb-1">
                      {pickText('বাংলা নাম (ঐচ্ছিক)', 'Bengali Name (Optional)')}
                    </label>
                    <input
                      type="text"
                      value={bengaliName}
                      onChange={(e) => setBengaliName(e.target.value)}
                      placeholder={pickText('যেমন: গ্যালেরিয়া স্পোর্টস বিডি', 'e.g. Galleria Sports BD')}
                      className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-zinc-400 font-semibold mb-1">
                    {pickText('সাব-টাইটেল / স্লোগান', 'Subtitle / Tagline')}
                  </label>
                  <input
                    type="text"
                    value={headerSlogan}
                    onChange={(e) => setHeaderSlogan(e.target.value)}
                    placeholder="Official Jerseys, Apparel & Custom DTF Printing"
                    className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 dark:text-zinc-400 font-semibold mb-1">
                      {pickText('হটলাইন / কাস্টমার কেয়ার ফোন', 'Hotline / Support Phone')}
                    </label>
                    <input
                      type="text"
                      value={hotlinePhone}
                      onChange={(e) => setHotlinePhone(e.target.value)}
                      className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 dark:text-zinc-400 font-semibold mb-1">
                      {pickText('ইনভয়েস নম্বর প্রিফিক্স', 'Invoice Prefix')}
                    </label>
                    <input
                      type="text"
                      value={invoicePrefix}
                      onChange={(e) => setInvoicePrefix(e.target.value)}
                      placeholder="INV-"
                      className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono uppercase"
                    />
                  </div>
                </div>
              </div>

              {/* Hardware & Paper Width */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-950/70 border border-slate-200 dark:border-zinc-800 space-y-3">
                <h4 className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
                  <Printer className="w-3.5 h-3.5 text-blue-600" />
                  {pickText('প্রিন্টার ফরম্যাট ও সাইজ', 'Printer Format & Size')}
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setPaperWidth('80mm')}
                    className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                      paperWidth === '80mm'
                        ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200'
                        : 'border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300'
                    }`}
                  >
                    <div className="font-bold text-xs">80mm (Standard)</div>
                    <div className="text-[10px] text-slate-500 dark:text-zinc-400 mt-0.5">
                      {pickText('কাউন্টার ক্যাশ ড্রয়ার থার্মাল', 'Counter Cash Drawer Thermal')}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaperWidth('58mm')}
                    className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                      paperWidth === '58mm'
                        ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200'
                        : 'border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300'
                    }`}
                  >
                    <div className="font-bold text-xs">58mm (Compact)</div>
                    <div className="text-[10px] text-slate-500 dark:text-zinc-400 mt-0.5">
                      {pickText('পোর্টেবল ব্লুটুথ পকেট প্রিন্টার', 'Portable Bluetooth Pocket Printer')}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaperWidth('custom')}
                    className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                      paperWidth === 'custom'
                        ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200'
                        : 'border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300'
                    }`}
                  >
                    <div className="font-bold text-xs">{pickText('কাস্টম সাইজ', 'Custom Size')}</div>
                    <div className="text-[10px] text-slate-500 dark:text-zinc-400 mt-0.5">
                      {pickText('যেকোনো মিলিমিটার সাইজ', 'Custom Width in Millimeters')}
                    </div>
                  </button>
                </div>

                {paperWidth === 'custom' && (
                  <div className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-emerald-500/40 space-y-2 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-900 dark:text-white">
                        {pickText('কাস্টম রিসিট প্রস্থ (Paper Width in mm):', 'Custom Paper Width (in mm):')}
                      </label>
                      <div className="flex items-center gap-1.5 font-mono text-xs">
                        <input
                          type="number"
                          min={40}
                          max={150}
                          value={customPaperWidth}
                          onChange={(e) => setCustomPaperWidth(Number(e.target.value) || 76)}
                          className="w-20 bg-slate-50 dark:bg-zinc-950 border border-emerald-500 rounded-lg px-2 py-1 text-center font-bold text-emerald-600 dark:text-emerald-400 focus:outline-none"
                        />
                        <span className="text-slate-500 font-bold">mm</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px]">
                      <span className="text-slate-400">{pickText('জনপ্রিয় সাইজ প্রিসেট:', 'Popular Presets:')}</span>
                      {[72, 76, 82, 100].map((size) => (
                        <button
                          key={size}
                          type="button"
                          onClick={() => setCustomPaperWidth(size)}
                          className={`px-2 py-0.5 rounded-md font-mono font-semibold transition cursor-pointer ${
                            customPaperWidth === size
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300'
                          }`}
                        >
                          {size}mm
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Toggles */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-950/70 border border-slate-200 dark:border-zinc-800 space-y-2.5">
                <h4 className="font-bold text-slate-900 dark:text-white text-xs">
                  {pickText('রসিদে প্রদর্শনের অপশন', 'Receipt Display Options')}
                </h4>

                <label className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 cursor-pointer">
                  <span>{pickText('BIN / মূসক নিবন্ধন নম্বর রসিদে প্রদর্শন করুন', 'Show BIN / VAT Number on Receipt')}</span>
                  <input
                    type="checkbox"
                    checked={showBinOnInvoice}
                    onChange={(e) => setShowBinOnInvoice(e.target.checked)}
                    className="w-4 h-4 rounded accent-emerald-600"
                  />
                </label>

                <label className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 cursor-pointer">
                  <span>{pickText('বিক্রয়কারী কর্মীর নাম প্রদর্শন করুন', 'Show Salesperson Name on Receipt')}</span>
                  <input
                    type="checkbox"
                    checked={showSalesmanOnInvoice}
                    onChange={(e) => setShowSalesmanOnInvoice(e.target.checked)}
                    className="w-4 h-4 rounded accent-emerald-600"
                  />
                </label>

                <label className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 cursor-pointer">
                  <span>
                    {isClothingStore
                      ? pickText('ট্রায়াল রুম অল্টারেশন নোট লাইনে দেখান', 'Show Trial Room Alteration Note in Line Items')
                      : pickText('DTF কাস্টম প্রিন্ট স্পেসিফিকেশন লাইনে দেখান', 'Show Custom DTF Specifications in Line Items')}
                  </span>
                  <input
                    type="checkbox"
                    checked={showCustomDetailsOnInvoice}
                    onChange={(e) => setShowCustomDetailsOnInvoice(e.target.checked)}
                    className="w-4 h-4 rounded accent-emerald-600"
                  />
                </label>

                <label className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 cursor-pointer">
                  <span>{pickText('রসিদের নিচে ডিজিটাল QR কোড প্রদর্শন করুন', 'Show Digital QR Code at Bottom of Receipt')}</span>
                  <input
                    type="checkbox"
                    checked={showQrCodeOnInvoice}
                    onChange={(e) => setShowQrCodeOnInvoice(e.target.checked)}
                    className="w-4 h-4 rounded accent-emerald-600"
                  />
                </label>
              </div>

              {/* Policy & Footer Note */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-950/70 border border-slate-200 dark:border-zinc-800 space-y-3">
                <div>
                  <label className="block text-slate-600 dark:text-zinc-400 font-semibold mb-1">
                    {pickText('এক্সচেঞ্জ ও রিটার্ন পলিসি নোট', 'Exchange & Return Policy Note')}
                  </label>
                  <textarea
                    rows={2}
                    value={invoiceReturnPolicy}
                    onChange={(e) => setInvoiceReturnPolicy(e.target.value)}
                    className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-zinc-400 font-semibold mb-1">
                    {pickText('ফুটার কৃতজ্ঞতা নোট', 'Footer Thank You Note')}
                  </label>
                  <input
                    type="text"
                    value={footerThankYouNote}
                    onChange={(e) => setFooterThankYouNote(e.target.value)}
                    className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-2 transition shadow-xs cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{pickText('ইনভয়েস সেটিংস সেভ করুন', 'Save Invoice Settings')}</span>
                </button>
              </div>
            </form>

            {/* Right Column: Live Interactive Thermal Slip Preview (5 cols) */}
            <div className="lg:col-span-5 flex flex-col items-center">
              <div className="text-xs font-bold text-slate-500 dark:text-zinc-400 mb-2 flex items-center gap-1.5 self-start">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>
                  {pickText(
                    `লাইভ থার্মাল স্লিপ প্রিভিউ (${paperWidth === 'custom' ? `${customPaperWidth}mm কাস্টম` : paperWidth})`,
                    `Live Thermal Slip Preview (${paperWidth === 'custom' ? `${customPaperWidth}mm Custom` : paperWidth})`
                  )}
                </span>
              </div>

              {/* Thermal Receipt Paper Sheet */}
              <div
                className="bg-white text-zinc-900 p-4 sm:p-5 rounded-2xl shadow-xl border border-zinc-200 space-y-3 font-mono text-xs w-full transition-all mx-auto"
                style={{
                  maxWidth:
                    paperWidth === '58mm'
                      ? '280px'
                      : paperWidth === 'custom'
                      ? `${Math.max(220, Math.min(480, customPaperWidth * 3.8))}px`
                      : '340px',
                }}
              >
                {/* Shop Branding Header */}
                <div className="text-center pb-2 border-b-2 border-dashed border-zinc-400 space-y-0.5">
                  <h2 className="text-sm font-black uppercase tracking-tight text-zinc-950">
                    {shopName || currentTenant.name}
                  </h2>
                  {bengaliName && (
                    <p className="text-[11px] font-bold text-zinc-700">{bengaliName}</p>
                  )}
                  {headerSlogan && (
                    <p className="text-[9px] text-zinc-500 italic leading-tight">{headerSlogan}</p>
                  )}
                  <p className="text-[10px] text-zinc-600 mt-1">
                    {currentTenant.marketMallName} • {currentTenant.shopNo}
                  </p>
                  <p className="text-[10px] text-zinc-600">Hotline: {hotlinePhone}</p>
                  {showBinOnInvoice && (
                    <p className="text-[9px] font-bold text-zinc-500">
                      BIN: {binNumber || 'BIN-003849120-01'}
                    </p>
                  )}
                </div>

                {/* Memo Meta */}
                <div className="flex justify-between text-[10px] text-zinc-600 pb-1 border-b border-zinc-300">
                  <div>MEMO: <strong>{invoicePrefix}2026-108</strong></div>
                  <div>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                </div>

                {/* Customer Details */}
                <div className="text-[11px] leading-tight space-y-0.5">
                  <div>Customer: <strong>Tanzim Shakil</strong></div>
                  <div>Phone: <strong>01712-998877</strong></div>
                  {showSalesmanOnInvoice && (
                    <div>Served by: <strong>{activeStaff?.name || 'Tanvir Ahmed'}</strong></div>
                  )}
                </div>

                {/* Item List */}
                <div className="border-t border-b border-zinc-400 py-1.5 space-y-1.5">
                  <div>
                    <div className="flex justify-between font-bold">
                      <span className="truncate pr-2">
                        {isClothingStore ? 'Richman Slim Fit Jeans' : 'Real Madrid Home 24/25'}
                      </span>
                      <span>৳1,200</span>
                    </div>
                    <div className="text-[10px] text-zinc-500 flex justify-between">
                      <span>{isClothingStore ? 'Size: 32 • Qty: 1' : 'Size: L • Qty: 1'}</span>
                      <span>@ ৳1,200</span>
                    </div>
                    {showCustomDetailsOnInvoice && (
                      <div className="text-[9px] bg-zinc-100 p-1 rounded font-semibold text-zinc-700 mt-0.5">
                        {isClothingStore
                          ? '[ALTERATION: Length -1.5 inch hemming]'
                          : '[PRINT: BELLINGHAM #5 • UCL Font]'}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex justify-between font-bold">
                      <span className="truncate pr-2">
                        {isClothingStore ? 'Oxford Cotton Formal Shirt' : 'Argentina Retro 1994 Away'}
                      </span>
                      <span>৳1,350</span>
                    </div>
                    <div className="text-[10px] text-zinc-500 flex justify-between">
                      <span>Size: XL • Qty: 1</span>
                      <span>@ ৳1,350</span>
                    </div>
                  </div>
                </div>

                {/* Totals Summary */}
                <div className="space-y-1 text-right text-[11px]">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>৳2,550</span>
                  </div>
                  <div className="flex justify-between text-rose-600">
                    <span>Discount:</span>
                    <span>-৳150</span>
                  </div>
                  <div className="flex justify-between font-bold text-sm border-t border-zinc-400 pt-1">
                    <span>TOTAL:</span>
                    <span>৳2,400</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-emerald-700 font-semibold">
                    <span>Paid (bKash Merchant):</span>
                    <span>৳2,400</span>
                  </div>
                </div>

                {/* QR Code and Policy Footer */}
                <div className="pt-2 border-t-2 border-dashed border-zinc-400 text-center space-y-1.5">
                  {showQrCodeOnInvoice && (
                    <div className="flex items-center justify-center gap-1.5 text-[10px] text-zinc-600">
                      <QrCode className="w-5 h-5 text-zinc-800" />
                      <span className="text-[9px]">
                        {qrCodeType === 'verification' ? 'Scan to verify digital memo' : 'Scan to pay via bKash'}
                      </span>
                    </div>
                  )}

                  <p className="text-[9px] text-zinc-500 italic leading-tight px-1">
                    "{invoiceReturnPolicy}"
                  </p>

                  <div className="text-[9px] font-bold text-zinc-700">
                    {footerThankYouNote}
                  </div>

                  <div className="text-[8px] text-zinc-400 uppercase tracking-widest font-sans pt-1">
                    Powered by LEKHO POS BD
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: MANAGE OPERATORS & STAFF (Strictly Owner / Super Admin Only)       */}
      {/* ========================================================================= */}
      {activeSettingsTab === 'operators' && canAccessSettingsTab(role, 'operators') && (
        <div className="bg-transparent border-0 p-1 sm:p-2 space-y-5 shadow-none">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-zinc-800">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400" strokeWidth={1.75} />
                <span>{pickText('অপারেটর ও স্টাফ তালিকা', 'Manage Operators & Counter Staff')}</span>
                <InfoTooltip text={pickText(
                  'দোকানের ক্যাশিয়ার ও সেলস কর্মীদের রোল, কমিশন এবং সুরক্ষিত ৪-ডিজিট কাউন্টার পিন রিসেট',
                  'Configure counter staff roles, commission rates, and secure 4-digit PIN reset'
                )} />
              </h3>
            </div>

            <button
              onClick={() => setIsAddStaffOpen(true)}
              className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>{pickText('অপারেটর যোগ করুন', 'Add Operator')}</span>
            </button>
          </div>

          {/* Clean Operators Data Table (No Plaintext PIN Exposure!) */}
          <div className="border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-zinc-950 border-b border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 font-semibold select-none">
                    <th className="py-3 px-4">{pickText('অপারেটর আইডি', 'Operator ID')}</th>
                    <th className="py-3 px-3">{pickText('নাম', 'Name')}</th>
                    <th className="py-3 px-3">{pickText('ফোন ও ইউজার', 'Phone & User')}</th>
                    <th className="py-3 px-3">{pickText('রোল', 'Role')}</th>
                    <th className="py-3 px-3 text-center">{pickText('কাউন্টার পিন নিরাপত্তা', 'Counter PIN Security')}</th>
                    <th className="py-3 px-3 text-center">{pickText('প্রফিট মোড', 'Profit Mode')}</th>
                    <th className="py-3 px-3 text-right">{pickText('কমিশন', 'Commission')}</th>
                    <th className="py-3 px-3 text-center">{pickText('স্ট্যাটাস', 'Status')}</th>
                    <th className="py-3 px-4 text-center">{pickText('অ্যাকশন', 'Action')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800 text-slate-800 dark:text-zinc-200">
                  {staffList.map((operator) => (
                    <tr key={operator.id} className="hover:bg-slate-50/60 dark:hover:bg-zinc-800/40 transition">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                        {operator.id.replace('staff_', 'OP-').replace('op_', 'OP-')}
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                        {operator.name}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap text-slate-600 dark:text-zinc-400">
                        <div>{operator.phone}</div>
                        {operator.email && (
                          <div className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400">{operator.email}</div>
                        )}
                        <div className="text-[10px] text-slate-400">@{operator.username || operator.id}</div>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                          operator.role === 'owner'
                            ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800'
                            : operator.role === 'manager'
                            ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800'
                            : 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'
                        }`}>
                          {operator.role === 'owner'
                            ? pickText('স্টোর অ্যাডমিন', 'Store Admin')
                            : operator.role === 'manager'
                            ? pickText('স্টোর ম্যানেজার', 'Store Manager')
                            : pickText('ফ্লোর সেলসম্যান', 'Floor Salesman')}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-[11px] font-mono font-bold text-slate-700 dark:text-zinc-300">
                          <Lock className="w-3 h-3 text-emerald-600" />
                          <span>{pickText('•••• (সুরক্ষিত)', '•••• (Protected)')}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {operator.permissions?.canViewProfits ? (
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">{pickText('আনলকড', 'Unlocked')}</span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50 font-semibold">
                            {pickText('ব্লাইন্ড (গোপন)', 'Blind (Masked)')}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-semibold whitespace-nowrap">
                        ৳{operator.commissionPerPiece || 0} / pc
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {operator.status === 'pending_verification' ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
                            {pickText('ওটিপি পেন্ডিং', 'Pending OTP')}
                          </span>
                        ) : (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            operator.active
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
                              : 'bg-slate-200 text-slate-600 border-slate-300 dark:bg-zinc-800 dark:text-zinc-400'
                          }`}>
                            {operator.active ? pickText('সক্রিয়', 'Active') : pickText('নিষ্ক্রিয়', 'Disabled')}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setStaffResetPinError('');
                              setNewStaffResetPinInput('');
                              setResetStaffTarget(operator);
                            }}
                            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-amber-200 dark:border-amber-800 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 cursor-pointer transition shadow-2xs"
                          >
                            {pickText('পিন রিসেট', 'Reset PIN')}
                          </button>
                          {operator.status === 'pending_verification' && operator.email ? (
                            <button
                              type="button"
                              onClick={() => {
                                setPendingStaffEmail(operator.email!);
                                setStaffOtpCode('');
                                setIsVerifyStaffOpen(true);
                              }}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-bold border border-indigo-200 dark:border-indigo-800 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 cursor-pointer transition shadow-2xs"
                            >
                              {pickText('ওটিপি যাচাই', 'Verify OTP')}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleToggleOperatorStatus(operator.id)}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-slate-200 dark:border-zinc-700 bg-white hover:bg-slate-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 cursor-pointer transition shadow-2xs"
                            >
                              {operator.active ? pickText('নিষ্ক্রিয় করুন', 'Deactivate') : pickText('সক্রিয় করুন', 'Activate')}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: KIT & OTHERS CATEGORIES WITH ROLE-AWARE PRICING                      */}
      {/* ========================================================================= */}
      {activeSettingsTab === 'categories' && <CategorySettingsTab />}

      {/* ========================================================================= */}
      {/* TAB 3: SUBSCRIPTION & STORES DIRECTORY (Owner Only)                       */}
      {/* ========================================================================= */}
      {activeSettingsTab === 'subscription' && canAccessSettingsTab(role, 'subscription') && (
        <div className="bg-transparent border-0 p-1 sm:p-2 space-y-5 shadow-none">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-zinc-800">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Building2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" strokeWidth={1.75} />
                <span>{pickText('সকল আউটলেট ও শাখা', 'Stores Directory')}</span>
                <InfoTooltip text={pickText(
                  'আপনার মাল্টি-ব্রাঞ্চ রিটেইল শপগুলোর তালিকা ও সক্রিয় কুরিয়ার পিকআপ লোকেশন',
                  'Manage multi-branch retail outlets and active courier pickup locations'
                )} />
              </h3>
            </div>

            <button
              onClick={() => onOpenOnboarding && onOpenOnboarding()}
              className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>{pickText('নতুন স্টোর তৈরি করুন', 'Create Store')}</span>
            </button>
          </div>

          {/* Clean Stores Table (Exact Layout as Pathao Image 1) */}
          <div className="border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-zinc-950 border-b border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 font-semibold select-none">
                    <th className="py-3 px-4">{pickText('আইডি', 'Id')}</th>
                    <th className="py-3 px-3">{pickText('নাম', 'Name')}</th>
                    <th className="py-3 px-3">{pickText('ঠিকানা', 'Address')}</th>
                    <th className="py-3 px-3">{pickText('ক্যাটাগরি', 'Category')}</th>
                    <th className="py-3 px-4 text-center">{pickText('অ্যাকশন', 'Action')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800 text-slate-800 dark:text-zinc-200">
                  {tenants.map((tenant) => {
                    const isCurrent = tenant.id === currentTenant.id;
                    return (
                      <tr key={tenant.id} className="hover:bg-slate-50/60 dark:hover:bg-zinc-800/40 transition">
                        <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                          {tenant.id === 'shop_galleria_sports' ? '192916' : tenant.id.replace('shop_', '')}
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span>{tenant.name}</span>
                            {isCurrent && (
                              <span className="text-[10px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 px-1.5 py-0.2 rounded border border-emerald-200 font-bold">
                                {pickText('বর্তমান', 'Current')}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3 max-w-sm text-slate-600 dark:text-zinc-400">
                          {tenant.marketMallName} • {tenant.shopNo}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap capitalize text-slate-700 dark:text-zinc-300">
                          {tenant.category} Store
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            {!isCurrent ? (
                              <button
                                type="button"
                                onClick={() => switchTenant(tenant.id)}
                                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer transition shadow-2xs"
                              >
                                {pickText('স্টোর পরিবর্তন', 'Switch Store')}
                              </button>
                            ) : (
                              <span className="px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-slate-200 dark:border-zinc-700 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400">
                                {pickText('ডিফল্ট পিকআপ স্টোর', 'Default Pickup Store')}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                openSettingsSubpage('profile');
                                showToast(`Editing store: ${tenant.name}`, 'info');
                              }}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-400 cursor-pointer transition"
                            >
                              {pickText('এডিট', 'Edit')}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: PARTNERS & PASSWORDS (Strictly Owner / Super Admin Only)           */}
      {/* ========================================================================= */}
      {activeSettingsTab === 'partners' && canAccessSettingsTab(role, 'partners') && (
        <div className="bg-transparent border-0 p-1 sm:p-2 space-y-5 shadow-none">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-zinc-800">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-emerald-600 dark:text-emerald-400" strokeWidth={1.75} />
                <span>{pickText('ব্যবসার ওনার ও পার্টনার আইডি', 'Partners & Passwords')}</span>
                <InfoTooltip text={pickText(
                  'প্রত্যেক অংশীদারের ইউজারনেম, এনক্রিপ্টেড উত্তোলন পাসওয়ার্ড এবং লাভ বণ্টন শতাংশ',
                  'Manage partner usernames, encrypted withdrawal passwords, and profit share percentages'
                )} />
              </h3>
            </div>

            <button
              onClick={() => {
                setOwnerModalError('');
                setIsAddOwnerOpen(true);
              }}
              className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>{pickText('পার্টনার আইডি যোগ করুন', 'Add Partner ID')}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ownersList.map((owner) => {
              const netEquity = (owner.totalAdded || 0) - (owner.totalWithdrawn || 0);

              return (
                <div
                  key={owner.id}
                  className="bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4.5 space-y-3 relative hover:border-slate-300 dark:hover:border-zinc-700 transition"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span>{owner.name}</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-semibold">
                          @{owner.username}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 dark:text-zinc-400 mt-1 flex items-center gap-3">
                        <span>{owner.phone}</span>
                        <span>•</span>
                        <span>{pickText('অংশীদারিত্ব:', 'Partnership Share:')} <strong>{owner.sharePercentage || 50}%</strong></span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300">
                        {pickText('সক্রিয় পার্টনার', 'Active Partner')}
                      </span>
                      {ownersList.length > 1 && (
                        <button
                          onClick={() => handleDeleteOwner(owner.id, owner.name)}
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer"
                          title={pickText('পার্টনার মুছে ফেলুন', 'Remove Partner')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Hashed Credential Row (No Plaintext Reveal!) */}
                  <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <Lock className="w-3.5 h-3.5 text-emerald-600" strokeWidth={1.75} />
                      <span className="text-slate-600 dark:text-zinc-400">{pickText('উত্তোলনের গোপন পাসওয়ার্ড:', 'Withdrawal Verification Password:')}</span>
                      <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                        {pickText('•••••• (এনক্রিপ্টেড)', '•••••• (Encrypted)')}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setPartnerPassError('');
                        setNewPartnerPassInput('');
                        setConfirmPartnerPassInput('');
                        setResetPartnerTarget(owner);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 font-semibold text-[11px] cursor-pointer transition"
                    >
                      {pickText('পাসওয়ার্ড পরিবর্তন', 'Change Password')}
                    </button>
                  </div>

                  {/* Partner Ledgers */}
                  <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                    <div className="bg-white dark:bg-zinc-900 p-2.5 rounded-xl border border-slate-200 dark:border-zinc-800">
                      <span className="text-[10px] text-slate-400 dark:text-zinc-500 block">{pickText('মোট উত্তোলন:', 'Total Withdrawn:')}</span>
                      <strong className="font-mono text-rose-600 dark:text-rose-400">
                        -৳{(owner.totalWithdrawn || 0).toLocaleString()}
                      </strong>
                    </div>

                    <div className="bg-white dark:bg-zinc-900 p-2.5 rounded-xl border border-slate-200 dark:border-zinc-800">
                      <span className="text-[10px] text-slate-400 dark:text-zinc-500 block">{pickText('মোট মূলধন জমা:', 'Total Capital Added:')}</span>
                      <strong className="font-mono text-emerald-600 dark:text-emerald-400">
                        +৳{(owner.totalAdded || 0).toLocaleString()}
                      </strong>
                    </div>
                  </div>

                  <div className="pt-1.5 text-right text-[11px] text-slate-500 dark:text-zinc-400">
                    {pickText('নিট অবস্থান:', 'Net Equity Position:')} <strong className={netEquity >= 0 ? 'text-emerald-600 dark:text-emerald-400 font-mono' : 'text-rose-600 font-mono'}>
                      {netEquity >= 0 ? `+৳${netEquity.toLocaleString()}` : `-৳${Math.abs(netEquity).toLocaleString()}`}
                    </strong>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: PAYMENT INFORMATION & WALLETS (Strictly Owner / Super Admin Only)  */}
      {/* ========================================================================= */}
      {activeSettingsTab === 'payments' && canAccessSettingsTab(role, 'payments') && (
        <div className="bg-transparent border-0 p-1 sm:p-2 space-y-5 shadow-none">
          <div className="pb-4 border-b border-slate-200 dark:border-zinc-800">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-600 dark:text-emerald-400" strokeWidth={1.75} />
              <span>{pickText('পেমেন্ট চ্যানেল ও ড্রয়ার হিসাব', 'Payment Information')}</span>
              <InfoTooltip text={pickText(
                'বিকাশ মার্চেন্ট QR, পার্সোনাল বিকাশ, নগদ এবং ব্যাংক অ্যাকাউন্ট তথ্য কনফিগার করুন',
                'Configure bKash Merchant, personal wallets, Nagad, and bank accounts'
              )} />
            </h3>
          </div>

          {/* Quick Balance Overview */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
            <div className="bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl p-3">
              <span className="text-[10px] text-slate-500 dark:text-zinc-400 block font-semibold">{pickText('ক্যাশ ড্রয়ার', 'Cash Drawer')}</span>
              <strong className="text-sm font-mono text-emerald-600 dark:text-emerald-400">৳{drawers.cash.toLocaleString()}</strong>
            </div>
            <div className="bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl p-3">
              <span className="text-[10px] text-slate-500 dark:text-zinc-400 block font-semibold">{pickText('বিকাশ মার্চেন্ট QR', 'bKash Merchant QR')}</span>
              <strong className="text-sm font-mono text-pink-600 dark:text-pink-400">৳{drawers.merchantBkash.toLocaleString()}</strong>
            </div>
            <div className="bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl p-3">
              <span className="text-[10px] text-slate-500 dark:text-zinc-400 block font-semibold">{pickText('পার্সোনাল বিকাশ', 'Personal bKash')}</span>
              <strong className="text-sm font-mono text-rose-600 dark:text-rose-400">৳{drawers.personalBkash.toLocaleString()}</strong>
            </div>
            <div className="bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl p-3">
              <span className="text-[10px] text-slate-500 dark:text-zinc-400 block font-semibold">{pickText('নগদ একাউন্ট', 'Nagad Account')}</span>
              <strong className="text-sm font-mono text-amber-600 dark:text-amber-400">৳{drawers.nagad.toLocaleString()}</strong>
            </div>
            <div className="bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl p-3">
              <span className="text-[10px] text-slate-500 dark:text-zinc-400 block font-semibold">{pickText('ব্যাংক হিসাব', 'Bank Account')}</span>
              <strong className="text-sm font-mono text-blue-600 dark:text-blue-400">৳{drawers.bank.toLocaleString()}</strong>
            </div>
          </div>

          <form onSubmit={handleSavePaymentSettings} className="space-y-4 pt-2">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5 flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-pink-500" />
                  <span>{pickText('বিকাশ মার্চেন্ট নম্বর (QR কোড)', 'bKash Merchant Number (QR Code)')}</span>
                </label>
                <input
                  type="text"
                  value={bkashMerchant}
                  onChange={(e) => setBkashMerchant(e.target.value)}
                  placeholder="01711xxxxxx"
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5 flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-rose-500" />
                  <span>{pickText('বিকাশ পার্সোনাল (পার্টনার ওয়ালেট)', 'bKash Personal (Partner Wallet)')}</span>
                </label>
                <input
                  type="text"
                  value={bkashPersonal}
                  onChange={(e) => setBkashPersonal(e.target.value)}
                  placeholder="01799xxxxxx"
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5 flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-amber-500" />
                  <span>{pickText('নগদ নম্বর (পার্সোনাল/উদ্যোক্তা)', 'Nagad Number (Personal/Uddokta)')}</span>
                </label>
                <input
                  type="text"
                  value={nagadNumber}
                  onChange={(e) => setNagadNumber(e.target.value)}
                  placeholder="01811xxxxxx"
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-blue-500" />
                  <span>{pickText('ব্যাংকের নাম', 'Bank Name')}</span>
                </label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                  {pickText('শাখার নাম', 'Branch Name')}
                </label>
                <input
                  type="text"
                  value={bankBranch}
                  onChange={(e) => setBankBranch(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                  {pickText('অ্যাকাউন্ট নম্বর', 'Account Number')}
                </label>
                <input
                  type="text"
                  value={bankAccountNo}
                  onChange={(e) => setBankAccountNo(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                  {pickText('রাউটিং নম্বর', 'Routing Number')}
                </label>
                <input
                  type="text"
                  value={bankRoutingNo}
                  onChange={(e) => setBankRoutingNo(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center gap-2 transition shadow-xs cursor-pointer"
              >
                <Save className="w-4 h-4" strokeWidth={1.75} />
                <span>{pickText('পেমেন্ট তথ্য সেভ করুন', 'Save Payment Information')}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: DEVELOPER'S & COURIER API (Owner Only)                             */}
      {/* ========================================================================= */}
      {activeSettingsTab === 'api' && canAccessSettingsTab(role, 'api') && (
        <div className="bg-transparent border-0 p-1 sm:p-2 space-y-5 shadow-none">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-zinc-800">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Code2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" strokeWidth={1.75} />
                <span>{pickText('কুরিয়ার এপিআই সংযোগ', "Developer's API & Courier Integration")}</span>
                <InfoTooltip text={pickText(
                  'Steadfast Courier ও Pathao Courier-এর সাথে সরাসরি এপিআই কানেকশন',
                  'Direct API integration with Steadfast Courier & Pathao Courier'
                )} />
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-[11px] font-bold">
                Local Mode / Simulation (No Live External Dispatch)
              </span>
              <button
                type="button"
                onClick={handleTestCourierConnection}
                disabled={isCourierTesting}
                className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 border border-slate-300 dark:border-zinc-700 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isCourierTesting ? 'animate-spin' : ''}`} />
                <span>Verify Local Config</span>
              </button>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <strong>Integration Status — Local Mode / Simulation:</strong> পার্সেল বুকিং ও ট্র্যাকিং এন্ট্রিগুলো বর্তমানে লোকাল ডাটাবেসে সংরক্ষিত হয়। সরাসরি Steadfast বা Pathao-এর লাইভ সার্ভারে স্বয়ংক্রিয়ভাবে পার্সেল প্রেরণ (Live External API Dispatch) এখনো সংযুক্ত নয়।
            </div>
          </div>

          <form onSubmit={handleSaveCourierSettings} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                  {pickText('কুরিয়ার সার্ভিস', 'Courier Provider')}
                </label>
                <select
                  value={courierProvider}
                  onChange={(e) => setCourierProvider(e.target.value as any)}
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:border-emerald-500"
                >
                  <option value="both">Both (Steadfast Courier + Pathao)</option>
                  <option value="steadfast">Steadfast Courier BD</option>
                  <option value="pathao">Pathao Courier</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                  API Key / Client ID
                </label>
                <input
                  type="text"
                  value={courierApiKey}
                  onChange={(e) => setCourierApiKey(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                  API Secret
                </label>
                <input
                  type="password"
                  value={courierApiSecret}
                  onChange={(e) => setCourierApiSecret(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                {pickText('স্বয়ংক্রিয় পার্সেল স্ট্যাটাস ও ট্র্যাকিং সিঙ্ক', 'Webhook Listener URL')}
              </label>
              <input
                type="text"
                value={courierWebhook}
                onChange={(e) => setCourierWebhook(e.target.value)}
                className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center gap-2 transition shadow-xs cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Save API Credentials</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 7: PRINT & SYSTEM POLICIES (Owner Only)                               */}
      {/* ========================================================================= */}
      {activeSettingsTab === 'security_tools' && canAccessSettingsTab(role, 'security_tools') && (
        <div className="bg-transparent border-0 p-1 sm:p-2 space-y-5 shadow-none">
          <div className="pb-4 border-b border-slate-200 dark:border-zinc-800">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Printer className="w-4 h-4 text-emerald-600 dark:text-emerald-400" strokeWidth={1.75} />
              <span>{pickText('রিসিট প্রিন্ট ও পলিসি', 'Print Preferences & Legal Policies')}</span>
              <InfoTooltip text={pickText(
                'থার্মাল রিসিটের সাইজ, অটো প্রিন্ট অপশন, ভ্যাট/ট্রেড লাইসেন্স এবং স্টোর মডিউলসমূহ কনফিগার করুন',
                'Configure thermal receipt size, auto-print, VAT/Trade License, and store feature modules'
              )} />
            </h3>
          </div>

          <form onSubmit={handleSavePreferences} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span>{pickText('অটো-প্রিন্ট থার্মাল রিসিট', 'Auto-Print Thermal Receipt')}</span>
                      <InfoTooltip text={pickText('বিক্রয় সম্পন্ন হওয়ার পর স্বয়ংক্রিয়ভাবে রিসিট প্রিন্ট করুন', 'Automatically print receipt upon sale completion')} />
                    </h4>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoPrintReceipt}
                    onChange={(e) => setAutoPrintReceipt(e.target.checked)}
                    className="w-4 h-4 rounded accent-emerald-600 cursor-pointer"
                  />
                </div>

                <div className="pt-2 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                    {pickText('রিসিট সাইজ:', 'Paper Width:')}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPaperWidth('80mm')}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                        paperWidth === '80mm'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800 text-slate-700 dark:text-zinc-300'
                      }`}
                    >
                      {pickText('৮০মিমি (স্ট্যান্ডার্ড পিওএস)', '80mm (Standard POS)')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaperWidth('58mm')}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                        paperWidth === '58mm'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800 text-slate-700 dark:text-zinc-300'
                      }`}
                    >
                      {pickText('৫৮মিমি (মিনি পিওএস)', '58mm (Mini POS)')}
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 space-y-2.5">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                  {pickText('সক্রিয় স্টোর ফিচারসমূহ', 'Feature Modules')}
                </h4>
                <div className="space-y-2 text-xs">
                  {!isClothingStore && (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={flagJersey}
                        onChange={(e) => setFlagJersey(e.target.checked)}
                        className="rounded accent-emerald-600 cursor-pointer"
                      />
                      <span className="text-slate-800 dark:text-zinc-200">
                        {pickText(
                          'হিট-প্রেস ডিটিএফ জার্সি কাস্টমাইজেশন পাইপলাইন',
                          'Heat-Press DTF Jersey Customization Pipeline'
                        )}
                      </span>
                    </label>
                  )}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={flagReseller}
                      onChange={(e) => setFlagReseller(e.target.checked)}
                      className="rounded accent-emerald-600 cursor-pointer"
                    />
                    <span className="text-slate-800 dark:text-zinc-200">
                      {pickText(
                        'হোলসেল ইন-স্টোর রিসেলার খাতা ও কাউন্টার',
                        'Wholesale In-Store Reseller Khata & Counter'
                      )}
                    </span>
                  </label>
                  {!isClothingStore && (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={flagTeam}
                        onChange={(e) => setFlagTeam(e.target.checked)}
                        className="rounded accent-emerald-600 cursor-pointer"
                      />
                      <span className="text-slate-800 dark:text-zinc-200">
                        {pickText(
                          'টিম বাল্ক অর্ডার ম্যাট্রিক্স ইঞ্জিন',
                          'Team Bulk Order Matrix Engine'
                        )}
                      </span>
                    </label>
                  )}
                </div>
              </div>

              {/* Extended Store Operational Rules (POS, Inventory, Exchange, Drawers) */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 space-y-3">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                  {pickText('পিওএস ও বিলিং নিয়মাবলী', 'POS & Billing Rules')}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-400 mb-1">
                      {pickText('ডিফল্ট মার্কআপ (%)', 'Default Markup (%)')}
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={500}
                      value={storeConfig.defaultMarkupPercentage ?? 85}
                      onChange={(e) =>
                        setStoreConfig({
                          ...storeConfig,
                          defaultMarkupPercentage: Number(e.target.value) || 0,
                        })
                      }
                      className="w-full bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800 rounded-xl px-3 py-2 font-mono text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-400 mb-1">
                      {pickText('সর্বোচ্চ স্টাফ ডিসকাউন্ট (%)', 'Max Staff Discount (%)')}
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={storeConfig.maxStaffDiscountPercent ?? 15}
                      onChange={(e) =>
                        setStoreConfig({
                          ...storeConfig,
                          maxStaffDiscountPercent: Number(e.target.value) || 0,
                        })
                      }
                      className="w-full bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800 rounded-xl px-3 py-2 font-mono text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-400 mb-1">
                      {pickText('কারেন্সি প্রতীক', 'Currency Symbol')}
                    </label>
                    <input
                      type="text"
                      value={storeConfig.currencySymbol || '৳'}
                      onChange={(e) =>
                        setStoreConfig({
                          ...storeConfig,
                          currencySymbol: e.target.value || '৳',
                        })
                      }
                      className="w-full bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800 rounded-xl px-3 py-2 font-mono text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-zinc-800">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span>{pickText('ইনভেন্টরি ট্র্যাকিং চালু/বন্ধ ও স্টক সীমা', 'Inventory Tracking ON/OFF & Stock Thresholds')}</span>
                      <InfoTooltip text={pickText(
                        'Inventory Tracking চালু থাকলে POS বিক্রয়ে অটো স্টক কমবে; বন্ধ থাকলে স্টক ছাড়াই দ্রুত বিলিং করা যাবে।',
                        'When enabled, POS sales automatically deduct stock. When disabled, fast billing is allowed regardless of stock.'
                      )} />
                    </h4>
                  </div>
                  <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800 cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={
                        storeConfig.inventoryTrackingEnabled !== false &&
                        storeConfig.autoDeductStockOnConfirm !== false
                      }
                      onChange={(e) => {
                        const nextEnabled = e.target.checked;
                        const updated = dbService.saveStoreConfig(currentTenant.id, {
                          inventoryTrackingEnabled: nextEnabled,
                          autoDeductStockOnConfirm: nextEnabled,
                        });
                        setStoreConfig(updated);
                        showToast(
                          nextEnabled
                            ? pickText(
                                'ইনভেন্টরি ট্র্যাকিং: চালু (POS বিক্রয়ে অটো স্টক বিয়োগ চালু)',
                                'Inventory Tracking: ON (Auto stock deduction enabled)'
                              )
                            : pickText(
                                'ইনভেন্টরি ট্র্যাকিং: বন্ধ (স্টক ছাড়াই দ্রুত POS বিলিং চালু)',
                                'Inventory Tracking: OFF (Fast POS billing without stock enabled)'
                              ),
                          'success'
                        );
                      }}
                      className="w-4 h-4 rounded accent-emerald-600 cursor-pointer"
                    />
                    <span className="text-xs font-extrabold text-emerald-800 dark:text-emerald-200">
                      {pickText('ইনভেন্টরি ট্র্যাকিং:', 'Inventory Tracking:')}{' '}
                      {storeConfig.inventoryTrackingEnabled !== false &&
                      storeConfig.autoDeductStockOnConfirm !== false
                        ? pickText('চালু', 'ON')
                        : pickText('বন্ধ', 'OFF')}
                    </span>
                  </label>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-400 mb-1">
                      {pickText('লো স্টক অ্যালার্ট (পিস)', 'Low Stock Alert (Pcs)')}
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={storeConfig.lowStockThreshold ?? 5}
                      onChange={(e) =>
                        setStoreConfig({
                          ...storeConfig,
                          lowStockThreshold: Number(e.target.value) || 5,
                        })
                      }
                      className="w-full bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800 rounded-xl px-3 py-2 font-mono text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-400 mb-1">
                      {pickText('ডেড স্টক দিন', 'Dead Stock Days')}
                    </label>
                    <input
                      type="number"
                      min={7}
                      value={storeConfig.deadStockDays ?? 60}
                      onChange={(e) =>
                        setStoreConfig({
                          ...storeConfig,
                          deadStockDays: Number(e.target.value) || 60,
                        })
                      }
                      className="w-full bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800 rounded-xl px-3 py-2 font-mono text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-400 mb-1">
                      {pickText('অলটারেশন ফি (৳)', 'Alteration Fee (৳)')}
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={storeConfig.defaultAlterationPrice ?? 100}
                      onChange={(e) =>
                        setStoreConfig({
                          ...storeConfig,
                          defaultAlterationPrice: Number(e.target.value) || 0,
                        })
                      }
                      className="w-full bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800 rounded-xl px-3 py-2 font-mono text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-400 mb-1">
                      {pickText('এক্সচেঞ্জ সময়সীমা (দিন)', 'Exchange Window (Days)')}
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={storeConfig.exchangeWindowDays ?? 3}
                      onChange={(e) =>
                        setStoreConfig({
                          ...storeConfig,
                          exchangeWindowDays: Number(e.target.value) || 3,
                        })
                      }
                      className="w-full bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800 rounded-xl px-3 py-2 font-mono text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Return policy */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                {pickText('মেমো এবং রিসিটের নিচে ছাপানোর বার্তা', 'Return & Exchange Policy')}
              </label>
              <textarea
                rows={2}
                value={returnPolicy}
                onChange={(e) => setReturnPolicy(e.target.value)}
                className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-800 rounded-xl p-3 text-xs text-slate-900 dark:text-white font-bengali resize-none focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="pt-2 flex justify-between items-center">
              <button
                type="button"
                onClick={() => setIsTrashOpen(true)}
                className="flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{pickText('রিসাইকেল বিন', 'Open Trash Bin')}</span>
              </button>

              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center gap-2 transition shadow-xs cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{pickText('পছন্দসমূহ সেভ করুন', 'Save Preferences')}</span>
              </button>
            </div>
          </form>
        </div>
      )}
        </>
      )}

      {/* Modal: Add New Operator (Image 1 & 3 Inspired) */}
      {isAddStaffOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl animate-in zoom-in-95 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-zinc-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>{pickText('নতুন অপারেটর / ক্যাশিয়ার যোগ করুন', 'Add New Operator / Cashier')}</span>
              </h3>
              <button onClick={() => setIsAddStaffOpen(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddOperator} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-zinc-300 font-semibold mb-1">{pickText('অপারেটরের নাম *', 'Operator Full Name *')}</label>
                <input
                  type="text"
                  required
                  value={newStaffName}
                  onChange={(e) => setNewStaffName(e.target.value)}
                  placeholder={pickText('যেমন: তানভীর আহমেদ', 'e.g. Tanvir Ahmed')}
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-zinc-300 font-semibold mb-1">{pickText('স্টাফ জিমেইল এড্রেস *', 'Staff Gmail Address *')}</label>
                <input
                  type="email"
                  required
                  value={newStaffEmail}
                  onChange={(e) => setNewStaffEmail(e.target.value)}
                  placeholder="staff@gmail.com"
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-zinc-300 font-semibold mb-1">{pickText('ইউজারনেম', 'Username')}</label>
                  <input
                    type="text"
                    value={newStaffUsername}
                    onChange={(e) => setNewStaffUsername(e.target.value)}
                    placeholder="tanvir"
                    className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-zinc-300 font-semibold mb-1">{pickText('পাসওয়ার্ড (কমপক্ষে ৬ অক্ষর) *', 'Password (min 6 chars) *')}</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={newStaffPin}
                    onChange={(e) => setNewStaffPin(e.target.value)}
                    placeholder="••••••"
                    className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-800 rounded-xl px-3 py-2 font-mono text-center tracking-widest text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-zinc-300 font-semibold mb-1">{pickText('অপারেটর রোল', 'Operator Role')}</label>
                <select
                  value={newStaffRole}
                  onChange={(e) => setNewStaffRole(e.target.value as any)}
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white cursor-pointer focus:outline-none focus:border-emerald-500"
                >
                  <option value="salesman">{pickText('সেলসম্যান / ক্যাশিয়ার', 'Floor Salesman / Cashier')}</option>
                  <option value="manager">{pickText('স্টোর ম্যানেজার', 'Store Manager')}</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-zinc-300 font-semibold mb-1">{pickText('মোবাইল নম্বর', 'Mobile Number')}</label>
                  <input
                    type="text"
                    value={newStaffPhone}
                    onChange={(e) => setNewStaffPhone(e.target.value)}
                    placeholder="017xxxxxxxx"
                    className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-zinc-300 font-semibold mb-1">{pickText('পিস প্রতি কমিশন (৳)', 'Commission per Piece (৳)')}</label>
                  <input
                    type="number"
                    value={newStaffCommission}
                    onChange={(e) => setNewStaffCommission(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-800 rounded-xl px-3 py-2 font-mono text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-slate-800 dark:text-zinc-200 block">Blind Profit Mode</span>
                  <span className="text-[10px] text-slate-500 dark:text-zinc-400">{pickText('ক্রয়মূল্য ও মার্জিন গোপন রাখুন', 'Hide cost price and profit margins')}</span>
                </div>
                <input
                  type="checkbox"
                  checked={newStaffBlindMode}
                  onChange={(e) => setNewStaffBlindMode(e.target.checked)}
                  className="w-4 h-4 rounded accent-emerald-600 cursor-pointer"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddStaffOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 font-semibold cursor-pointer"
                >
                  {pickText('বাতিল', 'Cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer shadow-xs"
                >
                  {pickText('ওটিপি পাঠান ও স্টাফ যোগ করুন', 'Send OTP & Add Staff')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Verify Staff Gmail OTP */}
      {isVerifyStaffOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl max-w-sm w-full p-6 shadow-2xl animate-in zoom-in-95 space-y-4">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center mx-auto">
                <Mail className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Verify Staff Gmail
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Enter the 6-digit OTP sent to <strong className="font-mono text-slate-800 dark:text-zinc-200">{pendingStaffEmail}</strong> to activate staff login.
              </p>
            </div>

            {staffDevOtp && (
              <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 text-amber-800 dark:text-amber-200 text-xs flex items-center justify-between">
                <span>Dispatched OTP: <strong className="font-mono">{staffDevOtp}</strong></span>
                <button
                  type="button"
                  onClick={() => setStaffOtpCode(staffDevOtp)}
                  className="px-2 py-0.5 rounded bg-amber-600 text-white font-bold text-[10px] cursor-pointer"
                >
                  Fill
                </button>
              </div>
            )}

            <form onSubmit={handleVerifyStaffOtp} className="space-y-3">
              <input
                type="text"
                maxLength={6}
                required
                value={staffOtpCode}
                onChange={(e) => setStaffOtpCode(e.target.value.replace(/\D/g, ''))}
                placeholder="6-Digit OTP Code"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 font-mono text-center tracking-widest text-base font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsVerifyStaffOpen(false)}
                  className="flex-1 py-2 rounded-xl border border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 text-xs font-semibold cursor-pointer"
                >
                  Verify Later
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
                >
                  Verify & Activate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Partner */}
      {isAddOwnerOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl animate-in zoom-in-95 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-zinc-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>{pickText('নতুন পার্টনার আইডি যোগ করুন', 'Add New Partner ID')}</span>
              </h3>
              <button onClick={() => setIsAddOwnerOpen(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            {ownerModalError && (
              <div className="p-2.5 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold">
                {ownerModalError}
              </div>
            )}

            <form onSubmit={handleAddOwner} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-zinc-300 font-semibold mb-1">{pickText('পার্টনারের নাম *', 'Partner Name *')}</label>
                <input
                  type="text"
                  required
                  value={newOwnerName}
                  onChange={(e) => setNewOwnerName(e.target.value)}
                  placeholder={pickText('যেমন: শাওন আহমেদ', 'e.g. Shaon Ahmed')}
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-zinc-300 font-semibold mb-1">{pickText('ইউনিক ইউজারনেম *', 'Unique Username *')}</label>
                  <input
                    type="text"
                    required
                    value={newOwnerUsername}
                    onChange={(e) => setNewOwnerUsername(e.target.value)}
                    placeholder="shawon"
                    className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-zinc-300 font-semibold mb-1">{pickText('উত্তোলন পাসওয়ার্ড *', 'Withdrawal Password *')}</label>
                  <input
                    type="password"
                    required
                    value={newOwnerPassword}
                    onChange={(e) => setNewOwnerPassword(e.target.value)}
                    placeholder={pickText('গোপন পাসওয়ার্ড', 'Secret Password')}
                    className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-zinc-300 font-semibold mb-1">{pickText('মোবাইল নম্বর', 'Mobile Number')}</label>
                  <input
                    type="text"
                    value={newOwnerPhone}
                    onChange={(e) => setNewOwnerPhone(e.target.value)}
                    placeholder="017xxxxxxxx"
                    className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-800 rounded-xl px-3 py-2 font-mono text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-zinc-300 font-semibold mb-1">{pickText('শেয়ার পার্সেন্টেজ (%)', 'Equity Share (%)')}</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={newOwnerShare}
                    onChange={(e) => setNewOwnerShare(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-800 rounded-xl px-3 py-2 font-mono text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddOwnerOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 font-semibold cursor-pointer"
                >
                  {pickText('বাতিল', 'Cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer shadow-xs"
                >
                  {pickText('পার্টনার সংরক্ষণ করুন', 'Save Partner')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Reset Staff Counter PIN (Owner Only) */}
      {resetStaffTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl max-w-sm w-full p-5 sm:p-6 shadow-2xl animate-in zoom-in-95 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-zinc-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-500" />
                <span>{pickText('স্টাফ কাউন্টার পিন রিসেট:', 'Staff Counter PIN Reset:')} {resetStaffTarget.name}</span>
              </h3>
              <button
                onClick={() => setResetStaffTarget(null)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {staffResetPinError && (
              <div className="p-2.5 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold">
                {staffResetPinError}
              </div>
            )}

            <form onSubmit={handleResetStaffPinSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-zinc-300 font-semibold mb-1">
                  {pickText('নতুন ৪-ডিজিট কাউন্টার পিন *', 'New 4-Digit Counter PIN *')}
                </label>
                <input
                  type="password"
                  maxLength={4}
                  required
                  value={newStaffResetPinInput}
                  onChange={(e) => setNewStaffResetPinInput(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-800 rounded-xl px-3 py-2.5 font-mono text-center tracking-widest text-base font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResetStaffTarget(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 font-semibold cursor-pointer"
                >
                  {pickText('বাতিল', 'Cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
                >
                  {pickText('পিন রিসেট করুন', 'Reset PIN')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Change Partner Withdrawal Password (Owner Only) */}
      {resetPartnerTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl max-w-sm w-full p-5 sm:p-6 shadow-2xl animate-in zoom-in-95 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-zinc-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-emerald-600" />
                <span>{pickText('পাসওয়ার্ড পরিবর্তন:', 'Password Change:')} {resetPartnerTarget.name}</span>
              </h3>
              <button
                onClick={() => setResetPartnerTarget(null)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {partnerPassError && (
              <div className="p-2.5 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold">
                {partnerPassError}
              </div>
            )}

            <form onSubmit={handleUpdatePartnerPasswordSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-zinc-300 font-semibold mb-1">
                  {pickText('নতুন উত্তোলন পাসওয়ার্ড *', 'New Withdrawal Password *')}
                </label>
                <input
                  type="password"
                  required
                  value={newPartnerPassInput}
                  onChange={(e) => setNewPartnerPassInput(e.target.value)}
                  placeholder={pickText('নতুন গোপন পাসওয়ার্ড', 'New Secret Password')}
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-zinc-300 font-semibold mb-1">
                  {pickText('পাসওয়ার্ড নিশ্চিত করুন *', 'Confirm Password *')}
                </label>
                <input
                  type="password"
                  required
                  value={confirmPartnerPassInput}
                  onChange={(e) => setConfirmPartnerPassInput(e.target.value)}
                  placeholder={pickText('পুনরায় লিখুন', 'Re-enter Password')}
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResetPartnerTarget(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 font-semibold cursor-pointer"
                >
                  {pickText('বাতিল', 'Cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
                >
                  {pickText('পাসওয়ার্ড সংরক্ষণ করুন', 'Save Password')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Trash Bin Modal */}
      <TrashBinModal isOpen={isTrashOpen} onClose={() => setIsTrashOpen(false)} />
    </div>
  );
};
