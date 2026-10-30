import { TenantShop, UserRole } from '../types';
import { isClothingShop } from './securityPolicy';

export type HelpCenterCategoryId =
  | 'tutorials'
  | 'faq'
  | 'billing'
  | 'policies'
  | 'updates'
  | 'support';

export type HelpContentStatus = 'published' | 'unpublished' | 'archived';

export type HelpShopCategoryScope = 'ALL' | 'CLOTHING' | 'SPORTSWEAR';

export type TutorialSubcategoryId =
  | 'getting_started'
  | 'pos_counter'
  | 'products_inventory'
  | 'customers_loyalty'
  | 'staff_permissions'
  | 'reports_closing'
  | 'subscription_account';

export interface HelpTutorialItem {
  id: string;
  subcategory: TutorialSubcategoryId;
  shopCategoryScope: HelpShopCategoryScope;
  status: HelpContentStatus;
  titleBn: string;
  titleEn: string;
  summaryBn: string;
  summaryEn: string;
  duration: string;
  /**
   * Verified video embed/watch URL configured by platform owner.
   * Empty string when a formal recorded video stream has not yet been attached,
   * ensuring the app never invents fake playable video URLs.
   */
  videoUrl: string;
  stepsBn: string[];
  stepsEn: string[];
  updatedAt: string;
}

export type FaqGroupId =
  | 'login_auth'
  | 'pos_invoice'
  | 'inventory_stock'
  | 'customers_loyalty'
  | 'staff_permissions'
  | 'subscription_renewal';

export interface HelpFaqItem {
  id: string;
  group: FaqGroupId;
  shopCategoryScope: HelpShopCategoryScope;
  status: HelpContentStatus;
  questionBn: string;
  questionEn: string;
  answerBn: string;
  answerEn: string;
  updatedAt: string;
}

export type LegalPolicyId =
  | 'terms_conditions'
  | 'privacy_policy'
  | 'subscription_payment_policy'
  | 'refund_cancellation_policy'
  | 'account_suspension_policy'
  | 'data_ownership_retention_policy';

export interface LegalPolicySection {
  headingBn: string;
  headingEn: string;
  bodyBn: string;
  bodyEn: string;
}

export interface LegalPolicyDocument {
  id: LegalPolicyId;
  titleBn: string;
  titleEn: string;
  lastUpdated: string;
  /**
   * Distinguishes active application-enforced technical rules from administrative policy drafts
   * awaiting final formal legal sign-off by the platform owner.
   */
  policyStatus: 'active_system_rule' | 'administrative_draft';
  statusBadgeBn: string;
  statusBadgeEn: string;
  summaryBn: string;
  summaryEn: string;
  sections: LegalPolicySection[];
}

export interface AppUpdateAnnouncement {
  id: string;
  version: string;
  date: string;
  type: 'feature' | 'improvement' | 'security' | 'notice';
  status: HelpContentStatus;
  titleBn: string;
  titleEn: string;
  summaryBn: string;
  summaryEn: string;
  highlightsBn: string[];
  highlightsEn: string[];
}

export interface SupportTicketInput {
  shopId: string;
  shopName: string;
  reporterName: string;
  reporterEmailOrPhone: string;
  category: 'pos_issue' | 'inventory' | 'billing_trx' | 'account_access' | 'feature_request' | 'other';
  subject: string;
  message: string;
}

export interface SupportTicketRecord extends SupportTicketInput {
  id: string;
  status: 'open' | 'in_review' | 'resolved';
  createdAt: string;
}

export const TUTORIAL_SUBCATEGORIES: Array<{
  id: TutorialSubcategoryId;
  labelBn: string;
  labelEn: string;
}> = [
  {
    id: 'getting_started',
    labelBn: '১. শুরু করার গাইড (Getting Started)',
    labelEn: '1. Getting Started',
  },
  {
    id: 'pos_counter',
    labelBn: '২. পিওএস কাউন্টার ও বিলিং (POS Counter & Sales)',
    labelEn: '2. POS Counter & Sales',
  },
  {
    id: 'products_inventory',
    labelBn: '৩. পণ্য ও ইনভেন্টরি (Products & Inventory)',
    labelEn: '3. Products & Inventory',
  },
  {
    id: 'customers_loyalty',
    labelBn: '৪. কাস্টমার, বাকি ও লয়্যালটি (Customers, Due & Loyalty)',
    labelEn: '4. Customers, Due & Loyalty',
  },
  {
    id: 'staff_permissions',
    labelBn: '৫. স্টাফ ও পারমিশন (Staff & Permissions)',
    labelEn: '5. Staff & Permissions',
  },
  {
    id: 'reports_closing',
    labelBn: '৬. রিপোর্ট ও ডেইলি ক্লোজিং (Reports & Daily Closing)',
    labelEn: '6. Reports & Daily Closing',
  },
  {
    id: 'subscription_account',
    labelBn: '৭. সাবস্ক্রিপশন ও অ্যাকাউন্ট (Subscription & Account Setup)',
    labelEn: '7. Subscription & Account Setup',
  },
];

export const FAQ_GROUPS: Array<{
  id: FaqGroupId;
  labelBn: string;
  labelEn: string;
}> = [
  {
    id: 'login_auth',
    labelBn: 'লগইন, জিমেইল, ওটিপি এবং অ্যাকাউন্ট অ্যাক্সেস',
    labelEn: 'Login, Gmail, OTP, and Account Access',
  },
  {
    id: 'pos_invoice',
    labelBn: 'পিওএস কাউন্টার এবং ইনভয়েস সমস্যা',
    labelEn: 'POS and Invoice Problems',
  },
  {
    id: 'inventory_stock',
    labelBn: 'ইনভেন্টরি, ভ্যারিয়েন্ট এবং স্টক সমন্বয়',
    labelEn: 'Inventory and Stock',
  },
  {
    id: 'customers_loyalty',
    labelBn: 'কাস্টমার, বাকি খাতা এবং লয়্যালটি পয়েন্ট',
    labelEn: 'Customers, Due, and Loyalty',
  },
  {
    id: 'staff_permissions',
    labelBn: 'স্টাফ রোল, পিন এবং পারমিশন',
    labelEn: 'Staff and Permissions',
  },
  {
    id: 'subscription_renewal',
    labelBn: 'সাবস্ক্রিপশন ও প্ল্যান নবায়ন',
    labelEn: 'Subscription and Renewal',
  },
];

export const DEFAULT_HELP_TUTORIALS: HelpTutorialItem[] = [
  {
    id: 'tut_getting_started_store',
    subcategory: 'getting_started',
    shopCategoryScope: 'ALL',
    status: 'published',
    titleBn: 'নতুন দোকান সেটআপ, ক্যাটাগরি নির্বাচন ও প্রথম বিল তৈরি',
    titleEn: 'Store Setup, Category Configuration & Creating Your First Memo',
    summaryBn: 'লগইন করার পর দোকানের নাম, লোগো, মেমো হেডার এবং প্রথম ক্যাশ মেমো তৈরি করার সম্পূর্ণ ধাপ।',
    summaryEn: 'Step-by-step walkthrough for setting up your shop profile, receipt header, and creating your first POS invoice.',
    duration: '4 min guide',
    videoUrl: '',
    stepsBn: [
      'Settings → Account & Profile থেকে দোকানের নাম, বাংলা নাম, মার্কেটের ঠিকানা এবং মোবাইল নম্বর যাচাই করুন।',
      'Shop Management → Categories & Price থেকে আপনার পণ্যের ডিফল্ট বিক্রয়মূল্য (MRP) ও ফ্লোর প্রাইস নির্ধারণ করুন।',
      'Home Hub থেকে POS Counter-এ গিয়ে পণ্য সিলেক্ট করে প্রথম ক্যাশ মেমো সম্পন্ন করুন।',
    ],
    stepsEn: [
      'Go to Settings → Account & Profile to verify your store name, Bengali title, mall address, and hotline number.',
      'Open Shop Management → Categories & Price to configure default selling prices (MRP) and floor prices.',
      'Open POS Counter from Home Hub, select an item, and complete your first instant cash memo.',
    ],
    updatedAt: '2026-03-15',
  },
  {
    id: 'tut_pos_dual_mode',
    subcategory: 'pos_counter',
    shopCategoryScope: 'ALL',
    status: 'published',
    titleBn: 'Inventory Tracking ON বনাম OFF মোডে দ্রুত POS বিলিং ও স্প্লিট পেমেন্ট',
    titleEn: 'POS Billing in Inventory Tracking ON vs OFF Mode & Split Payments',
    summaryBn: 'স্টক ট্র্যাকিং চালু রেখে স্টক থেকে বিক্রি অথবা স্টক ছাড়া দ্রুত ক্যাটাগরি বিলিং এবং ক্যাশ+বিকাশ স্প্লিট পেমেন্ট।',
    summaryEn: 'How to sell from real variant stock when Inventory Tracking is ON, or bill rapidly when OFF, including Cash + bKash/Nagad split payments.',
    duration: '5 min guide',
    videoUrl: '',
    stepsBn: [
      'Inventory Tracking ON থাকলে ইনভেন্টরি থেকে পণ্য ও সাইজ সিলেক্ট করলে বিল কনফার্মের সাথে সাথে অটো স্টক বিয়োগ হবে।',
      'ইনভেন্টরির বাইরে কোনো কাস্টম পণ্য বিক্রি করতে চাইলে POS-এ "+ Manual Item (ম্যানুয়াল)" টগল ব্যবহার করুন।',
      'কাস্টমার অর্ধেক ক্যাশ এবং অর্ধেক বিকাশ/নগদে দিলে Checkout-এ "Split (ক্যাশ + ডিজিটাল)" সিলেক্ট করে দুই ড্রয়ারে টাকা ভাগ করুন।',
    ],
    stepsEn: [
      'When Inventory Tracking is ON, selecting an inventory product and size automatically deducts stock upon sale confirmation.',
      'Use the "+ Manual Item" toggle in POS whenever you need to bill a custom item not listed in inventory.',
      'Select "Split (Cash + Digital)" at checkout to record partial cash and partial bKash/Nagad/Bank payments accurately.',
    ],
    updatedAt: '2026-03-18',
  },
  {
    id: 'tut_pos_sportswear_custom',
    subcategory: 'pos_counter',
    shopCategoryScope: 'SPORTSWEAR',
    status: 'published',
    titleBn: 'জার্সি কাস্টম নাম-নম্বর প্রিন্ট, প্যাচ ও টিম বাল্ক অর্ডার (Sportswear)',
    titleEn: 'Jersey Custom Name/Number Printing, Patches & Team Bulk Orders',
    summaryBn: 'স্পোর্টসওয়্যার দোকানের জন্য জার্সিতে কাস্টম নাম, নম্বর, ফন্ট ও DTF প্রিন্ট পাইপলাইন ব্যবহারের নিয়ম।',
    summaryEn: 'How Sportswear shops add custom player names, numbers, badges, and manage the Heat-Press DTF print pipeline.',
    duration: '4 min guide',
    videoUrl: '',
    stepsBn: [
      'POS Counter-এ জার্সি সিলেক্ট করার পর Custom Print অপশনে খেলোয়াড়ের নাম, নম্বর এবং ফন্ট স্টাইল যোগ করুন।',
      'বিল সম্পন্ন হলে অর্ডারটি স্বয়ংক্রিয়ভাবে Jersey Print Pipeline-এ যুক্ত হবে এবং ৪-ধাপে স্ট্যাটাস ট্র্যাক করা যাবে।',
      'ক্লাব বা টুর্নামেন্টের ১০+ পিস অর্ডারের জন্য Team Bulk Matrix ব্যবহার করে সাইজ অনুযায়ী তালিকা তৈরি করুন।',
    ],
    stepsEn: [
      'Select a jersey in POS Counter and enable Custom Print to enter player name, number, font style, and sleeve patch.',
      'Confirmed custom jersey orders automatically appear in the Jersey Print Pipeline for 4-stage workshop tracking.',
      'For tournament or club orders of 10+ jerseys, use Team Bulk Matrix to record player-by-player sizes and numbers.',
    ],
    updatedAt: '2026-03-18',
  },
  {
    id: 'tut_pos_clothing_alteration',
    subcategory: 'pos_counter',
    shopCategoryScope: 'CLOTHING',
    status: 'published',
    titleBn: 'প্যান্ট, শার্ট ও পাঞ্জাবি সাইজ সিলেকশন এবং অল্টারেশন ট্র্যাকিং (Clothing)',
    titleEn: 'Men’s Clothing Size Scales & Tailoring/Alteration Order Tracking',
    summaryBn: 'মেনস ক্লথিং স্টোরে ওয়েস্ট সাইজ (28–38), পাঞ্জাবি সাইজ (38–46) এবং ট্রায়াল রুম অল্টারেশন স্লিপ ব্যবস্থাপনা।',
    summaryEn: 'Managing waist sizes (28–38), Panjabi sizes (38–46), and tailoring alteration instructions for men’s clothing stores.',
    duration: '4 min guide',
    videoUrl: '',
    stepsBn: [
      'Categories & Price থেকে T-Shirt, Shirt, Jeans, Pant এবং Panjabi ক্যাটাগরির সাইজ ও দর নির্ধারণ করুন।',
      'প্যান্ট বা শার্ট অল্টারেশন প্রয়োজন হলে POS বা Tailoring & Alteration পেজ থেকে দর্জির নির্দেশনা ও ডেলিভারি তারিখ যুক্ত করুন।',
      'অল্টারেশন সম্পন্ন হলে স্ট্যাটাস "Ready for Pickup" এবং কাস্টমারকে বুঝিয়ে দিলে "Handed Over" মার্ক করুন।',
    ],
    stepsEn: [
      'Configure default size scales and prices for T-Shirt, Shirt, Jeans, Pant, and Panjabi in Categories & Price.',
      'Record hemming or waist-fitting instructions in Tailoring & Alteration with a delivery date and tailor fee.',
      'Update status from Sent to Tailor → Ready for Pickup → Handed Over when the customer collects the garment.',
    ],
    updatedAt: '2026-03-18',
  },
  {
    id: 'tut_multi_variant_workspace',
    subcategory: 'products_inventory',
    shopCategoryScope: 'ALL',
    status: 'published',
    titleBn: 'ফুল-স্ক্রিন মাল্টি-ভ্যারিয়েন্ট পণ্য এন্ট্রি এবং Batch Stock নিয়ম',
    titleEn: 'Full-Screen Multi-Variant Product Entry & Batch Stock Rules',
    summaryBn: 'এক ক্লিকে সব সাইজের ভ্যারিয়েন্ট তৈরি, Batch Stock ব্যবহার এবং স্টক সমন্বয় লেজার।',
    summaryEn: 'Creating multi-size product variants in the full-screen workspace and understanding per-variant Batch Stock.',
    duration: '5 min guide',
    videoUrl: '',
    stepsBn: [
      'Categories & Price অথবা Inventory পেজ থেকে "নতুন পণ্য ও মাল্টি-ভ্যারিয়েন্ট যোগ করুন" বাটনে ক্লিক করে ফুল-স্ক্রিন ফর্ম খুলুন।',
      'Batch Stock ঘরে যে সংখ্যা দেবেন (যেমন ২০), আপনার সিলেক্ট করা প্রতিটি নতুন সাইজে ঠিক সেই পরিমাণ (২০ পিস করে) স্টক যোগ হবে।',
      'কোনো নির্দিষ্ট সাইজের স্টক বা দাম আলাদা হলে নিচের ভ্যারিয়েন্ট টেবিলে সরাসরি এডিট করে Save Product চাপুন।',
    ],
    stepsEn: [
      'Open the Full-Screen Product Workspace from Categories & Price or Inventory.',
      'Set Batch Stock (e.g., 20): each newly generated size preset receives that exact quantity (20 pcs per size).',
      'Review and edit any individual row in the Variant Table before clicking Save Product.',
    ],
    updatedAt: '2026-03-20',
  },
  {
    id: 'tut_customers_loyalty_due',
    subcategory: 'customers_loyalty',
    shopCategoryScope: 'ALL',
    status: 'published',
    titleBn: 'কাস্টমার হিস্ট্রি, বাকি আদায় (Due Recovery) এবং লয়্যালটি পয়েন্ট রিওয়ার্ড',
    titleEn: 'Customer Purchase History, Due Collection & Loyalty Reward Points',
    summaryBn: 'মোবাইল নম্বর দিয়ে কাস্টমারের পূর্বের মেমো খোঁজা, বকেয়া আদায় এবং পয়েন্ট রিডিম করে ডিসকাউন্ট দেওয়া।',
    summaryEn: 'Looking up customer purchase history by phone number, collecting partial dues, and redeeming loyalty points at checkout.',
    duration: '4 min guide',
    videoUrl: '',
    stepsBn: [
      'POS Counter-এ কাস্টমারের ১১-ডিজিট মোবাইল নম্বর লিখলে তার বর্তমান লয়্যালটি পয়েন্ট স্বয়ংক্রিয়ভাবে দেখাবে।',
      'পয়েন্ট পর্যাপ্ত থাকলে অনুমোদিত Reward Tier সিলেক্ট করে বিলে তাৎক্ষণিক ডিসকাউন্ট দিন।',
      'Due List পেজ থেকে কাস্টমারের বকেয়া টাকা ক্যাশ বা বিকাশে আদায় করলে তা সরাসরি সংশ্লিষ্ট ড্রয়ারে জমা হবে।',
    ],
    stepsEn: [
      'Enter the customer’s 11-digit phone number in POS Counter to view their shop-specific loyalty point balance.',
      'Apply an eligible Reward Tier discount directly on the invoice when the customer has enough points.',
      'Collect outstanding customer dues from the Due List page into Cash, bKash, Nagad, or Bank drawers.',
    ],
    updatedAt: '2026-03-19',
  },
  {
    id: 'tut_staff_rbac_security',
    subcategory: 'staff_permissions',
    shopCategoryScope: 'ALL',
    status: 'published',
    titleBn: 'স্টাফ রোল, Blind Profit Mode এবং ৪-ডিজিট ওনার সিকিউরিটি পিন',
    titleEn: 'Staff Roles, Blind Profit Mode & 4-Digit Owner Security PIN',
    summaryBn: 'ক্যাশিয়ার বা সেলসম্যানের কাছ থেকে ক্রয়মূল্য (Buying Price) গোপন রাখা এবং ফ্লোর প্রাইস লক কনফিগারেশন।',
    summaryEn: 'Protecting wholesale buying prices from counter staff and enforcing floor price locks with the 4-digit Owner PIN.',
    duration: '4 min guide',
    videoUrl: '',
    stepsBn: [
      'Settings → Manage Operators থেকে নতুন সেলসম্যান বা ম্যানেজার যোগ করুন এবং ৪-ডিজিট কাউন্টার পিন সেট করুন।',
      'Salesman ও Manager রোলে পণ্যের ক্রয়মূল্য (Buying Cost) এবং নিট প্রফিট স্বয়ংক্রিয়ভাবে গোপন থাকে।',
      'ফ্লোর প্রাইসের (Bottom Price) নিচে কেউ ডিসকাউন্ট দিতে চাইলে ৪-ডিজিট Owner Security PIN ছাড়া বিল সম্পন্ন হবে না।',
    ],
    stepsEn: [
      'Add counter staff or managers in Settings → Manage Operators with individual 4-digit counter PINs.',
      'Buying prices and net profit margins are automatically masked for Salesman and Manager roles.',
      'Any discount below a product’s Floor Price requires 4-digit Owner Security PIN authorization.',
    ],
    updatedAt: '2026-03-19',
  },
  {
    id: 'tut_reports_zreport_closing',
    subcategory: 'reports_closing',
    shopCategoryScope: 'ALL',
    status: 'published',
    titleBn: 'মাল্টি-ড্রয়ার ক্যাশ মিলানো এবং ডেইলি ক্লোজিং (Z-Report) অডিট',
    titleEn: 'Multi-Drawer Reconciliation & Daily Closing (Z-Report) Audit',
    summaryBn: 'রাত শেষে ক্যাশ ড্রয়ার, বিকাশ ও নগদের ব্যালেন্স মিলিয়ে শিফট ক্লোজিং রিপোর্ট সংরক্ষণ।',
    summaryEn: 'Reconciling physical cash, bKash, Nagad, and Bank balances at the end of the day using the Z-Report audit tool.',
    duration: '3 min guide',
    videoUrl: '',
    stepsBn: [
      'Daily Closing পেজে বা Navbar-এর Z-Report বাটনে ক্লিক করে আজকের প্রত্যাশিত ক্যাশ ব্যালেন্স দেখুন।',
      'ড্রয়ারের প্রকৃত ক্যাশ গুনে Counted Cash ঘরে লিখলে সিস্টেম স্বয়ংক্রিয়ভাবে Short বা Over হিসাব দেখাবে।',
      'নোট লিখে Z-Report সাবমিট করলে তা স্থায়ী অডিট লগে সংরক্ষিত থাকবে।',
    ],
    stepsEn: [
      'Open Daily Closing or click Z-Report in the top bar to view expected cash and digital drawer totals.',
      'Enter your physical counted cash to automatically calculate any cash shortage or overage.',
      'Submit the Z-Report with shift notes to save an immutable daily closing record.',
    ],
    updatedAt: '2026-03-19',
  },
  {
    id: 'tut_subscription_renewal',
    subcategory: 'subscription_account',
    shopCategoryScope: 'ALL',
    status: 'published',
    titleBn: 'বিকাশ বা নগদে সাবস্ক্রিপশন নবায়ন এবং ২৪-ঘণ্টা গ্রেস অ্যাক্সেস',
    titleEn: 'Renewing Subscription via bKash/Nagad & 24-Hour Instant Grace Access',
    summaryBn: 'মাসিক প্ল্যান রিনিউ করার নিয়ম, TrxID জমা দেওয়া এবং তাৎক্ষণিক কাউন্টার সচল রাখার প্রক্রিয়া।',
    summaryEn: 'How to submit your bKash/Nagad TrxID for monthly plan renewal and receive immediate 24-hour grace access.',
    duration: '3 min guide',
    videoUrl: '',
    stepsBn: [
      'Help Center → Subscription & Billing অথবা Settings → Plan & Subscription সেকশনে যান।',
      'নির্ধারিত বিকাশ বা নগদ মার্চেন্ট নম্বরে প্ল্যানের ফি পাঠিয়ে আপনার Sender নম্বর ও TrxID সাবমিট করুন।',
      'TrxID জমা দেওয়ার সাথে সাথে ২৪ ঘণ্টার Grace Access চালু হবে এবং সেন্ট্রাল অডিট ভেরিফিকেশনের পর ৩০ দিনের পূর্ণ মেয়াদ যুক্ত হবে।',
    ],
    stepsEn: [
      'Go to Help Center → Subscription & Billing or Settings → Plan & Subscription.',
      'Send the monthly plan fee to the official bKash or Nagad number and submit your Sender Phone and TrxID.',
      'Your shop receives immediate 24-hour Grace Access upon submission while Central Audit verifies the transaction for 30-day activation.',
    ],
    updatedAt: '2026-03-20',
  },
];

export const DEFAULT_HELP_FAQS: HelpFaqItem[] = [
  // Group 1: Login, Gmail, OTP, and account access
  {
    id: 'faq_login_1',
    group: 'login_auth',
    shopCategoryScope: 'ALL',
    status: 'published',
    questionBn: 'জিমেইল ওটিপি (OTP) আসতে দেরি হলে বা না পেলে কী করব?',
    questionEn: 'What should I do if the Gmail verification OTP is delayed or not received?',
    answerBn:
      'প্রথমে আপনার জিমেইলের Spam বা Promotions ফোল্ডার চেক করুন। ৬০ সেকেন্ড পর "Resend OTP" বাটনে ক্লিক করে নতুন কোড পাঠাতে পারবেন। লোকাল বা ডেমো পরিবেশে SMTP সার্ভার কনফিগার না থাকলে স্ক্রিনে প্রদর্শিত ভেরিফিকেশন কোড ব্যবহার করে তাৎক্ষণিক পরীক্ষা করা যাবে।',
    answerEn:
      'Check your Gmail Spam or Promotions folder first, and wait 60 seconds before clicking "Resend OTP". In local/preview environments where external SMTP is not attached, a dispatch preview badge is shown so you can complete verification immediately.',
    updatedAt: '2026-03-18',
  },
  {
    id: 'faq_login_2',
    group: 'login_auth',
    shopCategoryScope: 'ALL',
    status: 'published',
    questionBn: 'ক্যাশিয়ার বা সেলসম্যান মোড থেকে আবার মালিকের (Owner) মোডে কীভাবে ফিরব?',
    questionEn: 'How do I switch back from Salesman/Cashier mode to Shop Owner mode?',
    answerBn:
      'উপরে ডানপাশের PIN বাটনে বা প্রোফাইল মেনু থেকে "Switch Operator PIN" এ ক্লিক করে দোকানের ৪-ডিজিট Owner Security PIN প্রদান করলেই পুনরায় Owner মোড আনলক হবে। পরপর ৫ বার ভুল পিন দিলে ৬০ সেকেন্ডের জন্য লকআউট কার্যকর হয়।',
    answerEn:
      'Click the PIN button in the header or "Switch Operator PIN" in the account menu and enter your 4-digit Owner Security PIN. Entering an incorrect PIN 5 times triggers a 60-second brute-force security lockout.',
    updatedAt: '2026-03-18',
  },

  // Group 2: POS and invoice problems
  {
    id: 'faq_pos_1',
    group: 'pos_invoice',
    shopCategoryScope: 'ALL',
    status: 'published',
    questionBn: 'ইনভেন্টরিতে স্টক যোগ না করেই কি দ্রুত ক্যাশ মেমো তৈরি করা যাবে?',
    questionEn: 'Can I create quick POS invoices without adding products to inventory first?',
    answerBn:
      'হ্যাঁ! আপনি দুইভাবে এটি করতে পারেন: (১) Settings → Inventory Settings থেকে "Inventory Tracking: OFF" করে নিলে স্টক ছাড়াই ক্যাটাগরি ও সাইজ সিলেক্ট করে দ্রুত বিল করা যাবে, অথবা (২) Inventory Tracking ON থাকা অবস্থায় POS-এ "+ Manual Item (ম্যানুয়াল)" বাটনে ক্লিক করে যেকোনো কাস্টম আইটেম ও দাম লিখে বিল করতে পারবেন।',
    answerEn:
      'Yes. You can either turn "Inventory Tracking: OFF" in Settings for full non-inventory rapid billing, or keep Inventory Tracking ON and click the "+ Manual Item" toggle inside POS Counter to bill ad-hoc items without affecting stock.',
    updatedAt: '2026-03-20',
  },
  {
    id: 'faq_pos_2',
    group: 'pos_invoice',
    shopCategoryScope: 'ALL',
    status: 'published',
    questionBn: 'থার্মাল প্রিন্টারের কাগজের সাইজ (80mm বা 58mm) কীভাবে পরিবর্তন করব?',
    questionEn: 'How do I change the thermal receipt paper width between 80mm and 58mm?',
    answerBn:
      'Settings → Preferences → Invoices & Receipts (অথবা Print Preferences) সেকশনে গিয়ে 80mm (Standard POS), 58mm (Mini POS) অথবা Custom (48mm–120mm) সিলেক্ট করে Save করুন। ডানপাশে লাইভ রিসিট প্রিভিউ সাথে সাথে আপডেট হবে।',
    answerEn:
      'Go to Settings → Preferences → Invoices & Receipts, select 80mm, 58mm, or Custom width (48mm–120mm), and click Save. The live thermal slip preview updates immediately.',
    updatedAt: '2026-03-18',
  },

  // Group 3: Inventory and stock
  {
    id: 'faq_inv_1',
    group: 'inventory_stock',
    shopCategoryScope: 'ALL',
    status: 'published',
    questionBn: 'নতুন পণ্য যোগ করার সময় "Batch Stock" কীভাবে কাজ করে?',
    questionEn: 'How does "Batch Stock" work when generating product variants?',
    answerBn:
      'Batch Stock মানে হলো প্রতিটি নতুন জেনারেট হওয়া সাইজ বা ভ্যারিয়েন্টের প্রাথমিক স্টক। উদাহরণস্বরূপ, আপনি যদি Batch Stock = ২০ দেন এবং S, M, L, XL, XXL এই ৫টি সাইজ সিলেক্ট করেন, তবে প্রতিটি সাইজে ২০ পিস করে মোট ১০০ পিস স্টক যোগ হবে। কোনো ভ্যারিয়েন্টের স্টক ম্যানুয়ালি পরিবর্তন করলে সিস্টেম কখনোই সেটি ওভাররাইট করবে না।',
    answerEn:
      'Batch Stock sets the initial stock quantity for EACH newly generated variant. For example, Batch Stock = 20 across 5 sizes (S, M, L, XL, XXL) assigns 20 pieces to each size (100 total pieces). Manually edited variant rows are never overwritten.',
    updatedAt: '2026-03-20',
  },
  {
    id: 'faq_inv_2',
    group: 'inventory_stock',
    shopCategoryScope: 'ALL',
    status: 'published',
    questionBn: 'ভুলবশত ডিলিট হওয়া পণ্য বা ইনভয়েস কি ফিরিয়ে আনা সম্ভব?',
    questionEn: 'Can I restore an accidentally deleted product or invoice?',
    answerBn:
      'হ্যাঁ। ডিলিট করা পণ্য ও মেমোগুলো ৩০ দিনের জন্য Recycle Bin (Trash)-এ সংরক্ষিত থাকে। Settings → Print & System Preferences-এর নিচে "Open Trash Bin" থেকে ১-ক্লিকে রিস্টোর করতে পারবেন।',
    answerEn:
      'Yes. Deleted products and invoices are retained in the Trash Bin for 30 days. Open the Trash Bin from Settings to restore any soft-deleted record with one click.',
    updatedAt: '2026-03-18',
  },

  // Group 4: Customers, due, and loyalty
  {
    id: 'faq_cust_1',
    group: 'customers_loyalty',
    shopCategoryScope: 'ALL',
    status: 'published',
    questionBn: 'এক দোকানের কাস্টমার বা লয়্যালটি পয়েন্ট কি অন্য দোকানে দেখা যাবে?',
    questionEn: 'Are customer records and loyalty points shared across different shops?',
    answerBn:
      'কখনোই না। LEKHO POS-এ প্রতিটি দোকানের কাস্টমার প্রোফাইল, বাকি খাতা এবং লয়্যালটি পয়েন্ট ১০০% আলাদা (Shop-Scoped Isolation)। একই মোবাইল নম্বরের কাস্টমার দুটি ভিন্ন দোকানে কেনাকাটা করলেও প্রতিটি দোকানে তার পয়েন্ট ও হিসাব সম্পূর্ণ স্বাধীন থাকবে।',
    answerEn:
      'Never. Every customer profile, due ledger, and loyalty point balance is strictly isolated per shop (`shopId` scoped). Even if a customer uses the same phone number at two different LEKHO stores, their history and points remain 100% separate.',
    updatedAt: '2026-03-19',
  },
  {
    id: 'faq_cust_2',
    group: 'customers_loyalty',
    shopCategoryScope: 'ALL',
    status: 'published',
    questionBn: 'ইনভয়েস রিটার্ন বা ডিলিট করলে কাস্টমারের অর্জিত লয়্যালটি পয়েন্টের কী হবে?',
    questionEn: 'What happens to earned loyalty points if an invoice is deleted or returned?',
    answerBn:
      'কোনো ইনভয়েস ডিলিট বা রিটার্ন করা হলে ওই ইনভয়েস থেকে অর্জিত লয়্যালটি পয়েন্ট স্বয়ংক্রিয়ভাবে কাস্টমারের ব্যালেন্স থেকে বিয়োগ (Reverse) হয়ে যায়, যাতে ডুপ্লিকেট বা ভুয়া পয়েন্ট জমা না থাকে।',
    answerEn:
      'When an invoice is deleted or returned, any loyalty points earned on that invoice are automatically reversed from the customer’s balance and logged in the loyalty ledger.',
    updatedAt: '2026-03-19',
  },

  // Group 5: Staff and permissions
  {
    id: 'faq_staff_1',
    group: 'staff_permissions',
    shopCategoryScope: 'ALL',
    status: 'published',
    questionBn: 'সেলসম্যান বা ম্যানেজার কি পণ্যের ক্রয়মূল্য (Buying Price) দেখতে বা পরিবর্তন করতে পারবে?',
    questionEn: 'Can a Salesman or Manager view or overwrite product buying prices?',
    answerBn:
      'না। শুধুমাত্র দোকানের মালিক (Owner) পণ্যের ক্রয়মূল্য, লট কস্ট এবং নিট প্রফিট দেখতে পারেন। স্টাফ যখন নতুন পণ্য যোগ করে বা দাম/স্টক আপডেট করে, তখনো মালিকের সেট করা পূর্বের ক্রয়মূল্য সুরক্ষিত থাকে এবং কখনোই মুছে যায় না।',
    answerEn:
      'No. Buying prices (`costPrice` / `lotCostLandingPrice`) and profit metrics are strictly restricted to the Shop Owner. When staff create or edit products, existing owner cost records are automatically preserved on save.',
    updatedAt: '2026-03-19',
  },

  // Group 6: Subscription and renewal
  {
    id: 'faq_sub_1',
    group: 'subscription_renewal',
    shopCategoryScope: 'ALL',
    status: 'published',
    questionBn: 'সাবস্ক্রিপশনের মেয়াদ শেষ হয়ে গেলে কি আমার দোকানের পুরনো ডাটা মুছে যাবে?',
    questionEn: 'Will my store data be deleted if my subscription expires?',
    answerBn:
      'না, আপনার দোকানের কোনো ইনভেন্টরি, কাস্টমার বা মেমো ডাটা মুছে যাবে না। শুধুমাত্র মেয়াদ উত্তীর্ণ অবস্থায় নতুন বিল বা পরিবর্তন সেভ করা সাময়িকভাবে বন্ধ থাকবে। বিকাশ/নগদ TrxID জমা দিলেই সাথে সাথে ২৪ ঘণ্টার Grace Access চালু হয়ে যাবে।',
    answerEn:
      'No. All inventory, customer, and invoice records remain safely stored. Only new sales creation is paused while expired. Submitting a renewal TrxID immediately unlocks 24-hour Grace Access.',
    updatedAt: '2026-03-20',
  },
];

export const LEGAL_POLICY_DOCUMENTS: LegalPolicyDocument[] = [
  {
    id: 'terms_conditions',
    titleBn: 'ব্যবহারের শর্তাবলী (Terms & Conditions)',
    titleEn: 'Terms & Conditions',
    lastUpdated: '2026-03-15',
    policyStatus: 'active_system_rule',
    statusBadgeBn: 'সক্রিয় প্ল্যাটফর্ম নীতি (Active Platform Rule)',
    statusBadgeEn: 'Active Platform Rule',
    summaryBn: 'LEKHO POS ব্যবহারের নিয়মাবলী, মার্চেন্ট অ্যাকাউন্টের দায়বদ্ধতা এবং অনুমোদিত ব্যবসায়িক ব্যবহার।',
    summaryEn: 'Governing rules for merchant accounts, authorized retail operations, and workspace security in LEKHO POS.',
    sections: [
      {
        headingBn: '১. অ্যাকাউন্ট ও দোকানের মালিকানা',
        headingEn: '1. Merchant Account & Store Ownership',
        bodyBn:
          'প্রতিটি মার্চেন্ট অ্যাকাউন্ট একটি নির্দিষ্ট দোকানের (CLOTHING অথবা SPORTSWEAR ক্যাটাগরি) জন্য নিবন্ধিত। দোকানের মালিক তার ওনার পিন (Owner PIN), পার্টনার পাসওয়ার্ড এবং স্টাফ অ্যাক্সেসের নিরাপত্তার জন্য দায়ী থাকবেন।',
        bodyEn:
          'Each merchant account is registered for a designated retail store (CLOTHING or SPORTSWEAR). The store owner is responsible for safeguarding the 4-digit Owner Security PIN, partner withdrawal passwords, and staff role assignments.',
      },
      {
        headingBn: '২. সঠিক ব্যবসায়িক তথ্য ও মেমো পরিচালনা',
        headingEn: '2. Accurate Billing & Record Keeping',
        bodyBn:
          'POS কাউন্টার থেকে ইস্যুকৃত ক্যাশ মেমো, কাস্টমারের বকেয়া হিসাব এবং স্টক সমন্বয়সমূহ দোকানের নিজস্ব ব্যবসায়িক রেকর্ড হিসেবে গণ্য হবে।',
        bodyEn:
          'Invoices, due ledgers, and stock adjustment records generated through the POS counter serve as the merchant’s operational retail ledger.',
      },
      {
        headingBn: '৩. নিষিদ্ধ কার্যক্রম',
        headingEn: '3. Prohibited Activities',
        bodyBn:
          'অন্য মার্চেন্টের ডাটা অ্যাক্সেসের চেষ্টা, ভুয়া পেমেন্ট TrxID বারবার দাখিল করা কিংবা বেআইনি পণ্যের লেনদেনে সফটওয়্যার ব্যবহার করা সম্পূর্ণ নিষিদ্ধ।',
        bodyEn:
          'Attempting unauthorized cross-tenant access, submitting fraudulent subscription TrxIDs, or using the platform for unlawful commerce is strictly prohibited.',
      },
    ],
  },
  {
    id: 'privacy_policy',
    titleBn: 'গোপনীয়তা নীতি (Privacy Policy)',
    titleEn: 'Privacy Policy',
    lastUpdated: '2026-03-15',
    policyStatus: 'active_system_rule',
    statusBadgeBn: 'সক্রিয় ডাটা সুরক্ষা নীতি (Active Data Rule)',
    statusBadgeEn: 'Active Data Protection Rule',
    summaryBn: 'মার্চেন্টের ব্যবসায়িক হিসাব, ক্রয়মূল্য, কাস্টমার তালিকা এবং পাসওয়ার্ড/পিন এনক্রিপশন সুরক্ষা।',
    summaryEn: 'How merchant financial records, wholesale costs, customer directories, and hashed credentials are protected.',
    sections: [
      {
        headingBn: '১. মাল্টি-টেন্যান্ট ডাটা আইসোলেশন',
        headingEn: '1. Strict Multi-Tenant Data Isolation',
        bodyBn:
          'প্রতিটি দোকানের ইনভেন্টরি, ইনভয়েস, কাস্টমার প্রোফাইল এবং লয়্যালটি পয়েন্ট নিজস্ব `shopId` দ্বারা সম্পূর্ণ বিচ্ছিন্ন। এক দোকানের তথ্য অন্য কোনো দোকানে কখনোই প্রদর্শিত বা শেয়ার করা হয় না।',
        bodyEn:
          'All inventory items, invoices, customer profiles, and loyalty points are strictly isolated by `shopId`. Data from one store is never visible to or shared with any other store.',
      },
      {
        headingBn: '২. পিন ও পাসওয়ার্ড এনক্রিপশন',
        headingEn: '2. Credential Hashing & Confidentiality',
        bodyBn:
          'ওনার পিন, স্টাফ কাউন্টার পিন এবং পার্টনার পাসওয়ার্ড ক্রিপ্টোগ্রাফিক হ্যাশ (Salted Hash) হিসেবে সংরক্ষিত থাকে এবং ইউজার ইন্টারফেস বা রিপোর্টে কখনোই প্লেইনটেক্সটে দেখানো হয় না।',
        bodyEn:
          'Owner PINs, staff counter PINs, and partner passwords are stored using salted cryptographic hashes and are never exposed in plaintext in the UI or logs.',
      },
    ],
  },
  {
    id: 'subscription_payment_policy',
    titleBn: 'সাবস্ক্রিপশন ও পেমেন্ট নীতি (Subscription & Payment Policy)',
    titleEn: 'Subscription & Payment Policy',
    lastUpdated: '2026-03-18',
    policyStatus: 'active_system_rule',
    statusBadgeBn: 'সক্রিয় বিলিং নিয়ম (Active Billing Policy)',
    statusBadgeEn: 'Active Billing Policy',
    summaryBn: 'মাসিক প্ল্যান ফি, বিকাশ/নগদ TrxID ভেরিফিকেশন এবং ২৪-ঘণ্টার তাৎক্ষণিক গ্রেস পিরিয়ড নিয়মাবলী।',
    summaryEn: 'Monthly SaaS plan tiers, bKash/Nagad TrxID verification workflow, and 24-hour instant grace period rules.',
    sections: [
      {
        headingBn: '১. প্ল্যান ও মাসিক ফি',
        headingEn: '1. Subscription Plans & Monthly Cadence',
        bodyBn:
          'LEKHO POS-এ দুটি প্ল্যান চালু রয়েছে: Starter Plan (৳৪৯৯ / ৩০ দিন) এবং Pro Plan (৳৯৯৯ / ৩০ দিন)। দোকানের মালিক যেকোনো সময় প্ল্যান নবায়ন করতে পারবেন।',
        bodyEn:
          'LEKHO POS offers two active plans: Starter Plan (৳499 / 30 days) and Pro Plan (৳999 / 30 days). Subscriptions renew on a 30-day cycle.',
      },
      {
        headingBn: '২. ২৪-ঘণ্টা তাৎক্ষণিক গ্রেস অ্যাক্সেস (Grace Period)',
        headingEn: '2. 24-Hour Instant Grace Activation',
        bodyBn:
          'বিকাশ বা নগদ পেমেন্টের পর বৈধ TrxID সাবমিট করার সাথে সাথে দোকানের কাউন্টার ২৪ ঘণ্টার জন্য সচল (Grace Status) হয়, যাতে অডিট সম্পন্ন হওয়ার আগেও বিক্রি থেমে না থাকে।',
        bodyEn:
          'Submitting a valid bKash or Nagad TrxID immediately grants 24-hour Grace Status so counter billing continues uninterrupted while Central Audit verifies the payment.',
      },
    ],
  },
  {
    id: 'refund_cancellation_policy',
    titleBn: 'রিফান্ড ও বাতিলকরণ নীতি (Refund & Cancellation Policy)',
    titleEn: 'Refund & Cancellation Policy',
    lastUpdated: '2026-03-18',
    policyStatus: 'administrative_draft',
    statusBadgeBn: 'প্রশাসনিক নীতি খসড়া (Administrative Policy — Owner Configurable)',
    statusBadgeEn: 'Administrative Policy (Owner Configurable)',
    summaryBn: 'সাবস্ক্রিপশন বাতিলকরণ এবং দোকানের নিজস্ব কাস্টমার এক্সচেঞ্জ/রিটার্ন পলিসি সংক্রান্ত নির্দেশনা।',
    summaryEn: 'Guidelines on SaaS subscription cancellation and merchant-configured customer exchange/return rules.',
    sections: [
      {
        headingBn: '১. মার্চেন্ট সাবস্ক্রিপশন বাতিলকরণ',
        headingEn: '1. SaaS Subscription Cancellation',
        bodyBn:
          'মার্চেন্ট যেকোনো মাসের শেষে পরবর্তী রিনিউয়াল বন্ধ রাখতে পারেন। ভুলবশত ডাবল পেমেন্ট (Duplicate TrxID Payment) হলে সাপোর্টে যোগাযোগ করে ভেরিফিকেশন সাপেক্ষে সমন্বয় বা রিফান্ডের আবেদন করা যাবে। (চূড়ান্ত আইনি শর্তাবলী প্ল্যাটফর্ম মালিকের অনুমোদন সাপেক্ষে প্রযোজ্য)।',
        bodyEn:
          'Merchants may stop renewing at the end of any 30-day billing cycle. Duplicate mobile money transfers can be reported through Contact Support for verification and credit adjustment (subject to final platform owner legal confirmation).',
      },
      {
        headingBn: '২. দোকানের নিজস্ব কাস্টমার এক্সচেঞ্জ পলিসি',
        headingEn: '2. Store Customer Exchange & Return Rules',
        bodyBn:
          'কাস্টমারের কাছে বিক্রিত পণ্যের রিটার্ন বা সাইজ এক্সচেঞ্জ দোকানের নিজস্ব সেটিংস (Settings → Invoices & Receipts / Exchange Window Days) অনুযায়ী পরিচালিত হয়। ডিফল্ট নিয়মে ৩ দিনের মধ্যে মেমো ও প্রাইস ট্যাগসহ সাইজ এক্সচেঞ্জ অনুমোদিত।',
        bodyEn:
          'Customer product returns and size swaps are governed by each store’s own configuration in Settings (default: 3-day size exchange with original memo and intact price tags).',
      },
    ],
  },
  {
    id: 'account_suspension_policy',
    titleBn: 'অ্যাকাউন্ট স্থগিত ও সমাপ্তি নীতি (Account Suspension & Termination Policy)',
    titleEn: 'Account Suspension & Termination Policy',
    lastUpdated: '2026-03-18',
    policyStatus: 'active_system_rule',
    statusBadgeBn: 'সক্রিয় নিরাপত্তা নিয়ম (Active Security Rule)',
    statusBadgeEn: 'Active Security Rule',
    summaryBn: 'মেয়াদ উত্তীর্ণ সাবস্ক্রিপশন, ভুয়া TrxID এবং নিরাপত্তা লঙ্ঘনের ক্ষেত্রে অ্যাকাউন্টের অবস্থা।',
    summaryEn: 'System behavior when subscriptions expire, TrxIDs are rejected, or account access is disabled.',
    sections: [
      {
        headingBn: '১. মেয়াদ উত্তীর্ণ বা অপ্রত্যাশিত TrxID',
        headingEn: '1. Expired Subscriptions & Rejected TrxIDs',
        bodyBn:
          'সাবস্ক্রিপশনের মেয়াদ শেষ হলে বা ভুল TrxID প্রত্যাখ্যাত হলে অ্যাকাউন্ট "Expired" স্ট্যাটাসে যায়। এ অবস্থায় পূর্বের সকল রিপোর্ট ও ডাটা অক্ষত থাকে, তবে নতুন বিল তৈরি করতে বৈধ রিনিউয়াল প্রয়োজন হয়।',
        bodyEn:
          'When a subscription expires or a TrxID is rejected during audit, the store transitions to "Expired" status. Existing data remains intact, while new billing requires renewal.',
      },
      {
        headingBn: '২. স্টাফ অ্যাক্সেস বাতিলকরণ',
        headingEn: '2. Revoking Staff Operator Access',
        bodyBn:
          'দোকানের মালিক যেকোনো মুহূর্তে Settings → Manage Operators থেকে যেকোনো স্টাফের অ্যাকাউন্ট "Deactivate" করতে বা কাউন্টার পিন রিসেট করতে পারেন।',
        bodyEn:
          'Store owners can immediately deactivate any staff member or reset their 4-digit counter PIN from Settings → Manage Operators.',
      },
    ],
  },
  {
    id: 'data_ownership_retention_policy',
    titleBn: 'ডাটা মালিকানা, সংরক্ষণ ও মুছে ফেলার নীতি (Data Ownership, Retention & Deletion Policy)',
    titleEn: 'Data Ownership, Retention & Deletion Policy',
    lastUpdated: '2026-03-18',
    policyStatus: 'active_system_rule',
    statusBadgeBn: 'সক্রিয় ডাটা সংরক্ষণ নিয়ম (Active Retention Policy)',
    statusBadgeEn: 'Active Retention Policy',
    summaryBn: 'দোকানের তথ্যের পূর্ণ মালিকানা, ৩০-দিনের রিসাইকেল বিন সংরক্ষণ এবং অডিট লগ নীতিমালা।',
    summaryEn: 'Merchant ownership of business records, 30-day Trash Bin retention for soft-deleted items, and audit history.',
    sections: [
      {
        headingBn: '১. ব্যবসায়িক তথ্যের মালিকানা',
        headingEn: '1. Merchant Data Ownership',
        bodyBn:
          'দোকানে এন্ট্রিকৃত সকল পণ্য, ভ্যারিয়েন্ট, কাস্টমার প্রোফাইল, মেমো এবং খরচের হিসাবের পূর্ণ মালিকানা সংশ্লিষ্ট মার্চেন্টের।',
        bodyEn:
          'Each merchant retains full ownership of the products, variants, customer records, invoices, and financial ledgers entered into their store workspace.',
      },
      {
        headingBn: '২. ৩০-দিনের রিসাইকেল বিন সংরক্ষণ (Trash Retention)',
        headingEn: '2. 30-Day Soft-Delete Trash Retention',
        bodyBn:
          'ডিলিট করা পণ্য বা ইনভয়েসগুলো সরাসরি মুছে না গিয়ে ৩০ দিনের জন্য দোকানের Trash Bin-এ সংরক্ষিত থাকে, যাতে ভুলবশত মুছে ফেলা তথ্য সহজেই পুনরুদ্ধার করা যায়।',
        bodyEn:
          'Soft-deleted products and invoices are retained in the store’s isolated Trash Bin for 30 days (configurable in Store Configuration) before permanent removal.',
      },
    ],
  },
];

export const DEFAULT_APP_UPDATES: AppUpdateAnnouncement[] = [
  {
    id: 'upd_2026_03_ui_help',
    version: 'v2.6.0',
    date: '2026-03-22',
    type: 'feature',
    status: 'published',
    titleBn: 'আধুনিক সেটিংস হাব, ভাষা নির্বাচন এবং সম্পূর্ণ নতুন LEKHO হেল্প সেন্টার',
    titleEn: 'Modernized Settings Hub, Bilingual Language Switcher & Complete Help Center',
    summaryBn: 'মোবাইল ও ডেস্কটপের জন্য কমপ্যাক্ট ইউজার ইন্টারফেস, বাংলা/ইংরেজি ভাষা পরিবর্তন এবং ৬-বিভাগের হেল্প সেন্টার যুক্ত হয়েছে।',
    summaryEn: 'Compact responsive UI across mobile and desktop, per-shop Bangla/English language switching, and a 6-category Help Center.',
    highlightsBn: [
      'Settings পেজকে ৪টি পরিষ্কার গ্রুপে (Account & Profile, Preferences, Shop Management, Help & Information) সাজানো হয়েছে।',
      'বাংলা (Bangla) এবং ইংরেজি (English) ভাষা তাৎক্ষণিক পরিবর্তনের সুবিধা যুক্ত হয়েছে।',
      'টিউটোরিয়াল, প্রশ্নোত্তর, বিলিং, ৬টি আইনি পলিসি, রিলিজ নোট এবং সাপোর্ট টিকেটসহ পূর্ণাঙ্গ Help Center।',
    ],
    highlightsEn: [
      'Redesigned Settings into 4 clean grouped sections with compact row navigation and deep-linked subpages.',
      'Added tenant-scoped Bangla (বাংলা) and English interface language switching.',
      'Launched the 6-category LEKHO Help Center with unified search, policies, and support ticket submission.',
    ],
  },
  {
    id: 'upd_2026_03_fullscreen_variants',
    version: 'v2.5.0',
    date: '2026-03-20',
    type: 'feature',
    status: 'published',
    titleBn: 'ফুল-স্ক্রিন মাল্টি-ভ্যারিয়েন্ট পণ্য এন্ট্রি ওয়ার্কস্পেস এবং স্পষ্ট Batch Stock নিয়ম',
    titleEn: 'Full-Screen Multi-Variant Product Workspace & Per-Variant Batch Stock',
    summaryBn: 'ছোট পপআপের বদলে ফুল-স্ক্রিন পণ্য এন্ট্রি পেজ এবং প্রতিটি নতুন সাইজে নির্দিষ্ট Batch Stock যোগ করার সহজ নিয়ম।',
    summaryEn: 'Upgraded product creation to a full-screen workspace with fixed header/footer bars and clear per-variant Batch Stock generation.',
    highlightsBn: [
      'ডেস্কটপ ও মোবাইলে স্ক্রল ঝামেলা ছাড়াই দ্রুত বহু সাইজ ও কালারের ভ্যারিয়েন্ট এন্ট্রি।',
      'Batch Stock = প্রতিটি নতুন জেনারেট হওয়া সাইজের প্রাথমিক স্টক (ম্যানুয়ালি এডিট করা স্টক কখনোই ওভাররাইট হয় না)।',
      'Inventory Tracking ON এবং OFF উভয় মোডের জন্য স্মার্ট POS বিলিং আপডেট।',
    ],
    highlightsEn: [
      'Full-screen product entry with sticky header and action bar for rapid multi-size catalog management.',
      'Batch Stock applies the exact initial stock quantity to each newly generated variant without overwriting manual edits.',
      'Seamless POS Counter operation in both Inventory Tracking ON and OFF modes.',
    ],
  },
  {
    id: 'upd_2026_03_loyalty_security',
    version: 'v2.4.0',
    date: '2026-03-16',
    type: 'security',
    status: 'published',
    titleBn: 'দোকান-ভিত্তিক লয়্যালটি পয়েন্ট, উৎসবের হোয়াটসঅ্যাপ অফার এবং ওনার কস্ট প্রটেকশন',
    titleEn: 'Shop-Scoped Loyalty Points, Festive WhatsApp Previews & Owner Cost Protection',
    summaryBn: 'কাস্টমার লয়্যালটি ডিসকাউন্ট টিয়ার, ১-ক্লিক হোয়াটসঅ্যাপ অফার মেসেজ এবং স্টাফদের কাছ থেকে ক্রয়মূল্য সুরক্ষার আপডেট।',
    summaryEn: 'Configurable customer loyalty reward tiers, individual WhatsApp offer previews, and strict buying price confidentiality.',
    highlightsBn: [
      'প্রতিটি দোকানের জন্য আলাদা লয়্যালটি পয়েন্ট এবং কাস্টমাইজযোগ্য ডিসকাউন্ট টিয়ার (যেমন ৫০ পয়েন্ট = ২%, ১০০ পয়েন্ট = ৫%)।',
      'Salesman ও Manager রোলে পণ্যের ক্রয়মূল্য (Buying Price) সম্পূর্ণ গোপন ও সংরক্ষিত।',
      'ইনভেন্টরি স্টক সমন্বয়ের জন্য পূর্ণাঙ্গ Stock Adjustment History লেজার।',
    ],
    highlightsEn: [
      'Shop-isolated customer loyalty points with owner-configurable discount redemption tiers.',
      'Complete buying price masking and cost preservation when non-owner staff edit products or categories.',
      'Auditable Stock Adjustment History ledger tracking every manual correction, sale, return, and restock.',
    ],
  },
];

export function canManageHelpCenterContent(role?: UserRole | string | null): boolean {
  return role === 'super_admin';
}

export function resolveShopScopeForHelp(
  shop?: Partial<TenantShop> | null
): 'CLOTHING' | 'SPORTSWEAR' {
  return isClothingShop(shop) ? 'CLOTHING' : 'SPORTSWEAR';
}

export function isHelpItemAllowedForShop(
  itemScope: HelpShopCategoryScope,
  shop?: Partial<TenantShop> | null
): boolean {
  if (itemScope === 'ALL') return true;
  const currentScope = resolveShopScopeForHelp(shop);
  return itemScope === currentScope;
}

export function filterTutorialsForViewer(
  tutorials: HelpTutorialItem[],
  shop?: Partial<TenantShop> | null,
  role?: UserRole | string | null,
  options?: {
    subcategory?: TutorialSubcategoryId | 'all';
    includeUnpublishedForAdmin?: boolean;
  }
): HelpTutorialItem[] {
  const isAdmin = canManageHelpCenterContent(role) && options?.includeUnpublishedForAdmin;
  return tutorials.filter((item) => {
    if (!isAdmin && item.status !== 'published') return false;
    if (!isAdmin && !isHelpItemAllowedForShop(item.shopCategoryScope, shop)) return false;
    if (options?.subcategory && options.subcategory !== 'all' && item.subcategory !== options.subcategory) {
      return false;
    }
    return true;
  });
}

export function filterFaqsForViewer(
  faqs: HelpFaqItem[],
  shop?: Partial<TenantShop> | null,
  role?: UserRole | string | null,
  options?: {
    group?: FaqGroupId | 'all';
    includeUnpublishedForAdmin?: boolean;
  }
): HelpFaqItem[] {
  const isAdmin = canManageHelpCenterContent(role) && options?.includeUnpublishedForAdmin;
  return faqs.filter((item) => {
    if (!isAdmin && item.status !== 'published') return false;
    if (!isAdmin && !isHelpItemAllowedForShop(item.shopCategoryScope, shop)) return false;
    if (options?.group && options.group !== 'all' && item.group !== options.group) {
      return false;
    }
    return true;
  });
}

export interface HelpSearchResultItem {
  id: string;
  category: HelpCenterCategoryId;
  titleBn: string;
  titleEn: string;
  snippetBn: string;
  snippetEn: string;
}

export function searchHelpCenterContent(
  query: string,
  shop?: Partial<TenantShop> | null,
  role?: UserRole | string | null,
  customTutorials: HelpTutorialItem[] = DEFAULT_HELP_TUTORIALS,
  customFaqs: HelpFaqItem[] = DEFAULT_HELP_FAQS,
  policies: LegalPolicyDocument[] = LEGAL_POLICY_DOCUMENTS,
  updates: AppUpdateAnnouncement[] = DEFAULT_APP_UPDATES
): HelpSearchResultItem[] {
  const clean = String(query || '').trim().toLowerCase();
  if (!clean) return [];

  const results: HelpSearchResultItem[] = [];

  const visibleTutorials = filterTutorialsForViewer(customTutorials, shop, role);
  for (const t of visibleTutorials) {
    const haystack = `${t.titleBn} ${t.titleEn} ${t.summaryBn} ${t.summaryEn} ${t.stepsBn.join(' ')} ${t.stepsEn.join(' ')}`.toLowerCase();
    if (haystack.includes(clean)) {
      results.push({
        id: t.id,
        category: 'tutorials',
        titleBn: t.titleBn,
        titleEn: t.titleEn,
        snippetBn: t.summaryBn,
        snippetEn: t.summaryEn,
      });
    }
  }

  const visibleFaqs = filterFaqsForViewer(customFaqs, shop, role);
  for (const f of visibleFaqs) {
    const haystack = `${f.questionBn} ${f.questionEn} ${f.answerBn} ${f.answerEn}`.toLowerCase();
    if (haystack.includes(clean)) {
      results.push({
        id: f.id,
        category: 'faq',
        titleBn: f.questionBn,
        titleEn: f.questionEn,
        snippetBn: f.answerBn,
        snippetEn: f.answerEn,
      });
    }
  }

  for (const p of policies) {
    const sectionText = p.sections
      .map((s) => `${s.headingBn} ${s.headingEn} ${s.bodyBn} ${s.bodyEn}`)
      .join(' ');
    const haystack = `${p.titleBn} ${p.titleEn} ${p.summaryBn} ${p.summaryEn} ${sectionText}`.toLowerCase();
    if (haystack.includes(clean)) {
      results.push({
        id: p.id,
        category: 'policies',
        titleBn: p.titleBn,
        titleEn: p.titleEn,
        snippetBn: p.summaryBn,
        snippetEn: p.summaryEn,
      });
    }
  }

  for (const u of updates) {
    if (u.status !== 'published' && !canManageHelpCenterContent(role)) continue;
    const haystack = `${u.version} ${u.titleBn} ${u.titleEn} ${u.summaryBn} ${u.summaryEn} ${u.highlightsBn.join(' ')} ${u.highlightsEn.join(' ')}`.toLowerCase();
    if (haystack.includes(clean)) {
      results.push({
        id: u.id,
        category: 'updates',
        titleBn: `${u.version} — ${u.titleBn}`,
        titleEn: `${u.version} — ${u.titleEn}`,
        snippetBn: u.summaryBn,
        snippetEn: u.summaryEn,
      });
    }
  }

  return results;
}

export function validateSupportTicketInput(input: Partial<SupportTicketInput>): {
  valid: boolean;
  errorBn?: string;
  errorEn?: string;
} {
  const name = String(input.reporterName || '').trim();
  const contact = String(input.reporterEmailOrPhone || '').trim();
  const subject = String(input.subject || '').trim();
  const message = String(input.message || '').trim();

  if (!name) {
    return {
      valid: false,
      errorBn: 'অনুগ্রহ করে আপনার নাম লিখুন।',
      errorEn: 'Please enter your name.',
    };
  }
  if (!contact || contact.length < 5) {
    return {
      valid: false,
      errorBn: 'অনুগ্রহ করে সঠিক মোবাইল নম্বর বা ইমেইল ঠিকানা দিন।',
      errorEn: 'Please provide a valid phone number or email address.',
    };
  }
  if (!subject || subject.length < 3) {
    return {
      valid: false,
      errorBn: 'সমস্যার সংক্ষিপ্ত বিষয় (Subject) লিখুন।',
      errorEn: 'Please enter a brief subject for your issue.',
    };
  }
  if (!message || message.length < 10) {
    return {
      valid: false,
      errorBn: 'সমস্যার বিস্তারিত বিবরণ কমপক্ষে ১০ অক্ষরে লিখুন।',
      errorEn: 'Please describe your issue in at least 10 characters.',
    };
  }
  return { valid: true };
}
