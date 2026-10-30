export type AppLanguage = 'bn' | 'en';

export interface BilingualText {
  bn: string;
  en: string;
}

const LANGUAGE_STORAGE_PREFIX = 'lekho_pos_lang_v1';

/**
 * Generates a tenant-and-user isolated storage key so one merchant's language
 * preference never leaks into or overwrites another tenant's preference.
 */
export function getLanguageStorageKey(shopId?: string | null, userId?: string | null): string {
  const cleanShop = String(shopId || 'default_shop').trim();
  const cleanUser = String(userId || 'default_user').trim();
  return `${LANGUAGE_STORAGE_PREFIX}::${cleanShop}::${cleanUser}`;
}

export function normalizeAppLanguage(value?: string | null): AppLanguage {
  if (value === 'en') return 'en';
  return 'bn';
}

export const UI_TRANSLATIONS: Record<string, BilingualText> = {
  // Brand & Common Actions
  'app.subtitle': {
    bn: 'স্মার্ট রিটেইল ও ইনভেন্টরি পজ',
    en: 'Smart Retail & Inventory POS',
  },
  'action.back': {
    bn: 'ফিরে যান',
    en: 'Back',
  },
  'action.backToHome': {
    bn: 'হোমে ফিরুন',
    en: 'Back to Home',
  },
  'action.backToSettings': {
    bn: 'সব সেটিংসে ফিরুন',
    en: 'Back to Settings',
  },
  'action.save': {
    bn: 'সংরক্ষণ করুন',
    en: 'Save Changes',
  },
  'action.cancel': {
    bn: 'বাতিল করুন',
    en: 'Cancel',
  },
  'action.search': {
    bn: 'খুঁজুন...',
    en: 'Search...',
  },
  'action.close': {
    bn: 'বন্ধ করুন',
    en: 'Close',
  },
  'action.edit': {
    bn: 'সম্পাদনা',
    en: 'Edit',
  },
  'action.add': {
    bn: 'নতুন যোগ করুন',
    en: 'Add New',
  },

  // Navigation & Tabs
  'nav.home': {
    bn: 'হোম হাব',
    en: 'Home Hub',
  },
  'nav.pos': {
    bn: 'পিওএস কাউন্টার',
    en: 'POS Counter',
  },
  'nav.dashboard': {
    bn: 'সামারি ড্যাশবোর্ড',
    en: 'Summary Dashboard',
  },
  'nav.inventory': {
    bn: 'ইনভেন্টরি ও স্টক',
    en: 'Inventory & Stock',
  },
  'nav.categories': {
    bn: 'ক্যাটাগরি ও মূল্য',
    en: 'Categories & Price',
  },
  'nav.customers': {
    bn: 'কাস্টমার ও লয়্যালটি',
    en: 'Customers & Loyalty',
  },
  'nav.offers': {
    bn: 'উৎসবের অফার বার্তা',
    en: 'Offer Announcement',
  },
  'nav.invoices': {
    bn: 'মেমো ও লেনদেন খাতা',
    en: 'Transactions & Invoices',
  },
  'nav.dueList': {
    bn: 'বাকি খাতা',
    en: 'Due List',
  },
  'nav.drawers': {
    bn: 'মাল্টি-ড্রয়ার ক্যাশ',
    en: 'Multi-Drawer Vault',
  },
  'nav.dailyClosing': {
    bn: 'ডেইলি ক্লোজিং ও জেড-রিপোর্ট',
    en: 'Daily Closing',
  },
  'nav.expenses': {
    bn: 'দোকানের খরচ খাতা',
    en: 'Expense Ledger',
  },
  'nav.reseller': {
    bn: 'পাইকারি ও রিসেলার',
    en: 'Wholesale & Reseller',
  },
  'nav.exchange': {
    bn: 'সাইজ এক্সচেঞ্জ',
    en: 'Size Exchange',
  },
  'nav.alteration': {
    bn: 'অল্টারেশন ও টেইলারিং',
    en: 'Tailoring & Alteration',
  },
  'nav.pipeline': {
    bn: 'জার্সি প্রিন্ট পাইপলাইন',
    en: 'Jersey Print Pipeline',
  },
  'nav.team': {
    bn: 'টিম বাল্ক অর্ডার',
    en: 'Team Bulk Matrix',
  },
  'nav.lotSplitter': {
    bn: 'লট কস্ট ক্যালকুলেটর',
    en: 'Lot Cost Splitter',
  },
  'nav.deadStock': {
    bn: 'ডেড-স্টক অ্যালার্ট',
    en: 'Dead-Stock Alerts',
  },
  'nav.settings': {
    bn: 'স্টোর সেটিংস',
    en: 'Store Settings',
  },
  'nav.help': {
    bn: 'হেল্প সেন্টার ও গাইড',
    en: 'Help Center',
  },
  'nav.more': {
    bn: 'আরও মেনু',
    en: 'More',
  },

  // Settings Hub Sections
  'settings.title': {
    bn: 'স্টোর সেটিংস ও কনফিগারেশন',
    en: 'Store Settings & Configuration',
  },
  'settings.subtitle': {
    bn: 'দোকানের প্রোফাইল, ভাষা, ইনভেন্টরি, পেমেন্ট, স্টাফ এবং হেল্প সেন্টার নিয়ন্ত্রণ করুন',
    en: 'Manage store profile, language, inventory, payments, staff, and help center',
  },
  'settings.searchPlaceholder': {
    bn: 'সেটিংস খুঁজুন (যেমন: ভাষা, প্রিন্টার, পিন, কুরিয়ার, ক্যাটাগরি)...',
    en: 'Search settings (e.g. language, printer, PIN, courier, category)...',
  },
  'settings.group.account': {
    bn: 'অ্যাকাউন্ট ও প্রোফাইল',
    en: 'Account & Profile',
  },
  'settings.group.account.desc': {
    bn: 'দোকানের তথ্য, মালিকের পরিচয়, পার্টনার ও নিরাপত্তা পিন',
    en: 'Shop profile, personal identity, partners, and security PIN',
  },
  'settings.group.preferences': {
    bn: 'পছন্দসমূহ ও ডিসপ্লে',
    en: 'Preferences',
  },
  'settings.group.preferences.desc': {
    bn: 'ভাষা নির্বাচন, থিম, রিসিট প্রিন্ট এবং মেমো লেআউট সেটিংস',
    en: 'Language, display theme, receipt printing, and memo layout',
  },
  'settings.group.shop': {
    bn: 'দোকান ও ব্যবসা ব্যবস্থাপনা',
    en: 'Shop Management',
  },
  'settings.group.shop.desc': {
    bn: 'ক্যাটাগরি ও দর, ইনভেন্টরি নিয়ম, স্টাফ, পেমেন্ট, কুরিয়ার ও সাবস্ক্রিপশন',
    en: 'Categories & price, inventory rules, staff, payments, courier & subscription',
  },
  'settings.group.help': {
    bn: 'হেল্প সেন্টার ও তথ্য',
    en: 'Help & Information',
  },
  'settings.group.help.desc': {
    bn: 'টিউটোরিয়াল, প্রশ্নোত্তর, পলিসি, অ্যাপ আপডেট এবং সাপোর্ট যোগাযোগ',
    en: 'Tutorials, FAQs, legal policies, app updates, and support contact',
  },

  // Language Settings
  'language.title': {
    bn: 'ভাষা সেটিংস',
    en: 'Language Settings',
  },
  'language.desc': {
    bn: 'আপনার দোকানের ইন্টারফেস, মেনু ও বাটন বাংলা অথবা ইংরেজিতে ব্যবহার করুন',
    en: 'Choose Bangla or English for navigation, settings, and interface labels',
  },
  'language.bn': {
    bn: 'বাংলা',
    en: 'Bangla',
  },
  'language.en': {
    bn: 'ইংরেজি',
    en: 'English',
  },

  // Help Center
  'help.title': {
    bn: 'LEKHO হেল্প সেন্টার ও সাপোর্ট হাব',
    en: 'LEKHO Help Center & Support Hub',
  },
  'help.subtitle': {
    bn: 'টিউটোরিয়াল, সমস্যা সমাধান, সাবস্ক্রিপশন নিয়ম, পলিসি এবং সরাসরি সাপোর্ট',
    en: 'Tutorials, troubleshooting, subscription billing, policies, and direct support',
  },
  'help.searchPlaceholder': {
    bn: 'হেল্প আর্টিকেল, ভিডিও গাইড, প্রশ্ন বা পলিসি খুঁজুন...',
    en: 'Search help guides, tutorials, FAQs, or policies...',
  },
  'help.cat.tutorials': {
    bn: 'হেল্প ও ভিডিও টিউটোরিয়াল',
    en: 'Help & Tutorials',
  },
  'help.cat.faq': {
    bn: 'প্রশ্নোত্তর ও সমস্যা সমাধান',
    en: 'FAQ & Troubleshooting',
  },
  'help.cat.billing': {
    bn: 'সাবস্ক্রিপশন ও বিলিং',
    en: 'Subscription & Billing',
  },
  'help.cat.policies': {
    bn: 'পলিসি ও আইনি তথ্য',
    en: 'Policies & Legal',
  },
  'help.cat.updates': {
    bn: 'আপডেট ও ঘোষণা',
    en: 'Updates & Announcements',
  },
  'help.cat.support': {
    bn: 'সাপোর্টে যোগাযোগ',
    en: 'Contact Support',
  },
};

/**
 * Translates a UI key into the active language (`bn` or `en`).
 * Never returns raw keys if a fallback is provided, and never mutates merchant data.
 */
export function translateUI(
  lang: AppLanguage | undefined | null,
  key: string,
  fallback?: string
): string {
  const normalized = normalizeAppLanguage(lang);
  const entry = UI_TRANSLATIONS[key];
  if (entry) {
    return normalized === 'en' ? entry.en : entry.bn;
  }
  if (fallback !== undefined) {
    return fallback;
  }
  return key;
}

/**
 * Picks the appropriate string from a `{ bn, en }` pair based on the active language.
 */
export function pickLocalizedText(
  lang: AppLanguage | undefined | null,
  bnText: string,
  enText: string
): string {
  return normalizeAppLanguage(lang) === 'en' ? enText || bnText : bnText || enText;
}
