import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { dbService } from '../../services/db';
import { evaluateSubscriptionStatus, isClothingShop } from '../../utils/securityPolicy';
import {
  HelpCenterCategoryId,
  TutorialSubcategoryId,
  FaqGroupId,
  LegalPolicyId,
  HelpTutorialItem,
  HelpFaqItem,
  AppUpdateAnnouncement,
  SupportTicketRecord,
  TUTORIAL_SUBCATEGORIES,
  FAQ_GROUPS,
  DEFAULT_HELP_TUTORIALS,
  DEFAULT_HELP_FAQS,
  LEGAL_POLICY_DOCUMENTS,
  DEFAULT_APP_UPDATES,
  canManageHelpCenterContent,
  filterTutorialsForViewer,
  filterFaqsForViewer,
  searchHelpCenterContent,
  validateSupportTicketInput,
} from '../../utils/helpCenterEngine';

interface LekhoHelpCenterProps {
  initialCategory?: HelpCenterCategoryId;
  initialPolicyId?: LegalPolicyId;
  onBack?: () => void;
  embeddedInSettings?: boolean;
}

const CUSTOM_TUTORIALS_KEY = 'lekho_help_tutorials_v1';
const CUSTOM_FAQS_KEY = 'lekho_help_faqs_v1';
const CUSTOM_UPDATES_KEY = 'lekho_help_updates_v1';
const SUPPORT_TICKETS_KEY = 'lekho_support_tickets_v1';

// Clean line icons matching the reference SVG paths & stroke style (1.7px stroke, round caps/joins)
const RefIcon: React.FC<{
  name:
    | 'x'
    | 'left'
    | 'search'
    | 'play'
    | 'book'
    | 'card'
    | 'shield'
    | 'spark'
    | 'chat'
    | 'clock'
    | 'down'
    | 'right'
    | 'phone'
    | 'mail'
    | 'vid'
    | 'plus'
    | 'check'
    | 'copy'
    | 'send';
  className?: string;
}> = ({ name, className = 'w-5 h-5' }) => {
  return (
    <svg
      className={`fill-none stroke-current stroke-[1.7] [stroke-linecap:round] [stroke-linejoin:round] shrink-0 ${className}`}
      viewBox="0 0 24 24"
    >
      {name === 'x' && <path d="M6 6l12 12M18 6 6 18" />}
      {name === 'left' && <path d="M19 12H5M11 6l-6 6 6 6" />}
      {name === 'search' && (
        <>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </>
      )}
      {name === 'play' && (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="m10.5 8.5 5 3.5-5 3.5Z" />
        </>
      )}
      {name === 'book' && (
        <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v15H5.5A1.5 1.5 0 0 0 4 20.5ZM20 5.5A1.5 1.5 0 0 0 18.5 4H13v15h5.5a1.5 1.5 0 0 1 1.5 1.5Z" />
      )}
      {name === 'card' && (
        <>
          <rect x="3" y="5" width="18" height="14" rx="2.5" />
          <path d="M3 10h18" />
        </>
      )}
      {name === 'shield' && (
        <>
          <path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6Z" />
          <path d="m9 12 2 2 4-4" />
        </>
      )}
      {name === 'spark' && (
        <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2 2M16 16l2 2M6 18l2-2M16 8l2-2" />
      )}
      {name === 'chat' && <path d="M4 5h16v11H9l-5 4Z" />}
      {name === 'clock' && (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </>
      )}
      {name === 'down' && <path d="m6 9 6 6 6-6" />}
      {name === 'right' && <path d="m9 6 6 6-6 6" />}
      {name === 'phone' && (
        <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2Z" />
      )}
      {name === 'mail' && (
        <>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m3 7 9 6 9-6" />
        </>
      )}
      {name === 'vid' && (
        <>
          <rect x="3" y="6" width="13" height="12" rx="2" />
          <path d="m16 10 5-3v10l-5-3" />
        </>
      )}
      {name === 'plus' && <path d="M12 5v14M5 12h14" />}
      {name === 'check' && <path d="m5 12 5 5L20 7" />}
      {name === 'copy' && (
        <>
          <rect x="9" y="9" width="11" height="11" rx="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </>
      )}
      {name === 'send' && <path d="m22 2-7 20-4-9-9-4Z" />}
    </svg>
  );
};

export const LekhoHelpCenter: React.FC<LekhoHelpCenterProps> = ({
  initialCategory = 'tutorials',
  initialPolicyId,
  onBack,
  embeddedInSettings = false,
}) => {
  const { currentTenant, role, activeStaff, language, pickText, reloadShopData, showToast } = useApp();

  const [activeCategory, setActiveCategory] = useState<HelpCenterCategoryId>(initialCategory);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubcategory, setSelectedSubcategory] = useState<TutorialSubcategoryId | 'all'>('all');
  const [selectedFaqGroup, setSelectedFaqGroup] = useState<FaqGroupId | 'all'>('all');
  const [expandedFaqIds, setExpandedFaqIds] = useState<Record<string, boolean>>({
    faq_pos_1: true,
    faq_inv_1: true,
  });
  const [activeTutorialModal, setActiveTutorialModal] = useState<HelpTutorialItem | null>(null);
  const [selectedPolicyId, setSelectedPolicyId] = useState<LegalPolicyId | null>(
    initialPolicyId || null
  );
  const [selectedUpdateId, setSelectedUpdateId] = useState<string | null>(null);
  const [updatesFilter, setUpdatesFilter] = useState<'published' | 'archived'>('published');

  // Persisted customizable help items (Super Admin can add/edit/publish/archive)
  const [tutorials, setTutorials] = useState<HelpTutorialItem[]>(() => {
    try {
      const saved = localStorage.getItem(CUSTOM_TUTORIALS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_HELP_TUTORIALS;
  });

  const [faqs] = useState<HelpFaqItem[]>(() => {
    try {
      const saved = localStorage.getItem(CUSTOM_FAQS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_HELP_FAQS;
  });

  const [updates, setUpdates] = useState<AppUpdateAnnouncement[]>(() => {
    try {
      const saved = localStorage.getItem(CUSTOM_UPDATES_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_APP_UPDATES;
  });

  // Super Admin tutorial editor state
  const isSuperAdmin = canManageHelpCenterContent(role);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [adminTutTitleBn, setAdminTutTitleBn] = useState('');
  const [adminTutTitleEn, setAdminTutTitleEn] = useState('');
  const [adminTutSummaryBn, setAdminTutSummaryBn] = useState('');
  const [adminTutSubcat, setAdminTutSubcat] = useState<TutorialSubcategoryId>('getting_started');
  const [adminTutScope, setAdminTutScope] = useState<'ALL' | 'CLOTHING' | 'SPORTSWEAR'>('ALL');
  const [adminTutVideoUrl, setAdminTutVideoUrl] = useState('');

  // Subscription Renewal state (Category 3: Subscription & Billing)
  const [renewalPlan, setRenewalPlan] = useState<'starter' | 'pro'>(
    currentTenant.subscription?.plan || 'pro'
  );
  const [renewalMethod, setRenewalMethod] = useState<'bkash' | 'nagad'>('bkash');
  const [renewalSenderPhone, setRenewalSenderPhone] = useState(currentTenant.ownerPhone || '');
  const [renewalTrxId, setRenewalTrxId] = useState('');
  const [copiedPaymentNum, setCopiedPaymentNum] = useState<string | null>(null);

  // Support Ticket state (Category 6: Contact Support)
  const [tickets, setTickets] = useState<SupportTicketRecord[]>(() => {
    try {
      const raw = localStorage.getItem(SUPPORT_TICKETS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });
  const [reporterName, setReporterName] = useState(
    activeStaff?.name || currentTenant.ownerName || ''
  );
  const [reporterContact, setReporterContact] = useState(
    currentTenant.ownerPhone || currentTenant.ownerEmail || ''
  );
  const [ticketCategory, setTicketCategory] =
    useState<SupportTicketRecord['category']>('pos_issue');
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketMessage, setTicketMessage] = useState('');
  const [ticketError, setTicketError] = useState('');

  const isClothing = isClothingShop(currentTenant);
  const subStatus = evaluateSubscriptionStatus(currentTenant.subscription);
  const canSubmitRenewal = role === 'shop_owner' || role === 'super_admin';

  const cleanSearch = searchQuery.toLowerCase().trim();

  const visibleTutorials = useMemo(() => {
    const base = filterTutorialsForViewer(tutorials, currentTenant, role, {
      subcategory: selectedSubcategory,
      includeUnpublishedForAdmin: isSuperAdmin,
    });
    if (!cleanSearch) return base;
    return base.filter((t) =>
      `${t.titleBn} ${t.titleEn} ${t.summaryBn} ${t.summaryEn} ${t.subcategory}`
        .toLowerCase()
        .includes(cleanSearch)
    );
  }, [tutorials, currentTenant, role, selectedSubcategory, isSuperAdmin, cleanSearch]);

  const visibleFaqs = useMemo(() => {
    const base = filterFaqsForViewer(faqs, currentTenant, role, {
      group: selectedFaqGroup,
      includeUnpublishedForAdmin: isSuperAdmin,
    });
    if (!cleanSearch) return base;
    return base.filter((f) =>
      `${f.questionBn} ${f.questionEn} ${f.answerBn} ${f.answerEn} ${f.group}`
        .toLowerCase()
        .includes(cleanSearch)
    );
  }, [faqs, currentTenant, role, selectedFaqGroup, isSuperAdmin, cleanSearch]);

  const visiblePolicies = useMemo(() => {
    if (!cleanSearch) return LEGAL_POLICY_DOCUMENTS;
    return LEGAL_POLICY_DOCUMENTS.filter((p) =>
      `${p.titleBn} ${p.titleEn} ${p.summaryBn} ${p.summaryEn}`
        .toLowerCase()
        .includes(cleanSearch)
    );
  }, [cleanSearch]);

  const visibleUpdates = useMemo(() => {
    const base = updates.filter((u) => u.status === updatesFilter);
    if (!cleanSearch) return base;
    return base.filter((u) =>
      `${u.titleBn} ${u.titleEn} ${u.summaryBn} ${u.summaryEn} ${u.version}`
        .toLowerCase()
        .includes(cleanSearch)
    );
  }, [updates, updatesFilter, cleanSearch]);

  const searchResults = useMemo(
    () =>
      searchHelpCenterContent(
        searchQuery,
        currentTenant,
        role,
        tutorials,
        faqs,
        LEGAL_POLICY_DOCUMENTS,
        updates
      ),
    [searchQuery, currentTenant, role, tutorials, faqs, updates]
  );

  const shopTickets = useMemo(
    () => tickets.filter((t) => t.shopId === currentTenant.id),
    [tickets, currentTenant.id]
  );

  const totalTutorialsCount = useMemo(
    () =>
      filterTutorialsForViewer(tutorials, currentTenant, role, {
        subcategory: 'all',
        includeUnpublishedForAdmin: isSuperAdmin,
      }).length,
    [tutorials, currentTenant, role, isSuperAdmin]
  );

  const totalFaqsCount = useMemo(
    () =>
      filterFaqsForViewer(faqs, currentTenant, role, {
        group: 'all',
        includeUnpublishedForAdmin: isSuperAdmin,
      }).length,
    [faqs, currentTenant, role, isSuperAdmin]
  );

  const categories: Array<{
    id: HelpCenterCategoryId;
    titleBn: string;
    titleEn: string;
    iconName: 'play' | 'book' | 'card' | 'shield' | 'spark' | 'chat';
    badge: string;
  }> = [
    {
      id: 'tutorials',
      titleBn: 'হেল্প ও টিউটোরিয়াল',
      titleEn: 'Help & tutorials',
      iconName: 'play',
      badge: `${totalTutorialsCount}`,
    },
    {
      id: 'faq',
      titleBn: 'প্রশ্নোত্তর ও সমাধান',
      titleEn: 'FAQ & troubleshooting',
      iconName: 'book',
      badge: `${totalFaqsCount}`,
    },
    {
      id: 'billing',
      titleBn: 'সাবস্ক্রিপশন ও বিলিং',
      titleEn: 'Subscription & billing',
      iconName: 'card',
      badge:
        subStatus.status === 'active'
          ? pickText('সক্রিয়', 'Active')
          : subStatus.status === 'grace'
          ? pickText('গ্রেস', 'Grace')
          : pickText('বকেয়া', 'Expired'),
    },
    {
      id: 'policies',
      titleBn: 'পলিসি ও আইনি তথ্য',
      titleEn: 'Policies & legal',
      iconName: 'shield',
      badge: `${LEGAL_POLICY_DOCUMENTS.length}`,
    },
    {
      id: 'updates',
      titleBn: 'আপডেট ও ঘোষণা',
      titleEn: 'Updates & announcements',
      iconName: 'spark',
      badge: updates[0]?.version || 'v2.6.0',
    },
    {
      id: 'support',
      titleBn: 'সাপোর্টে যোগাযোগ',
      titleEn: 'Contact support',
      iconName: 'chat',
      badge: '24/7',
    },
  ];

  const handleSaveAdminTutorial = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperAdmin) return;
    if (!adminTutTitleBn.trim() && !adminTutTitleEn.trim()) {
      showToast(
        pickText('অনুগ্রহ করে টিউটোরিয়ালের শিরোনাম লিখুন', 'Please enter a tutorial title'),
        'warning'
      );
      return;
    }
    const newItem: HelpTutorialItem = {
      id: `tut_custom_${Date.now()}`,
      subcategory: adminTutSubcat,
      shopCategoryScope: adminTutScope,
      status: 'published',
      titleBn: adminTutTitleBn.trim() || adminTutTitleEn.trim(),
      titleEn: adminTutTitleEn.trim() || adminTutTitleBn.trim(),
      summaryBn: adminTutSummaryBn.trim() || 'স্টোর পরিচালনার নির্দেশিকা।',
      summaryEn: adminTutSummaryBn.trim() || 'Store operational tutorial guide.',
      duration: '3 min',
      videoUrl: adminTutVideoUrl.trim(),
      stepsBn: [adminTutSummaryBn.trim() || 'নির্দেশনা অনুসরণ করুন।'],
      stepsEn: [adminTutSummaryBn.trim() || 'Follow the step-by-step instructions.'],
      updatedAt: new Date().toISOString().split('T')[0],
    };
    const next = [newItem, ...tutorials];
    setTutorials(next);
    try {
      localStorage.setItem(CUSTOM_TUTORIALS_KEY, JSON.stringify(next));
    } catch {}
    setIsAdminModalOpen(false);
    setAdminTutTitleBn('');
    setAdminTutTitleEn('');
    setAdminTutSummaryBn('');
    setAdminTutVideoUrl('');
    showToast(
      pickText('নতুন টিউটোরিয়াল সফলভাবে প্রকাশিত হয়েছে!', 'New tutorial published successfully!'),
      'success'
    );
  };

  const handleToggleTutorialStatus = (id: string) => {
    if (!isSuperAdmin) return;
    const next = tutorials.map((t) => {
      if (t.id !== id) return t;
      const nextStatus: HelpTutorialItem['status'] =
        t.status === 'published'
          ? 'unpublished'
          : t.status === 'unpublished'
          ? 'archived'
          : 'published';
      return { ...t, status: nextStatus };
    });
    setTutorials(next);
    try {
      localStorage.setItem(CUSTOM_TUTORIALS_KEY, JSON.stringify(next));
    } catch {}
    showToast(
      pickText('টিউটোরিয়ালের স্ট্যাটাস আপডেট করা হয়েছে', 'Tutorial status updated'),
      'info'
    );
  };

  const handleRenewalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmitRenewal) {
      showToast(
        pickText(
          'শুধুমাত্র দোকানের মালিক (Owner) সাবস্ক্রিপশন নবায়ন করতে পারবেন।',
          'Only the Store Owner can submit subscription renewals.'
        ),
        'error'
      );
      return;
    }
    const cleanTrx = renewalTrxId.trim().toUpperCase();
    const cleanPhone = renewalSenderPhone.trim();
    if (cleanTrx.length < 6 || cleanPhone.length < 10) {
      showToast(
        pickText(
          'সঠিক Sender মোবাইল নম্বর এবং কমপক্ষে ৬ অক্ষরের TrxID দিন।',
          'Enter a valid sender phone number and at least 6-character TrxID.'
        ),
        'warning'
      );
      return;
    }
    const fee = renewalPlan === 'starter' ? 499 : 999;
    const graceExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    dbService.updateTenant(currentTenant.id, {
      subscription: {
        ...currentTenant.subscription,
        plan: renewalPlan,
        status: 'grace',
        amount: fee,
        monthlyFeeBdt: fee,
        trxId: cleanTrx,
        pendingTrxId: cleanTrx,
        senderPhone: cleanPhone,
        paymentMethod: renewalMethod,
        submittedAt: new Date().toISOString(),
        graceEndsAt: graceExpiry,
        expiresAt: graceExpiry,
      },
    });
    reloadShopData();
    setRenewalTrxId('');
    showToast(
      pickText(
        `TrxID (${cleanTrx}) জমা হয়েছে! আপনার দোকানে তাৎক্ষণিক ২৪-ঘণ্টা Grace Access চালু করা হয়েছে।`,
        `TrxID (${cleanTrx}) submitted! 24-hour Grace Access has been activated.`
      ),
      'success'
    );
  };

  const handleSubmitSupportTicket = (e: React.FormEvent) => {
    e.preventDefault();
    setTicketError('');
    const validation = validateSupportTicketInput({
      shopId: currentTenant.id,
      shopName: currentTenant.name,
      reporterName,
      reporterEmailOrPhone: reporterContact,
      category: ticketCategory,
      subject: ticketSubject,
      message: ticketMessage,
    });

    if (!validation.valid) {
      setTicketError(
        language === 'en'
          ? validation.errorEn || 'Invalid form input'
          : validation.errorBn || 'ফর্মের তথ্য সঠিক নয়'
      );
      return;
    }

    const newTicket: SupportTicketRecord = {
      id: `TKT-${Date.now().toString().slice(-6)}`,
      shopId: currentTenant.id,
      shopName: currentTenant.name,
      reporterName: reporterName.trim(),
      reporterEmailOrPhone: reporterContact.trim(),
      category: ticketCategory,
      subject: ticketSubject.trim(),
      message: ticketMessage.trim(),
      status: 'open',
      createdAt: new Date().toISOString(),
    };

    const next = [newTicket, ...tickets];
    setTickets(next);
    try {
      localStorage.setItem(SUPPORT_TICKETS_KEY, JSON.stringify(next));
    } catch {}
    setTicketSubject('');
    setTicketMessage('');
    showToast(
      pickText(
        `সাপোর্ট টিকেট (${newTicket.id}) সফলভাবে সংরক্ষিত হয়েছে!`,
        `Support Ticket (${newTicket.id}) submitted successfully!`
      ),
      'success'
    );
  };

  const selectedPolicy = useMemo(
    () => LEGAL_POLICY_DOCUMENTS.find((p) => p.id === selectedPolicyId) || null,
    [selectedPolicyId]
  );

  return (
    <div
      className={`text-[#14201a] dark:text-zinc-100 font-bengali text-[15px] leading-[1.5] ${
        embeddedInSettings
          ? 'max-w-[560px] mx-auto pb-12'
          : 'max-w-[560px] mx-auto px-4 pb-12 pt-2 bg-[#f6f7f6] dark:bg-zinc-950 min-h-full rounded-2xl'
      }`}
    >
      {/* Back Pill Button (When standalone onBack is passed) */}
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-[6px] h-[36px] pl-[10px] pr-[14px] rounded-[99px] bg-[#eef2ef] dark:bg-zinc-800 text-[#14201a] dark:text-zinc-100 font-medium text-[14px] mt-[6px] mb-[18px] cursor-pointer transition hover:opacity-90"
        >
          <RefIcon name="left" className="w-[16px] h-[16px]" />
          <span>{pickText('সব সেটিংস', 'All settings')}</span>
        </button>
      )}

      {/* Main Heading & Optional Super Admin Add Button */}
      <div className="flex items-center justify-between gap-3 mb-[16px]">
        <h1 className="text-[26px] font-bold tracking-[-0.02em] text-[#14201a] dark:text-white leading-tight">
          {pickText('হেল্প সেন্টার ও সাপোর্ট', 'Help center & support')}
        </h1>

        {isSuperAdmin && (
          <button
            type="button"
            onClick={() => setIsAdminModalOpen(true)}
            className="h-[38px] px-[14px] rounded-[12px] bg-[#0d6b45] text-white font-semibold text-[13.5px] inline-flex items-center gap-[6px] shrink-0 cursor-pointer"
          >
            <RefIcon name="plus" className="w-[16px] h-[16px]" />
            <span>{pickText('নতুন গাইড', 'Add guide')}</span>
          </button>
        )}
      </div>

      {/* Search Field (.field & .in) */}
      <div className="relative mb-[16px]">
        <span className="absolute left-[14px] top-1/2 -translate-y-1/2 text-[#6b766f] pointer-events-none">
          <RefIcon name="search" className="w-[18px] h-[18px]" />
        </span>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={pickText(
            'টিউটোরিয়াল, প্রশ্নোত্তর ও পলিসি খুঁজুন',
            'Search tutorials, FAQs, policies'
          )}
          autoComplete="off"
          className="w-full h-[48px] rounded-[14px] border border-[#e5e9e6] dark:border-zinc-800 bg-white dark:bg-zinc-900 pl-[42px] pr-[38px] text-[15px] text-[#14201a] dark:text-white placeholder-[#6b766f] outline-none focus:border-[#0d6b45] transition"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-[12px] top-1/2 -translate-y-1/2 text-[#6b766f] hover:text-[#14201a] dark:hover:text-white cursor-pointer"
            title={pickText('মুছুন', 'Clear')}
          >
            <RefIcon name="x" className="w-[16px] h-[16px]" />
          </button>
        )}
      </div>

      {/* Cross-Category Quick Search Matches (when searching across other tabs) */}
      {cleanSearch.length > 0 && searchResults.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 border border-[#e5e9e6] dark:border-zinc-800 rounded-[18px] mb-[16px] overflow-hidden">
          <div className="px-[16px] py-[10px] border-b border-[#e5e9e6] dark:border-zinc-800 flex items-center justify-between text-[13px] text-[#6b766f]">
            <span>
              {pickText(
                `"${searchQuery}" এর জন্য ${searchResults.length} টি ফলাফল`,
                `${searchResults.length} results for "${searchQuery}"`
              )}
            </span>
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="text-[#0d6b45] font-medium cursor-pointer"
            >
              {pickText('মুছুন', 'Clear')}
            </button>
          </div>
          <div className="max-h-60 overflow-y-auto divide-y divide-[#e5e9e6] dark:divide-zinc-800">
            {searchResults.map((res) => (
              <button
                key={`${res.category}_${res.id}`}
                type="button"
                onClick={() => {
                  setActiveCategory(res.category);
                  if (res.category === 'policies') {
                    setSelectedPolicyId(res.id as LegalPolicyId);
                  } else if (res.category === 'faq') {
                    setExpandedFaqIds((prev) => ({ ...prev, [res.id]: true }));
                  } else if (res.category === 'tutorials') {
                    const foundTut = tutorials.find((t) => t.id === res.id);
                    if (foundTut) setActiveTutorialModal(foundTut);
                  }
                  setSearchQuery('');
                }}
                className="flex items-center gap-[14px] px-[16px] py-[12px] w-full text-left hover:bg-[#f6f7f6] dark:hover:bg-zinc-800/60 transition cursor-pointer"
              >
                <div className="flex-1 min-w-0">
                  <b className="block font-semibold leading-[1.3] text-[14.5px] text-[#14201a] dark:text-white truncate">
                    {pickText(res.titleBn, res.titleEn)}
                  </b>
                  <small className="text-[13px] text-[#6b766f] block truncate">
                    {pickText(res.snippetBn, res.snippetEn)}
                  </small>
                </div>
                <span className="text-[12px] px-[10px] py-[2px] rounded-[99px] bg-[#e3f1ea] text-[#0d6b45] font-medium shrink-0">
                  {res.category}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 6 Category Tiles (.tiles & .tile) */}
      <div className="grid grid-cols-2 gap-[10px]">
        {categories.map((cat) => {
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              aria-pressed={isActive}
              onClick={() => {
                setActiveCategory(cat.id);
                if (cat.id !== 'policies') setSelectedPolicyId(null);
              }}
              className={`rounded-[16px] p-[14px] text-left flex flex-col justify-between gap-[18px] min-h-[92px] border transition cursor-pointer ${
                isActive
                  ? 'bg-[#0c3d2a] border-[#0c3d2a] text-white'
                  : 'bg-white dark:bg-zinc-900 border-[#e5e9e6] dark:border-zinc-800 text-[#14201a] dark:text-white hover:border-[#0d6b45]/50'
              }`}
            >
              <div className="flex justify-between items-center w-full">
                <div
                  className={`w-[36px] h-[36px] rounded-[11px] grid place-items-center ${
                    isActive
                      ? 'bg-white/14 text-white'
                      : 'bg-[#e3f1ea] text-[#0d6b45]'
                  }`}
                >
                  <RefIcon name={cat.iconName} className="w-[20px] h-[20px]" />
                </div>
                <span
                  className={`text-[12.5px] font-medium px-[9px] py-[1px] rounded-[99px] ${
                    isActive
                      ? 'bg-white/16 text-white'
                      : 'bg-[#eef2ef] dark:bg-zinc-800 text-[#6b766f] dark:text-zinc-300'
                  }`}
                >
                  {cat.badge}
                </span>
              </div>
              <div className="font-semibold leading-[1.25] text-[14.5px]">
                {pickText(cat.titleBn, cat.titleEn)}
              </div>
            </button>
          );
        })}
      </div>

      {/* ===================================================================== */}
      {/* CATEGORY 1: HELP & TUTORIALS                                          */}
      {/* ===================================================================== */}
      {activeCategory === 'tutorials' && (
        <div>
          <h2 className="text-[17px] font-semibold mt-[28px] mb-[12px] mx-[2px] flex justify-between items-baseline text-[#14201a] dark:text-white">
            <span>{pickText('ভিডিও টিউটোরিয়াল', 'Video tutorials')}</span>
            <span className="text-[13px] font-normal text-[#6b766f]">
              {visibleTutorials.length} {pickText('টি গাইড', 'guides')}
            </span>
          </h2>

          {/* Horizontal Scrollable Subcategory Chips (.chips & .chip) */}
          <div className="flex gap-[8px] overflow-x-auto no-scrollbar -mx-4 px-4 mb-[14px]">
            <button
              type="button"
              aria-pressed={selectedSubcategory === 'all'}
              onClick={() => setSelectedSubcategory('all')}
              className={`px-[14px] py-[7px] rounded-[99px] border text-[13.5px] whitespace-nowrap transition cursor-pointer ${
                selectedSubcategory === 'all'
                  ? 'bg-[#0d6b45] border-[#0d6b45] text-white font-medium'
                  : 'bg-white dark:bg-zinc-900 border-[#e5e9e6] dark:border-zinc-800 text-[#6b766f] dark:text-zinc-300'
              }`}
            >
              {pickText('সব বিভাগ', 'All categories')}
            </button>
            {TUTORIAL_SUBCATEGORIES.map((sub) => {
              const isSelected = selectedSubcategory === sub.id;
              return (
                <button
                  key={sub.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setSelectedSubcategory(sub.id)}
                  className={`px-[14px] py-[7px] rounded-[99px] border text-[13.5px] whitespace-nowrap transition cursor-pointer ${
                    isSelected
                      ? 'bg-[#0d6b45] border-[#0d6b45] text-white font-medium'
                      : 'bg-white dark:bg-zinc-900 border-[#e5e9e6] dark:border-zinc-800 text-[#6b766f] dark:text-zinc-300'
                  }`}
                >
                  {pickText(sub.labelBn, sub.labelEn)}
                </button>
              );
            })}
          </div>

          {/* Tutorial Cards (.card) */}
          {visibleTutorials.length === 0 ? (
            <div className="py-[36px] px-[16px] text-center text-[#6b766f]">
              {pickText('আপনার সার্চের সাথে কোনো গাইড মেলেনি।', 'No guides match your search.')}
            </div>
          ) : (
            visibleTutorials.map((tut) => {
              const subcatMeta = TUTORIAL_SUBCATEGORIES.find((s) => s.id === tut.subcategory);
              return (
                <div
                  key={tut.id}
                  className="bg-white dark:bg-zinc-900 border border-[#e5e9e6] dark:border-zinc-800 rounded-[18px] p-[16px] mb-[10px]"
                >
                  <div className="flex justify-between items-center gap-[10px] mb-[10px]">
                    <div className="flex gap-[6px] flex-wrap">
                      <span className="text-[12.5px] px-[10px] py-[2px] rounded-[99px] bg-[#e3f1ea] text-[#0d6b45] font-medium">
                        {subcatMeta ? pickText(subcatMeta.labelBn, subcatMeta.labelEn) : tut.subcategory}
                      </span>
                      {tut.shopCategoryScope !== 'ALL' && (
                        <span className="text-[12.5px] px-[10px] py-[2px] rounded-[99px] bg-[#eef2ef] dark:bg-zinc-800 text-[#6b766f] dark:text-zinc-300 font-medium">
                          {tut.shopCategoryScope === 'CLOTHING'
                            ? pickText('ক্লোথিং', 'Clothing')
                            : pickText('স্পোর্টসওয়্যার', 'Sportswear')}
                        </span>
                      )}
                    </div>
                    <span className="text-[12.5px] text-[#6b766f] flex items-center gap-[5px] shrink-0">
                      <RefIcon name="clock" className="w-[14px] h-[14px]" />
                      <span>{tut.duration.replace(' guide', '')}</span>
                    </span>
                  </div>

                  <h3 className="text-[16px] font-semibold leading-[1.35] mb-[6px] text-[#14201a] dark:text-white">
                    {pickText(tut.titleBn, tut.titleEn)}
                  </h3>
                  <p className="text-[14px] text-[#6b766f] leading-[1.5]">
                    {pickText(tut.summaryBn, tut.summaryEn)}
                  </p>

                  <div className="flex justify-between items-center mt-[14px] pt-[12px] border-t border-[#e5e9e6] dark:border-zinc-800 gap-2">
                    <small className="text-[13px] text-[#6b766f]">
                      {tut.videoUrl
                        ? pickText('ভেরিফাইড ভিডিও গাইড', 'Verified video guide')
                        : pickText('ধাপে ধাপে গাইড', 'Step-by-step guide')}
                    </small>

                    <div className="flex items-center gap-[8px]">
                      {isSuperAdmin && (
                        <button
                          type="button"
                          onClick={() => handleToggleTutorialStatus(tut.id)}
                          className="h-[38px] px-[12px] rounded-[12px] bg-[#eef2ef] dark:bg-zinc-800 text-[#6b766f] dark:text-zinc-300 text-[12.5px] font-medium cursor-pointer"
                        >
                          {tut.status}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setActiveTutorialModal(tut)}
                        className="h-[38px] px-[16px] rounded-[12px] bg-[#0d6b45] text-white font-semibold text-[14px] flex items-center gap-[7px] cursor-pointer hover:opacity-95 transition"
                      >
                        <RefIcon name="play" className="w-[16px] h-[16px]" />
                        <span>{pickText('গাইড দেখুন', 'Open guide')}</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* CATEGORY 2: FAQ & TROUBLESHOOTING                                     */}
      {/* ===================================================================== */}
      {activeCategory === 'faq' && (
        <div>
          <h2 className="text-[17px] font-semibold mt-[28px] mb-[12px] mx-[2px] flex justify-between items-baseline text-[#14201a] dark:text-white">
            <span>{pickText('সাধারণ জিজ্ঞাসা', 'Common questions')}</span>
            <span className="text-[13px] font-normal text-[#6b766f]">
              {visibleFaqs.length} {pickText('টি উত্তর', 'answers')}
            </span>
          </h2>

          {/* Topic Filter Chips */}
          <div className="flex gap-[8px] overflow-x-auto no-scrollbar -mx-4 px-4 mb-[14px]">
            <button
              type="button"
              aria-pressed={selectedFaqGroup === 'all'}
              onClick={() => setSelectedFaqGroup('all')}
              className={`px-[14px] py-[7px] rounded-[99px] border text-[13.5px] whitespace-nowrap transition cursor-pointer ${
                selectedFaqGroup === 'all'
                  ? 'bg-[#0d6b45] border-[#0d6b45] text-white font-medium'
                  : 'bg-white dark:bg-zinc-900 border-[#e5e9e6] dark:border-zinc-800 text-[#6b766f] dark:text-zinc-300'
              }`}
            >
              {pickText('সব বিষয়', 'All topics')}
            </button>
            {FAQ_GROUPS.map((grp) => {
              const isSelected = selectedFaqGroup === grp.id;
              return (
                <button
                  key={grp.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setSelectedFaqGroup(grp.id)}
                  className={`px-[14px] py-[7px] rounded-[99px] border text-[13.5px] whitespace-nowrap transition cursor-pointer ${
                    isSelected
                      ? 'bg-[#0d6b45] border-[#0d6b45] text-white font-medium'
                      : 'bg-white dark:bg-zinc-900 border-[#e5e9e6] dark:border-zinc-800 text-[#6b766f] dark:text-zinc-300'
                  }`}
                >
                  {pickText(grp.labelBn, grp.labelEn)}
                </button>
              );
            })}
          </div>

          {/* Expandable FAQ Accordion Items (details/summary reference layout) */}
          {visibleFaqs.length === 0 ? (
            <div className="py-[36px] px-[16px] text-center text-[#6b766f]">
              {pickText('আপনার সার্চের সাথে কোনো উত্তর মেলেনি।', 'No answers match your search.')}
            </div>
          ) : (
            visibleFaqs.map((faq) => {
              const isExpanded = Boolean(expandedFaqIds[faq.id]);
              return (
                <div
                  key={faq.id}
                  className="bg-white dark:bg-zinc-900 border border-[#e5e9e6] dark:border-zinc-800 rounded-[16px] mb-[10px]"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedFaqIds((prev) => ({ ...prev, [faq.id]: !prev[faq.id] }))
                    }
                    className="w-full py-[14px] px-[16px] font-semibold text-[15px] text-[#14201a] dark:text-white flex justify-between gap-[12px] items-center text-left cursor-pointer"
                  >
                    <span>{pickText(faq.questionBn, faq.questionEn)}</span>
                    <span
                      className={`text-[#6b766f] transition-transform duration-200 ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                    >
                      <RefIcon name="down" className="w-[16px] h-[16px]" />
                    </span>
                  </button>
                  {isExpanded && (
                    <p className="px-[16px] pb-[16px] pt-0 text-[14px] text-[#6b766f] leading-[1.5]">
                      {pickText(faq.answerBn, faq.answerEn)}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* CATEGORY 3: SUBSCRIPTION & BILLING                                    */}
      {/* ===================================================================== */}
      {activeCategory === 'billing' && (
        <div>
          <h2 className="text-[17px] font-semibold mt-[28px] mb-[12px] mx-[2px] flex justify-between items-baseline text-[#14201a] dark:text-white">
            <span>{pickText('আপনার প্ল্যান', 'Your plan')}</span>
            <span className="text-[13px] font-normal text-[#6b766f]">
              {subStatus.daysRemaining} {pickText('দিন বাকি', 'days left')}
            </span>
          </h2>

          {/* Hero Plan Card (.plan) */}
          <div className="bg-[#0c3d2a] text-white rounded-[20px] p-[20px] mb-[12px]">
            <small className="opacity-70 text-[13px] block">
              {pickText('বর্তমান প্ল্যান', 'Current plan')}
            </small>
            <div className="text-[24px] font-bold mt-[2px] mb-[14px]">
              {currentTenant.subscription?.plan === 'starter'
                ? pickText('স্টার্টার', 'Starter')
                : pickText('প্রো', 'Pro')}{' '}
              ·{' '}
              {subStatus.status === 'active'
                ? pickText('সক্রিয়', 'Active')
                : subStatus.status === 'grace'
                ? pickText('২৪-ঘণ্টা গ্রেস', 'Grace')
                : pickText('মেয়াদ উত্তীর্ণ', 'Expired')}
            </div>
            <div className="flex justify-between text-[14px] pt-[12px] border-t border-white/14">
              <span className="opacity-70">{pickText('নবায়ন / মেয়াদ', 'Renews on')}</span>
              <span>
                {currentTenant.subscription?.expiresAt ||
                  currentTenant.subscription?.graceEndsAt ||
                  '28 Nov 2026'}
              </span>
            </div>
          </div>

          {/* Payment Numbers List (.list) */}
          <div className="bg-white dark:bg-zinc-900 border border-[#e5e9e6] dark:border-zinc-800 rounded-[18px] mb-[12px] overflow-hidden">
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText('01711-223399');
                setCopiedPaymentNum('bkash');
                setTimeout(() => setCopiedPaymentNum(null), 1800);
              }}
              className="flex items-center gap-[14px] py-[14px] px-[16px] w-full text-left cursor-pointer hover:bg-[#f6f7f6] dark:hover:bg-zinc-800/50 transition"
            >
              <div className="w-[36px] h-[36px] rounded-[11px] bg-[#e3f1ea] text-[#0d6b45] grid place-items-center shrink-0">
                <RefIcon name="card" className="w-[20px] h-[20px]" />
              </div>
              <div className="flex-1 min-w-0">
                <b className="block font-semibold leading-[1.3] text-[#14201a] dark:text-white">
                  {pickText('বিকাশ রিনিউয়াল নম্বর: 01711-223399', 'bKash renewal: 01711-223399')}
                </b>
                <small className="text-[13px] text-[#6b766f]">
                  {pickText('নম্বর কপি করতে ট্যাপ করুন', 'Tap to copy payment number')}
                </small>
              </div>
              <span className="text-[#6b766f]">
                <RefIcon
                  name={copiedPaymentNum === 'bkash' ? 'check' : 'copy'}
                  className="w-[16px] h-[16px]"
                />
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText('01822-445588');
                setCopiedPaymentNum('nagad');
                setTimeout(() => setCopiedPaymentNum(null), 1800);
              }}
              className="flex items-center gap-[14px] py-[14px] px-[16px] w-full text-left border-t border-[#e5e9e6] dark:border-zinc-800 cursor-pointer hover:bg-[#f6f7f6] dark:hover:bg-zinc-800/50 transition"
            >
              <div className="w-[36px] h-[36px] rounded-[11px] bg-[#e3f1ea] text-[#0d6b45] grid place-items-center shrink-0">
                <RefIcon name="card" className="w-[20px] h-[20px]" />
              </div>
              <div className="flex-1 min-w-0">
                <b className="block font-semibold leading-[1.3] text-[#14201a] dark:text-white">
                  {pickText('নগদ রিনিউয়াল নম্বর: 01822-445588', 'Nagad renewal: 01822-445588')}
                </b>
                <small className="text-[13px] text-[#6b766f]">
                  {pickText('নম্বর কপি করতে ট্যাপ করুন', 'Tap to copy payment number')}
                </small>
              </div>
              <span className="text-[#6b766f]">
                <RefIcon
                  name={copiedPaymentNum === 'nagad' ? 'check' : 'copy'}
                  className="w-[16px] h-[16px]"
                />
              </span>
            </button>
          </div>

          {/* Renewal Form Card (.card) */}
          <div className="bg-white dark:bg-zinc-900 border border-[#e5e9e6] dark:border-zinc-800 rounded-[18px] p-[16px] mb-[10px]">
            <div className="flex justify-between items-center gap-[10px] mb-[10px]">
              <span className="text-[12.5px] px-[10px] py-[2px] rounded-[99px] bg-[#e3f1ea] text-[#0d6b45] font-medium">
                {pickText('সাবস্ক্রিপশন নবায়ন', 'Renew subscription')}
              </span>
              <span className="text-[12.5px] text-[#6b766f]">
                {pickText('২৪-ঘণ্টা গ্রেস অ্যাক্সেস', '24h grace access')}
              </span>
            </div>

            <h3 className="text-[16px] font-semibold leading-[1.35] mb-[6px] text-[#14201a] dark:text-white">
              {pickText('বিকাশ বা নগদ TrxID জমা দিন', 'Pay with bKash or Nagad TrxID')}
            </h3>
            <p className="text-[14px] text-[#6b766f] leading-[1.5] mb-[14px]">
              {pickText(
                'পেমেন্ট সম্পন্ন করে নিচের বক্সে আপনার মোবাইল নম্বর ও TrxID জমা দিন।',
                'Submit your sender mobile number and TrxID after sending the monthly fee.'
              )}
            </p>

            {canSubmitRenewal ? (
              <form onSubmit={handleRenewalSubmit} className="space-y-[10px]">
                <div className="grid grid-cols-2 gap-[10px]">
                  <select
                    value={renewalPlan}
                    onChange={(e) => setRenewalPlan(e.target.value as 'starter' | 'pro')}
                    className="w-full h-[48px] rounded-[14px] border border-[#e5e9e6] dark:border-zinc-800 bg-white dark:bg-zinc-900 px-[14px] text-[14.5px] text-[#14201a] dark:text-white outline-none focus:border-[#0d6b45]"
                  >
                    <option value="pro">{pickText('প্রো প্ল্যান (৳999)', 'Pro Plan (৳999)')}</option>
                    <option value="starter">
                      {pickText('স্টার্টার প্ল্যান (৳499)', 'Starter Plan (৳499)')}
                    </option>
                  </select>

                  <select
                    value={renewalMethod}
                    onChange={(e) => setRenewalMethod(e.target.value as 'bkash' | 'nagad')}
                    className="w-full h-[48px] rounded-[14px] border border-[#e5e9e6] dark:border-zinc-800 bg-white dark:bg-zinc-900 px-[14px] text-[14.5px] text-[#14201a] dark:text-white outline-none focus:border-[#0d6b45]"
                  >
                    <option value="bkash">bKash</option>
                    <option value="nagad">Nagad</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-[10px]">
                  <input
                    type="text"
                    required
                    value={renewalSenderPhone}
                    onChange={(e) => setRenewalSenderPhone(e.target.value)}
                    placeholder={pickText('প্রেরকের মোবাইল নম্বর (017...)', 'Sender phone (017...)')}
                    className="w-full h-[48px] rounded-[14px] border border-[#e5e9e6] dark:border-zinc-800 bg-white dark:bg-zinc-900 px-[14px] text-[15px] text-[#14201a] dark:text-white placeholder-[#6b766f] outline-none focus:border-[#0d6b45]"
                  />

                  <input
                    type="text"
                    required
                    value={renewalTrxId}
                    onChange={(e) => setRenewalTrxId(e.target.value.toUpperCase())}
                    placeholder={pickText('ট্রানজেকশন আইডি (TrxID)', 'Transaction ID (TrxID)')}
                    className="w-full h-[48px] rounded-[14px] border border-[#e5e9e6] dark:border-zinc-800 bg-white dark:bg-zinc-900 px-[14px] text-[15px] uppercase text-[#14201a] dark:text-white placeholder-[#6b766f] outline-none focus:border-[#0d6b45]"
                  />
                </div>

                <div className="flex justify-between items-center pt-[12px] border-t border-[#e5e9e6] dark:border-zinc-800">
                  <small className="text-[13px] text-[#6b766f]">
                    {renewalPlan === 'starter' ? '৳499 / 30 days' : '৳999 / 30 days'}
                  </small>
                  <button
                    type="submit"
                    className="h-[38px] px-[16px] rounded-[12px] bg-[#0d6b45] text-white font-semibold text-[14px] flex items-center gap-[7px] cursor-pointer hover:opacity-95 transition"
                  >
                    <RefIcon name="check" className="w-[16px] h-[16px]" />
                    <span>{pickText('TrxID জমা দিন', 'Submit TrxID')}</span>
                  </button>
                </div>
              </form>
            ) : (
              <p className="text-[14px] text-[#6b766f]">
                {pickText(
                  'শুধুমাত্র দোকানের মালিক (Shop Owner) সাবস্ক্রিপশন নবায়নের TrxID জমা দিতে পারবেন।',
                  'Only the Store Owner can submit subscription renewal TrxIDs.'
                )}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* CATEGORY 4: POLICIES & LEGAL                                          */}
      {/* ===================================================================== */}
      {activeCategory === 'policies' && (
        <div>
          {!selectedPolicy ? (
            <>
              <h2 className="text-[17px] font-semibold mt-[28px] mb-[12px] mx-[2px] flex justify-between items-baseline text-[#14201a] dark:text-white">
                <span>{pickText('পলিসি ও নীতিমালা', 'Policies')}</span>
                <span className="text-[13px] font-normal text-[#6b766f]">
                  {visiblePolicies.length} {pickText('টি ডকুমেন্ট', 'documents')}
                </span>
              </h2>

              {visiblePolicies.length === 0 ? (
                <div className="py-[36px] px-[16px] text-center text-[#6b766f]">
                  {pickText(
                    'আপনার সার্চের সাথে কোনো পলিসি মেলেনি।',
                    'No policies match your search.'
                  )}
                </div>
              ) : (
                <div className="bg-white dark:bg-zinc-900 border border-[#e5e9e6] dark:border-zinc-800 rounded-[18px] overflow-hidden">
                  {visiblePolicies.map((doc, idx) => (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => setSelectedPolicyId(doc.id)}
                      className={`flex items-center gap-[14px] py-[14px] px-[16px] w-full text-left cursor-pointer hover:bg-[#f6f7f6] dark:hover:bg-zinc-800/50 transition ${
                        idx > 0 ? 'border-t border-[#e5e9e6] dark:border-zinc-800' : ''
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <b className="block font-semibold leading-[1.3] text-[#14201a] dark:text-white">
                          {pickText(doc.titleBn, doc.titleEn)}
                        </b>
                        <small className="text-[13px] text-[#6b766f] block truncate">
                          {pickText(doc.summaryBn, doc.summaryEn)}
                        </small>
                      </div>
                      <span className="text-[#6b766f]">
                        <RefIcon name="right" className="w-[16px] h-[16px]" />
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            /* Policy Detail View */
            <div>
              <button
                type="button"
                onClick={() => setSelectedPolicyId(null)}
                className="inline-flex items-center gap-[6px] h-[36px] pl-[10px] pr-[14px] rounded-[99px] bg-[#eef2ef] dark:bg-zinc-800 text-[#14201a] dark:text-zinc-100 font-medium text-[14px] mt-[20px] mb-[12px] cursor-pointer"
              >
                <RefIcon name="left" className="w-[16px] h-[16px]" />
                <span>{pickText('সব পলিসি', 'All policies')}</span>
              </button>

              <h2 className="text-[17px] font-semibold mb-[12px] mx-[2px] flex justify-between items-baseline text-[#14201a] dark:text-white">
                <span>{pickText(selectedPolicy.titleBn, selectedPolicy.titleEn)}</span>
                <span className="text-[13px] font-normal text-[#6b766f]">
                  {selectedPolicy.lastUpdated}
                </span>
              </h2>

              {selectedPolicy.sections.map((sec, idx) => (
                <div
                  key={idx}
                  className="bg-white dark:bg-zinc-900 border border-[#e5e9e6] dark:border-zinc-800 rounded-[18px] p-[16px] mb-[10px]"
                >
                  <h3 className="text-[16px] font-semibold leading-[1.35] mb-[6px] text-[#14201a] dark:text-white">
                    {pickText(sec.headingBn, sec.headingEn)}
                  </h3>
                  <p className="text-[14px] text-[#6b766f] leading-[1.5]">
                    {pickText(sec.bodyBn, sec.bodyEn)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* CATEGORY 5: UPDATES & ANNOUNCEMENTS                                   */}
      {/* ===================================================================== */}
      {activeCategory === 'updates' && (
        <div>
          <h2 className="text-[17px] font-semibold mt-[28px] mb-[12px] mx-[2px] flex justify-between items-baseline text-[#14201a] dark:text-white">
            <span>{pickText('নতুন আপডেট', 'What’s new')}</span>
            <span className="text-[13px] font-normal text-[#6b766f]">
              {updates[0]?.version || 'v2.6.0'}
            </span>
          </h2>

          {/* Filter Chips for Active vs Archived Releases */}
          <div className="flex gap-[8px] overflow-x-auto no-scrollbar -mx-4 px-4 mb-[14px]">
            <button
              type="button"
              aria-pressed={updatesFilter === 'published'}
              onClick={() => setUpdatesFilter('published')}
              className={`px-[14px] py-[7px] rounded-[99px] border text-[13.5px] whitespace-nowrap transition cursor-pointer ${
                updatesFilter === 'published'
                  ? 'bg-[#0d6b45] border-[#0d6b45] text-white font-medium'
                  : 'bg-white dark:bg-zinc-900 border-[#e5e9e6] dark:border-zinc-800 text-[#6b766f] dark:text-zinc-300'
              }`}
            >
              {pickText('সক্রিয় আপডেট', 'Active releases')}
            </button>
            <button
              type="button"
              aria-pressed={updatesFilter === 'archived'}
              onClick={() => setUpdatesFilter('archived')}
              className={`px-[14px] py-[7px] rounded-[99px] border text-[13.5px] whitespace-nowrap transition cursor-pointer ${
                updatesFilter === 'archived'
                  ? 'bg-[#0d6b45] border-[#0d6b45] text-white font-medium'
                  : 'bg-white dark:bg-zinc-900 border-[#e5e9e6] dark:border-zinc-800 text-[#6b766f] dark:text-zinc-300'
              }`}
            >
              {pickText('আর্কাইভ', 'Archived')}
            </button>
          </div>

          {visibleUpdates.length === 0 ? (
            <div className="py-[36px] px-[16px] text-center text-[#6b766f]">
              {pickText('কোনো আপডেট পাওয়া যায়নি।', 'No updates match your search.')}
            </div>
          ) : (
            visibleUpdates.map((upd) => {
              const isExpanded = selectedUpdateId === upd.id;
              const highlights = language === 'en' ? upd.highlightsEn : upd.highlightsBn;
              return (
                <div
                  key={upd.id}
                  className="bg-white dark:bg-zinc-900 border border-[#e5e9e6] dark:border-zinc-800 rounded-[18px] p-[16px] mb-[10px]"
                >
                  <div className="flex justify-between items-center gap-[10px] mb-[10px]">
                    <div className="flex gap-[6px] flex-wrap">
                      <span className="text-[12.5px] px-[10px] py-[2px] rounded-[99px] bg-[#e3f1ea] text-[#0d6b45] font-medium">
                        {upd.version}
                      </span>
                      <span className="text-[12.5px] px-[10px] py-[2px] rounded-[99px] bg-[#eef2ef] dark:bg-zinc-800 text-[#6b766f] dark:text-zinc-300 font-medium">
                        {upd.type}
                      </span>
                    </div>
                    <span className="text-[12.5px] text-[#6b766f]">{upd.date}</span>
                  </div>

                  <h3 className="text-[16px] font-semibold leading-[1.35] mb-[6px] text-[#14201a] dark:text-white">
                    {pickText(upd.titleBn, upd.titleEn)}
                  </h3>
                  <p className="text-[14px] text-[#6b766f] leading-[1.5]">
                    {pickText(upd.summaryBn, upd.summaryEn)}
                  </p>

                  {isExpanded && highlights.length > 0 && (
                    <div className="mt-[12px] pt-[12px] border-t border-[#e5e9e6] dark:border-zinc-800 space-y-[6px]">
                      {highlights.map((h, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-[8px] text-[14px] text-[#6b766f]"
                        >
                          <span className="text-[#0d6b45] mt-[3px]">
                            <RefIcon name="check" className="w-[15px] h-[15px]" />
                          </span>
                          <span>{h}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex justify-between items-center mt-[14px] pt-[12px] border-t border-[#e5e9e6] dark:border-zinc-800">
                    <small className="text-[13px] text-[#6b766f]">
                      {highlights.length} {pickText('টি পরিবর্তন', 'release highlights')}
                    </small>

                    <div className="flex items-center gap-[8px]">
                      {isSuperAdmin && (
                        <button
                          type="button"
                          onClick={() => {
                            const next = updates.map((item) =>
                              item.id === upd.id
                                ? {
                                    ...item,
                                    status: (item.status === 'published'
                                      ? 'archived'
                                      : 'published') as HelpTutorialItem['status'],
                                  }
                                : item
                            );
                            setUpdates(next);
                            try {
                              localStorage.setItem(CUSTOM_UPDATES_KEY, JSON.stringify(next));
                            } catch {}
                          }}
                          className="h-[34px] px-[12px] rounded-[10px] bg-[#eef2ef] dark:bg-zinc-800 text-[#6b766f] dark:text-zinc-300 text-[13px] font-medium cursor-pointer"
                        >
                          {upd.status === 'published'
                            ? pickText('আর্কাইভ', 'Archive')
                            : pickText('পুনরুদ্ধার', 'Restore')}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setSelectedUpdateId(isExpanded ? null : upd.id)}
                        className="text-[13.5px] font-semibold text-[#0d6b45] flex items-center gap-[5px] cursor-pointer"
                      >
                        <span>
                          {isExpanded
                            ? pickText('সংক্ষিপ্ত করুন', 'Hide details')
                            : pickText('বিস্তারিত দেখুন', 'View details')}
                        </span>
                        <span
                          className={`transition-transform duration-200 ${
                            isExpanded ? 'rotate-180' : ''
                          }`}
                        >
                          <RefIcon name="down" className="w-[15px] h-[15px]" />
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* CATEGORY 6: CONTACT SUPPORT                                           */}
      {/* ===================================================================== */}
      {activeCategory === 'support' && (
        <div>
          <h2 className="text-[17px] font-semibold mt-[28px] mb-[12px] mx-[2px] flex justify-between items-baseline text-[#14201a] dark:text-white">
            <span>{pickText('আমাদের সাথে কথা বলুন', 'Talk to us')}</span>
            <span className="text-[13px] font-normal text-[#6b766f]">
              {pickText('কয়েক মিনিটেই উত্তর', 'Replies within minutes')}
            </span>
          </h2>

          {/* Verified Contact Channels (.list & .row) */}
          <div className="bg-white dark:bg-zinc-900 border border-[#e5e9e6] dark:border-zinc-800 rounded-[18px] mb-[14px] overflow-hidden">
            <div className="flex items-center gap-[14px] py-[14px] px-[16px] w-full text-left">
              <div className="w-[36px] h-[36px] rounded-[11px] bg-[#e3f1ea] text-[#0d6b45] grid place-items-center shrink-0">
                <RefIcon name="chat" className="w-[20px] h-[20px]" />
              </div>
              <div className="flex-1 min-w-0">
                <b className="block font-semibold leading-[1.3] text-[#14201a] dark:text-white">
                  {pickText('লাইভ সাপোর্ট ও স্টোর ডেস্ক', 'Live chat & store desk')}
                </b>
                <small className="text-[13px] text-[#6b766f] block truncate">
                  {currentTenant.name} · {pickText('সার্বক্ষণিক ২৪/৭ সচল', 'Available 24/7')}
                </small>
              </div>
              <span className="text-[#6b766f]">
                <RefIcon name="right" className="w-[16px] h-[16px]" />
              </span>
            </div>

            <div className="flex items-center gap-[14px] py-[14px] px-[16px] w-full text-left border-t border-[#e5e9e6] dark:border-zinc-800">
              <div className="w-[36px] h-[36px] rounded-[11px] bg-[#e3f1ea] text-[#0d6b45] grid place-items-center shrink-0">
                <RefIcon name="phone" className="w-[20px] h-[20px]" />
              </div>
              <div className="flex-1 min-w-0">
                <b className="block font-semibold leading-[1.3] text-[#14201a] dark:text-white">
                  {pickText('কল সাপোর্ট', 'Call support')}
                </b>
                <small className="text-[13px] text-[#6b766f] block truncate">
                  {currentTenant.ownerPhone || '01711-223399'} · 09:00 – 22:00
                </small>
              </div>
              <span className="text-[#6b766f]">
                <RefIcon name="right" className="w-[16px] h-[16px]" />
              </span>
            </div>

            <div className="flex items-center gap-[14px] py-[14px] px-[16px] w-full text-left border-t border-[#e5e9e6] dark:border-zinc-800">
              <div className="w-[36px] h-[36px] rounded-[11px] bg-[#e3f1ea] text-[#0d6b45] grid place-items-center shrink-0">
                <RefIcon name="mail" className="w-[20px] h-[20px]" />
              </div>
              <div className="flex-1 min-w-0">
                <b className="block font-semibold leading-[1.3] text-[#14201a] dark:text-white">
                  {pickText('ইমেইল', 'Email')}
                </b>
                <small className="text-[13px] text-[#6b766f] block truncate">
                  {currentTenant.ownerEmail ||
                    currentTenant.email ||
                    pickText('একদিনের মধ্যে উত্তর', 'Reply within one day')}
                </small>
              </div>
              <span className="text-[#6b766f]">
                <RefIcon name="right" className="w-[16px] h-[16px]" />
              </span>
            </div>
          </div>

          {/* Support Ticket Form Card (.card) */}
          <div className="bg-white dark:bg-zinc-900 border border-[#e5e9e6] dark:border-zinc-800 rounded-[18px] p-[16px] mb-[10px]">
            <div className="flex justify-between items-center gap-[10px] mb-[10px]">
              <span className="text-[12.5px] px-[10px] py-[2px] rounded-[99px] bg-[#e3f1ea] text-[#0d6b45] font-medium">
                {pickText('সাপোর্ট টিকেট', 'Support ticket')}
              </span>
              <span className="text-[12.5px] text-[#6b766f]">
                {isClothing
                  ? pickText('ক্লোথিং স্টোর', 'Clothing')
                  : pickText('স্পোর্টসওয়্যার স্টোর', 'Sportswear')}
              </span>
            </div>

            <h3 className="text-[16px] font-semibold leading-[1.35] mb-[6px] text-[#14201a] dark:text-white">
              {pickText('আপনার সমস্যা বা প্রশ্ন লিখে পাঠান', 'Submit a support request')}
            </h3>

            {ticketError && (
              <div className="p-[12px] rounded-[12px] bg-[#eef2ef] dark:bg-zinc-800 text-[#14201a] dark:text-white text-[13.5px] font-medium mb-[10px]">
                {ticketError}
              </div>
            )}

            <form onSubmit={handleSubmitSupportTicket} className="space-y-[10px] mt-[10px]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-[10px]">
                <input
                  type="text"
                  required
                  value={reporterName}
                  onChange={(e) => setReporterName(e.target.value)}
                  placeholder={pickText('আপনার নাম *', 'Your name *')}
                  className="w-full h-[48px] rounded-[14px] border border-[#e5e9e6] dark:border-zinc-800 bg-white dark:bg-zinc-900 px-[14px] text-[15px] text-[#14201a] dark:text-white placeholder-[#6b766f] outline-none focus:border-[#0d6b45]"
                />
                <input
                  type="text"
                  required
                  value={reporterContact}
                  onChange={(e) => setReporterContact(e.target.value)}
                  placeholder={pickText('মোবাইল বা ইমেইল *', 'Phone or email *')}
                  className="w-full h-[48px] rounded-[14px] border border-[#e5e9e6] dark:border-zinc-800 bg-white dark:bg-zinc-900 px-[14px] text-[15px] text-[#14201a] dark:text-white placeholder-[#6b766f] outline-none focus:border-[#0d6b45]"
                />
              </div>

              <select
                value={ticketCategory}
                onChange={(e) => setTicketCategory(e.target.value as any)}
                className="w-full h-[48px] rounded-[14px] border border-[#e5e9e6] dark:border-zinc-800 bg-white dark:bg-zinc-900 px-[14px] text-[14.5px] text-[#14201a] dark:text-white outline-none focus:border-[#0d6b45]"
              >
                <option value="pos_issue">
                  {pickText('পিওএস কাউন্টার ও রিসিট প্রিন্ট', 'POS Counter & Receipt Printing')}
                </option>
                <option value="inventory">
                  {pickText('পণ্য, ভ্যারিয়েন্ট ও স্টক', 'Products, Variants & Stock')}
                </option>
                <option value="billing_trx">
                  {pickText('সাবস্ক্রিপশন ও TrxID যাচাই', 'Subscription & TrxID Verification')}
                </option>
                <option value="account_access">
                  {pickText('লগইন, ওটিপি ও স্টাফ পিন', 'Login, OTP & Staff PIN')}
                </option>
                <option value="feature_request">
                  {pickText('নতুন ফিচার অনুরোধ / মতামত', 'Feature Request / Feedback')}
                </option>
                <option value="other">{pickText('অন্যান্য প্রশ্ন', 'Other Question')}</option>
              </select>

              <input
                type="text"
                required
                value={ticketSubject}
                onChange={(e) => setTicketSubject(e.target.value)}
                placeholder={pickText('সংক্ষিপ্ত বিষয় (Subject) *', 'Subject *')}
                className="w-full h-[48px] rounded-[14px] border border-[#e5e9e6] dark:border-zinc-800 bg-white dark:bg-zinc-900 px-[14px] text-[15px] text-[#14201a] dark:text-white placeholder-[#6b766f] outline-none focus:border-[#0d6b45]"
              />

              <textarea
                rows={3}
                required
                value={ticketMessage}
                onChange={(e) => setTicketMessage(e.target.value)}
                placeholder={pickText(
                  'আপনার সমস্যাটি কমপক্ষে ১০ অক্ষরে বিস্তারিত লিখুন...',
                  'Describe your issue in detail (at least 10 characters)...'
                )}
                className="w-full rounded-[14px] border border-[#e5e9e6] dark:border-zinc-800 bg-white dark:bg-zinc-900 p-[14px] text-[15px] text-[#14201a] dark:text-white placeholder-[#6b766f] outline-none focus:border-[#0d6b45] resize-none"
              />

              <div className="flex justify-between items-center pt-[12px] border-t border-[#e5e9e6] dark:border-zinc-800">
                <small className="text-[13px] text-[#6b766f]">
                  {pickText('সরাসরি সাপোর্ট ডেস্কে যুক্ত হবে', 'Logged to support desk')}
                </small>
                <button
                  type="submit"
                  className="h-[38px] px-[16px] rounded-[12px] bg-[#0d6b45] text-white font-semibold text-[14px] flex items-center gap-[7px] cursor-pointer hover:opacity-95 transition"
                >
                  <RefIcon name="send" className="w-[16px] h-[16px]" />
                  <span>{pickText('টিকেট জমা দিন', 'Submit ticket')}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Submitted Support Tickets List (.list) */}
          {shopTickets.length > 0 && (
            <>
              <h2 className="text-[17px] font-semibold mt-[24px] mb-[12px] mx-[2px] flex justify-between items-baseline text-[#14201a] dark:text-white">
                <span>{pickText('জমা দেওয়া টিকেটসমূহ', 'Submitted tickets')}</span>
                <span className="text-[13px] font-normal text-[#6b766f]">
                  {shopTickets.length}
                </span>
              </h2>
              <div className="bg-white dark:bg-zinc-900 border border-[#e5e9e6] dark:border-zinc-800 rounded-[18px] overflow-hidden">
                {shopTickets.map((tkt, idx) => (
                  <div
                    key={tkt.id}
                    className={`flex items-center gap-[14px] py-[14px] px-[16px] w-full text-left ${
                      idx > 0 ? 'border-t border-[#e5e9e6] dark:border-zinc-800' : ''
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <b className="block font-semibold leading-[1.3] text-[#14201a] dark:text-white truncate">
                        {tkt.id} · {tkt.subject}
                      </b>
                      <small className="text-[13px] text-[#6b766f] block truncate">
                        {tkt.message}
                      </small>
                    </div>
                    <span className="text-[12.5px] px-[10px] py-[2px] rounded-[99px] bg-[#e3f1ea] text-[#0d6b45] font-medium shrink-0">
                      {tkt.status}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: TUTORIAL STEP-BY-STEP GUIDE & VIDEO PLAYER                     */}
      {/* ===================================================================== */}
      {activeTutorialModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-zinc-900 border border-[#e5e9e6] dark:border-zinc-800 rounded-[20px] max-w-[520px] w-full p-[20px] space-y-[14px] text-[#14201a] dark:text-white">
            <div className="flex items-start justify-between gap-3 pb-[12px] border-b border-[#e5e9e6] dark:border-zinc-800">
              <div>
                <span className="text-[12.5px] px-[10px] py-[2px] rounded-[99px] bg-[#e3f1ea] text-[#0d6b45] font-medium inline-flex items-center gap-[5px]">
                  <RefIcon name="clock" className="w-[14px] h-[14px]" />
                  <span>{activeTutorialModal.duration}</span>
                </span>
                <h3 className="text-[17px] font-semibold leading-[1.35] mt-[8px]">
                  {pickText(activeTutorialModal.titleBn, activeTutorialModal.titleEn)}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveTutorialModal(null)}
                className="w-[34px] h-[34px] rounded-[99px] bg-[#eef2ef] dark:bg-zinc-800 text-[#6b766f] grid place-items-center cursor-pointer"
              >
                <RefIcon name="x" className="w-[16px] h-[16px]" />
              </button>
            </div>

            {activeTutorialModal.videoUrl ? (
              <div className="p-[14px] rounded-[16px] bg-[#e3f1ea] text-[#0d6b45] flex items-center justify-between gap-3">
                <div className="flex items-center gap-[8px] min-w-0">
                  <RefIcon name="play" className="w-[18px] h-[18px]" />
                  <span className="text-[14px] font-semibold truncate">
                    {activeTutorialModal.videoUrl}
                  </span>
                </div>
                <a
                  href={activeTutorialModal.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-[34px] px-[14px] rounded-[10px] bg-[#0d6b45] text-white text-[13.5px] font-semibold inline-flex items-center shrink-0"
                >
                  {pickText('ভিডিও দেখুন', 'Watch')}
                </a>
              </div>
            ) : (
              <div className="p-[14px] rounded-[16px] bg-[#eef2ef] dark:bg-zinc-800 text-[#6b766f] dark:text-zinc-300 flex items-center gap-[10px] text-[13.5px]">
                <RefIcon name="vid" className="w-[18px] h-[18px] text-[#0d6b45]" />
                <span>
                  {pickText(
                    'ধাপে ধাপে কাজের নির্দেশিকা নিচে দেওয়া হলো।',
                    'Follow the step-by-step guide below.'
                  )}
                </span>
              </div>
            )}

            <div className="space-y-[8px]">
              {(language === 'en' ? activeTutorialModal.stepsEn : activeTutorialModal.stepsBn).map(
                (step, idx) => (
                  <div
                    key={idx}
                    className="p-[14px] rounded-[16px] bg-[#f6f7f6] dark:bg-zinc-950 border border-[#e5e9e6] dark:border-zinc-800 flex items-start gap-[12px]"
                  >
                    <span className="w-[24px] h-[24px] rounded-[99px] bg-[#0d6b45] text-white text-[12.5px] font-semibold grid place-items-center shrink-0 mt-[1px]">
                      {idx + 1}
                    </span>
                    <span className="text-[14px] text-[#14201a] dark:text-zinc-200 leading-[1.5]">
                      {step}
                    </span>
                  </div>
                )
              )}
            </div>

            <div className="pt-[8px] flex justify-end">
              <button
                type="button"
                onClick={() => setActiveTutorialModal(null)}
                className="h-[38px] px-[18px] rounded-[12px] bg-[#0d6b45] text-white font-semibold text-[14px] cursor-pointer"
              >
                {pickText('বন্ধ করুন', 'Close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: SUPER ADMIN ADD TUTORIAL / VIDEO                               */}
      {/* ===================================================================== */}
      {isSuperAdmin && isAdminModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-[#e5e9e6] dark:border-zinc-800 rounded-[20px] max-w-[460px] w-full p-[20px] space-y-[14px]">
            <div className="flex items-center justify-between pb-[10px] border-b border-[#e5e9e6] dark:border-zinc-800">
              <h3 className="text-[16px] font-semibold text-[#14201a] dark:text-white">
                {pickText('নতুন গাইড যোগ করুন (Admin)', 'Add help tutorial (Admin)')}
              </h3>
              <button
                type="button"
                onClick={() => setIsAdminModalOpen(false)}
                className="text-[#6b766f] cursor-pointer"
              >
                <RefIcon name="x" className="w-[18px] h-[18px]" />
              </button>
            </div>

            <form onSubmit={handleSaveAdminTutorial} className="space-y-[10px]">
              <input
                type="text"
                required
                value={adminTutTitleBn}
                onChange={(e) => setAdminTutTitleBn(e.target.value)}
                placeholder={pickText('শিরোনাম (বাংলা) *', 'Title (Bangla) *')}
                className="w-full h-[46px] rounded-[14px] border border-[#e5e9e6] dark:border-zinc-800 bg-white dark:bg-zinc-900 px-[14px] text-[14.5px] outline-none focus:border-[#0d6b45]"
              />
              <input
                type="text"
                value={adminTutTitleEn}
                onChange={(e) => setAdminTutTitleEn(e.target.value)}
                placeholder={pickText('শিরোনাম (ইংরেজি)', 'Title (English)')}
                className="w-full h-[46px] rounded-[14px] border border-[#e5e9e6] dark:border-zinc-800 bg-white dark:bg-zinc-900 px-[14px] text-[14.5px] outline-none focus:border-[#0d6b45]"
              />
              <div className="grid grid-cols-2 gap-[10px]">
                <select
                  value={adminTutSubcat}
                  onChange={(e) => setAdminTutSubcat(e.target.value as TutorialSubcategoryId)}
                  className="w-full h-[46px] rounded-[14px] border border-[#e5e9e6] dark:border-zinc-800 bg-white dark:bg-zinc-900 px-[12px] text-[14px] outline-none focus:border-[#0d6b45]"
                >
                  {TUTORIAL_SUBCATEGORIES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {pickText(s.labelBn, s.labelEn)}
                    </option>
                  ))}
                </select>
                <select
                  value={adminTutScope}
                  onChange={(e) => setAdminTutScope(e.target.value as any)}
                  className="w-full h-[46px] rounded-[14px] border border-[#e5e9e6] dark:border-zinc-800 bg-white dark:bg-zinc-900 px-[12px] text-[14px] outline-none focus:border-[#0d6b45]"
                >
                  <option value="ALL">{pickText('সব দোকান', 'All shops')}</option>
                  <option value="CLOTHING">{pickText('ক্লোথিং', 'Clothing')}</option>
                  <option value="SPORTSWEAR">{pickText('স্পোর্টসওয়্যার', 'Sportswear')}</option>
                </select>
              </div>
              <input
                type="url"
                value={adminTutVideoUrl}
                onChange={(e) => setAdminTutVideoUrl(e.target.value)}
                placeholder="https://..."
                className="w-full h-[46px] rounded-[14px] border border-[#e5e9e6] dark:border-zinc-800 bg-white dark:bg-zinc-900 px-[14px] text-[14.5px] outline-none focus:border-[#0d6b45]"
              />
              <textarea
                rows={3}
                required
                value={adminTutSummaryBn}
                onChange={(e) => setAdminTutSummaryBn(e.target.value)}
                placeholder={pickText('সংক্ষিপ্ত বিবরণ ও ধাপসমূহ *', 'Summary & guide steps *')}
                className="w-full rounded-[14px] border border-[#e5e9e6] dark:border-zinc-800 bg-white dark:bg-zinc-900 p-[14px] text-[14.5px] outline-none focus:border-[#0d6b45]"
              />
              <div className="flex justify-end gap-[8px] pt-[8px]">
                <button
                  type="button"
                  onClick={() => setIsAdminModalOpen(false)}
                  className="h-[38px] px-[16px] rounded-[12px] bg-[#eef2ef] dark:bg-zinc-800 text-[#6b766f] font-semibold text-[14px] cursor-pointer"
                >
                  {pickText('বাতিল', 'Cancel')}
                </button>
                <button
                  type="submit"
                  className="h-[38px] px-[16px] rounded-[12px] bg-[#0d6b45] text-white font-semibold text-[14px] cursor-pointer"
                >
                  {pickText('প্রকাশ করুন', 'Publish')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
