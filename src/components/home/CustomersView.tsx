import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { dbService } from '../../services/db';
import { CampaignTemplate } from '../../types';
import {
  normalizeBdPhone,
  renderCampaignTemplate,
  buildIndividualWhatsAppCampaignUrl,
  buildIndividualSmsUrl,
} from '../../utils/inventoryLoyaltyReportsEngine';
import { CustomerProfileFullView } from './CustomerProfileFullView';
import { BottomSheet } from '../ui/BottomSheet';
import { InfoTooltip } from '../ui/InfoTooltip';
import {
  Users,
  Search,
  ShoppingBag,
  MessageSquare,
  ArrowLeft,
  Copy,
  Check,
  Download,
  Printer,
  ChevronRight,
  Award,
  Sparkles,
  Plus,
  Save,
  BellOff,
  Smartphone,
  Clock,
} from 'lucide-react';

interface CustomersViewProps {
  onNavigateToPOS?: () => void;
  onBack?: () => void;
  initialSubTab?: 'directory' | 'festive';
}

export interface CustomerSummary {
  name: string;
  phone: string;
  normalizedPhone: string;
  totalOrders: number;
  totalSpent: number;
  totalDue: number;
  loyaltyPoints: number;
  doNotContact: boolean;
  lastOrderDate: string;
  latestInvoiceNo: string;
  partyType: 'Retail' | 'Reseller';
}

const CopyPhoneButton: React.FC<{ phone: string; className?: string }> = ({ phone, className = '' }) => {
  const [copied, setCopied] = useState(false);
  const { showToast, pickText } = useApp();

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!phone) return;
    navigator.clipboard.writeText(phone);
    setCopied(true);
    showToast(pickText(`ফোন নম্বর কপি করা হয়েছে: ${phone}`, `Phone number copied: ${phone}`), 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  if (!phone) return null;

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={pickText('ফোন নম্বর কপি করুন', 'Copy Phone')}
      className={`p-1 rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-zinc-100 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer active:scale-95 inline-flex items-center gap-1 shrink-0 ${className}`}
    >
      {copied ? (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
          <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span className="hidden sm:inline">{pickText('কপি হয়েছে', 'Copied')}</span>
        </span>
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
    </button>
  );
};

export const CustomersView: React.FC<CustomersViewProps> = ({
  onNavigateToPOS,
  onBack,
  initialSubTab = 'directory',
}) => {
  const { currentTenant, activeStaff, showToast, pickText } = useApp();
  const [activeSubTab, setActiveSubTab] = useState<'directory' | 'festive'>(initialSubTab);

  useEffect(() => {
    if (initialSubTab) {
      setActiveSubTab(initialSubTab);
    }
  }, [initialSubTab]);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'yesterday' | 'last7' | 'this_month' | 'custom'>('all');
  const [partyFilter, setPartyFilter] = useState<'all' | 'Retail' | 'Reseller'>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [visibleLimit, setVisibleLimit] = useState(50);
  const [refreshTick, setRefreshTick] = useState(0);

  // Selected customer for full-screen view
  const [selectedCustomerPhone, setSelectedCustomerPhone] = useState<string | null>(null);
  const [quickDetailCustomer, setQuickDetailCustomer] = useState<CustomerSummary | null>(null);

  // Phase 6 — Festive Offers & Individual WhatsApp Messaging State
  const [templates, setTemplates] = useState<CampaignTemplate[]>(() =>
    dbService.getCampaignTemplates(currentTenant.id)
  );
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [customMessageBody, setCustomMessageBody] = useState<string>('');
  const [newTemplateTitle, setNewTemplateTitle] = useState('');
  const [newTemplateCategory, setNewTemplateCategory] = useState<CampaignTemplate['occasion']>('eid');
  const [isAddingTemplate, setIsAddingTemplate] = useState(false);
  const [campaignFilter, setCampaignFilter] = useState<'all' | 'repeat' | 'inactive' | 'due' | 'opt_out'>('all');
  const [previewCustomerName, setPreviewCustomerName] = useState('');
  const [campaignLogs, setCampaignLogs] = useState(() =>
    dbService.getCampaignLogs(currentTenant.id)
  );

  useEffect(() => {
    const loaded = dbService.getCampaignTemplates(currentTenant.id);
    setTemplates(loaded);
    if (loaded.length > 0) {
      setSelectedTemplateId(loaded[0].id);
      setCustomMessageBody(loaded[0].messageBody);
    }
    setCampaignLogs(dbService.getCampaignLogs(currentTenant.id));
  }, [currentTenant.id, refreshTick]);

  const rawInvoices = useMemo(() => {
    return dbService.getInvoices(currentTenant.id).filter(
      (inv) => !inv.isSoftDeleted && inv.shopId === currentTenant.id
    );
  }, [currentTenant.id, refreshTick]);

  const shopProfiles = useMemo(() => {
    return dbService.getCustomerProfiles(currentTenant.id);
  }, [currentTenant.id, refreshTick]);

  // Filter invoices by selected date range and party type
  const filteredInvoicesByDate = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    const monthStart = today.slice(0, 7);

    return rawInvoices.filter((inv) => {
      const invDate = inv.createdAt.split('T')[0];

      if (dateFilter === 'today' && invDate !== today) return false;
      if (dateFilter === 'yesterday' && invDate !== yesterday) return false;
      if (dateFilter === 'last7' && invDate < sevenDaysAgo) return false;
      if (dateFilter === 'this_month' && !invDate.startsWith(monthStart)) return false;
      if (dateFilter === 'custom') {
        if (customStartDate && invDate < customStartDate) return false;
        if (customEndDate && invDate > customEndDate) return false;
      }

      if (partyFilter !== 'all' && (inv.partyType || 'Retail') !== partyFilter) return false;

      return true;
    });
  }, [rawInvoices, dateFilter, partyFilter, customStartDate, customEndDate]);

  // Aggregate customer summary strictly isolated to currentTenant.id
  const customerList = useMemo(() => {
    const map = new Map<string, CustomerSummary>();
    const profileMap = new Map<string, { loyaltyPoints: number; doNotContact: boolean; name: string }>();

    shopProfiles.forEach((p) => {
      const normP = normalizeBdPhone(p.phone);
      if (p.shopId === currentTenant.id && normP) {
        profileMap.set(normP, {
          loyaltyPoints: p.loyaltyPoints || 0,
          doNotContact: Boolean(p.doNotContact),
          name: p.name,
        });
      }
    });

    filteredInvoicesByDate.forEach((inv) => {
      if (inv.status === 'returned') return;
      const phone = (inv.customerPhone || '').trim();
      const normPhone = normalizeBdPhone(phone);
      const name = (inv.customerName || 'Walk-in Customer').trim();
      const key = normPhone || phone || name;
      const prof = normPhone ? profileMap.get(normPhone) : undefined;

      if (!map.has(key)) {
        map.set(key, {
          name: prof?.name || name,
          phone,
          normalizedPhone: normPhone,
          totalOrders: 0,
          totalSpent: 0,
          totalDue: 0,
          loyaltyPoints: prof?.loyaltyPoints || 0,
          doNotContact: Boolean(prof?.doNotContact),
          lastOrderDate: inv.createdAt,
          latestInvoiceNo: inv.invoiceNo,
          partyType: (inv.partyType as 'Retail' | 'Reseller') || 'Retail',
        });
      }

      const existing = map.get(key)!;
      existing.totalOrders += 1;
      existing.totalSpent += Number(inv.total) || 0;
      existing.totalDue += Number(inv.dueAmount) || 0;

      if (new Date(inv.createdAt) > new Date(existing.lastOrderDate)) {
        existing.lastOrderDate = inv.createdAt;
        existing.latestInvoiceNo = inv.invoiceNo;
        if (name && name !== 'Walk-in Customer') existing.name = name;
      }
    });

    return Array.from(map.values()).sort((a, b) => b.totalSpent - a.totalSpent);
  }, [filteredInvoicesByDate, shopProfiles, currentTenant.id]);

  // Search filtered customer directory
  const displayedCustomers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const normQ = normalizeBdPhone(q);
    let list = customerList;
    if (q) {
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.phone.includes(q) ||
          (normQ && c.normalizedPhone.includes(normQ))
      );
    }
    return list;
  }, [customerList, searchQuery]);

  // Campaign filtered customers (Phase 6)
  const campaignCustomers = useMemo(() => {
    const thirtyDaysAgoMs = Date.now() - 30 * 86400000;
    return displayedCustomers.filter((c) => {
      if (!c.phone) return false;
      if (campaignFilter === 'repeat') return c.totalOrders >= 2 && !c.doNotContact;
      if (campaignFilter === 'inactive') {
        const lastMs = new Date(c.lastOrderDate).getTime();
        return !isNaN(lastMs) && lastMs < thirtyDaysAgoMs && !c.doNotContact;
      }
      if (campaignFilter === 'due') return c.totalDue > 0 && !c.doNotContact;
      if (campaignFilter === 'opt_out') return c.doNotContact;
      return true;
    });
  }, [displayedCustomers, campaignFilter]);

  // Overall statistics
  const totalCustomerCount = customerList.length;
  const totalOrdersCount = customerList.reduce((sum, c) => sum + c.totalOrders, 0);
  const totalRevenue = customerList.reduce((sum, c) => sum + c.totalSpent, 0);
  const totalDuePending = customerList.reduce((sum, c) => sum + c.totalDue, 0);
  const totalActiveLoyaltyPoints = customerList.reduce((sum, c) => sum + c.loyaltyPoints, 0);

  const effectivePreviewCustomerName = previewCustomerName || pickText('তানভীর আহমেদ', 'Tanvir Ahmed');

  const handleWhatsApp = (phone: string, name: string) => {
    const url = buildIndividualWhatsAppCampaignUrl(
      phone,
      pickText(
        `আসসালামু আলাইকুম ${name} ভাই, ${currentTenant.name} থেকে যোগাযোগ করা হচ্ছে।`,
        `Hello ${name}, contacting you from ${currentTenant.name}.`
      )
    );
    if (url) {
      window.open(url, '_blank');
    }
  };

  // Phase 6 — Individual Festive WhatsApp Preview Open (Strictly NO bulk sending!)
  const handleOpenFestiveWhatsAppIndividual = (cust: CustomerSummary) => {
    if (cust.doNotContact) {
      showToast(
        pickText(
          'এই কাস্টমারের জন্য অফার মেসেজ বন্ধ (Do-Not-Contact) করা আছে।',
          'Promotional messages are disabled (Do-Not-Contact) for this customer.'
        ),
        'warning'
      );
      return;
    }
    const rendered = renderCampaignTemplate(customMessageBody, {
      customerName: cust.name,
      shopName: currentTenant.name,
    });
    const url = buildIndividualWhatsAppCampaignUrl(cust.phone, rendered);
    if (!url) {
      showToast(pickText('সঠিক মোবাইল নম্বর পাওয়া যায়নি', 'Valid mobile number not found'), 'error');
      return;
    }
    dbService.logIndividualCampaignOpen({
      shopId: currentTenant.id,
      customerPhone: cust.phone,
      customerName: cust.name,
      templateId: selectedTemplateId || 'custom_tpl',
      channel: 'whatsapp',
      openedBy: activeStaff?.name || currentTenant.ownerName || 'Shop Operator',
    });
    setCampaignLogs(dbService.getCampaignLogs(currentTenant.id));
    window.open(url, '_blank');
    showToast(
      pickText(
        `${cust.name}-এর জন্য ব্যক্তিগত WhatsApp মেসেজ প্রিভিউ ওপেন হয়েছে (Status: opened_whatsapp_preview)`,
        `Individual WhatsApp message preview opened for ${cust.name} (Status: opened_whatsapp_preview)`
      ),
      'info'
    );
  };

  const handleOpenFestiveSmsIndividual = (cust: CustomerSummary) => {
    if (cust.doNotContact) {
      showToast(
        pickText(
          'এই কাস্টমারের জন্য অফার মেসেজ বন্ধ (Do-Not-Contact) করা আছে।',
          'Promotional messages are disabled (Do-Not-Contact) for this customer.'
        ),
        'warning'
      );
      return;
    }
    const rendered = renderCampaignTemplate(customMessageBody, {
      customerName: cust.name,
      shopName: currentTenant.name,
    });
    const smsUrl = buildIndividualSmsUrl(cust.phone, rendered);
    if (!smsUrl) {
      showToast(pickText('সঠিক মোবাইল নম্বর পাওয়া যায়নি', 'Valid mobile number not found'), 'error');
      return;
    }
    dbService.logIndividualCampaignOpen({
      shopId: currentTenant.id,
      customerPhone: cust.phone,
      customerName: cust.name,
      templateId: selectedTemplateId || 'custom_sms_tpl',
      channel: 'sms',
      openedBy: activeStaff?.name || currentTenant.ownerName || 'Shop Operator',
    });
    setCampaignLogs(dbService.getCampaignLogs(currentTenant.id));
    window.open(smsUrl, '_self');
  };

  const handleSaveCustomTemplate = () => {
    if (!newTemplateTitle.trim() || !customMessageBody.trim()) {
      showToast(
        pickText('টেমপ্লেটের নাম এবং মেসেজ বডি লিখুন', 'Please enter template title and message body'),
        'error'
      );
      return;
    }
    const newTpl: CampaignTemplate = {
      id: `tpl_${Date.now()}`,
      shopId: currentTenant.id,
      title: newTemplateTitle.trim(),
      titleBn: newTemplateTitle.trim(),
      occasion: newTemplateCategory,
      messageBody: customMessageBody.trim(),
      isDefault: false,
      updatedAt: new Date().toISOString(),
    };
    const nextList = [newTpl, ...templates];
    dbService.saveCampaignTemplates(currentTenant.id, nextList);
    setTemplates(nextList);
    setSelectedTemplateId(newTpl.id);
    setNewTemplateTitle('');
    setIsAddingTemplate(false);
    showToast(
      pickText('নতুন উৎসবের অফার টেমপ্লেট সেভ করা হয়েছে!', 'New festive offer template saved!'),
      'success'
    );
  };

  // Export Customer Directory Data to CSV (with UTF-8 BOM for Excel)
  const handleExportCSV = () => {
    if (displayedCustomers.length === 0) {
      showToast(
        pickText('ডাউনলোড করার মতো কোনো কাস্টমার ডেটা পাওয়া যায়নি', 'No customer data available to download'),
        'warning'
      );
      return;
    }

    const headers = [
      'Sl',
      'Customer Name',
      'Mobile Phone',
      'Party Type',
      'Total Orders',
      'Total Purchases (BDT)',
      'Total Due (BDT)',
      'Loyalty Points',
      'Payment Status',
      'Last Purchase Date',
      'Latest Invoice No',
    ];

    const rows = displayedCustomers.map((c, idx) => [
      idx + 1,
      `"${c.name.replace(/"/g, '""')}"`,
      `"${c.phone}"`,
      c.partyType,
      c.totalOrders,
      c.totalSpent,
      c.totalDue,
      c.loyaltyPoints,
      c.totalDue > 0 ? 'Due Pending' : 'Paid',
      `"${c.lastOrderDate ? new Date(c.lastOrderDate).toLocaleDateString() : ''}"`,
      `"${c.latestInvoiceNo || ''}"`,
    ]);

    const csvContent =
      '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const filterTag = dateFilter === 'custom' ? `${customStartDate}_to_${customEndDate}` : dateFilter;
    link.setAttribute('download', `customers_directory_${filterTag}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(
      pickText(
        `মোট ${displayedCustomers.length} জন কাস্টমারের ডেটা CSV ফাইলে ডাউনলোড হয়েছে`,
        `Downloaded CSV data for ${displayedCustomers.length} customers`
      ),
      'success'
    );
  };

  const handlePrintDirectoryPDF = () => {
    window.print();
  };

  // Render Full-Screen Customer Profile View if a customer is selected
  if (selectedCustomerPhone) {
    return (
      <CustomerProfileFullView
        customerPhone={selectedCustomerPhone}
        onBack={() => {
          setSelectedCustomerPhone(null);
          setRefreshTick((t) => t + 1);
        }}
        onNavigateToPOS={onNavigateToPOS}
      />
    );
  }

  return (
    <div className="space-y-4 max-w-6xl mx-auto pb-24 lg:pb-8 animate-in fade-in duration-150">
      {/* Mode Switcher Tabs: Customer Directory vs Festive Offers & Individual WhatsApp */}
      <div className="flex flex-wrap items-center gap-2 bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-2xl p-1.5 shadow-2xs">
        <button
          type="button"
          onClick={() => setActiveSubTab('directory')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
            activeSubTab === 'directory'
              ? 'bg-[#164e3f] text-white shadow-xs'
              : 'bg-[#f4f7f5] dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>{pickText('কাস্টমার তালিকা', 'Customer Directory')}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('festive')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
            activeSubTab === 'festive'
              ? 'bg-[#164e3f] text-white shadow-xs'
              : 'bg-[#f4f7f5] dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-200'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>{pickText('উৎসবের অফার', 'Festive Offers')}</span>
        </button>
      </div>

      {/* Top Aggregate Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-0">
        <div className="border border-slate-200/90 dark:border-zinc-800 p-3.5 -mr-px -mb-px">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 uppercase block">
            {pickText('মোট কাস্টমার', 'Total Customers')}
          </span>
          <div className="text-lg sm:text-xl font-black text-slate-900 dark:text-white mt-0.5">
            {totalCustomerCount}
          </div>
        </div>

        <div className="border border-slate-200/90 dark:border-zinc-800 p-3.5 -mr-px -mb-px">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 uppercase block">
            {pickText('মোট বিক্রয় পরিমাণ', 'Total Sales Volume')}
          </span>
          <div className="text-lg sm:text-xl font-black text-[#1f8a5b] dark:text-emerald-400 mt-0.5">
            ৳{totalRevenue.toLocaleString()}
          </div>
        </div>

        <div className="border border-slate-200/90 dark:border-zinc-800 p-3.5 -mr-px -mb-px">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 uppercase block">
            {pickText('গড় ক্রয় / কাস্টমার', 'Avg Spend / Customer')}
          </span>
          <div className="text-lg sm:text-xl font-black text-blue-600 dark:text-blue-400 mt-0.5">
            ৳{totalCustomerCount > 0 ? Math.round(totalRevenue / totalCustomerCount).toLocaleString() : 0}
          </div>
        </div>

        <div className="border border-slate-200/90 dark:border-zinc-800 p-3.5 -mr-px -mb-px">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 uppercase block">
            {pickText('মোট বকেয়া', 'Outstanding Due')}
          </span>
          <div className="text-lg sm:text-xl font-black text-rose-600 dark:text-rose-400 mt-0.5">
            ৳{totalDuePending.toLocaleString()}
          </div>
        </div>

        <div className="bg-[#e6f4ea]/60 dark:bg-emerald-950/30 border border-slate-200/90 dark:border-zinc-800 p-3.5 col-span-2 lg:col-span-1 -mr-px -mb-px">
          <span className="text-[11px] font-bold text-[#164e3f] dark:text-emerald-300 uppercase flex items-center gap-1">
            <Award className="w-3.5 h-3.5" />
            <span>{pickText('সক্রিয় লয়্যালটি পয়েন্ট', 'Active Loyalty Points')}</span>
          </span>
          <div className="text-lg sm:text-xl font-black text-[#164e3f] dark:text-emerald-400 font-mono mt-0.5">
            {totalActiveLoyaltyPoints} pts
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 2: FESTIVE OFFERS & INDIVIDUAL WHATSAPP MESSAGING (PHASE 6)           */}
      {/* ========================================================================= */}
      {activeSubTab === 'festive' && (
        <div className="space-y-4">
          {/* Template Composer & Live Preview Card */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-3xl p-4 sm:p-5 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                  {pickText('উৎসবের অফার টেমপ্লেট', 'Festive Offer Templates')}
                </h2>
                <InfoTooltip
                  text={pickText(
                    'প্রতিটি কাস্টমারের জন্য আলাদাভাবে WhatsApp বা SMS প্রিভিউ ওপেন হবে; কখনোই স্বয়ংক্রিয়ভাবে বাল্ক মেসেজ পাঠানো হয় না।',
                    'Opens an individual WhatsApp or SMS preview per customer; messages are never bulk-sent automatically.'
                  )}
                />
              </div>

              <button
                type="button"
                onClick={() => setIsAddingTemplate(!isAddingTemplate)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#f4f7f5] dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs font-bold text-[#164e3f] dark:text-emerald-400 hover:bg-emerald-50 transition cursor-pointer self-start sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{pickText('নতুন টেমপ্লেট সংরক্ষণ করুন', 'Save New Template')}</span>
              </button>
            </div>

            {/* Template Selector Pills */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-700 dark:text-zinc-300 block">
                {pickText('রেডিমেড অফার টেমপ্লেট নির্বাচন করুন:', 'Select Ready-made Offer Template:')}
              </span>
              <div className="flex flex-wrap gap-2">
                {templates.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => {
                      setSelectedTemplateId(tpl.id);
                      setCustomMessageBody(tpl.messageBody);
                    }}
                    className={`px-3 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                      selectedTemplateId === tpl.id
                        ? 'bg-[#164e3f] text-white border-[#164e3f] shadow-2xs'
                        : 'bg-[#f4f7f5] dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-700 hover:bg-slate-200'
                    }`}
                  >
                    {pickText(tpl.titleBn || tpl.title || '', tpl.title || tpl.titleBn || '')}
                  </button>
                ))}
              </div>
            </div>

            {isAddingTemplate && (
              <div className="p-3.5 rounded-2xl bg-[#f4f7f5] dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-zinc-300 mb-1">
                    {pickText('নতুন টেমপ্লেটের নাম *', 'New Template Name *')}
                  </label>
                  <input
                    type="text"
                    value={newTemplateTitle}
                    onChange={(e) => setNewTemplateTitle(e.target.value)}
                    placeholder={pickText('যেমন: বৈশাখী স্পেশাল অফার', 'e.g. Festive Special Offer')}
                    className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-zinc-300 mb-1">
                    {pickText('ক্যাটাগরি', 'Category')}
                  </label>
                  <select
                    value={newTemplateCategory}
                    onChange={(e) => setNewTemplateCategory(e.target.value as CampaignTemplate['occasion'])}
                    className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                  >
                    <option value="eid">{pickText('ঈদ অফার', 'Eid Offer')}</option>
                    <option value="puja">{pickText('পূজা অফার', 'Puja Offer')}</option>
                    <option value="new_arrival">{pickText('নতুন কালেকশন', 'New Arrival')}</option>
                    <option value="clearance">{pickText('ক্লিয়ারেন্স সেল', 'Clearance Sale')}</option>
                    <option value="custom">{pickText('কাস্টম অফার', 'Custom Offer')}</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={handleSaveCustomTemplate}
                    className="w-full py-2 px-4 rounded-xl bg-[#164e3f] hover:bg-[#123e32] text-white font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{pickText('টেমপ্লেট সেভ করুন', 'Save Template')}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Editable Message Body + Live Preview */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-700 dark:text-zinc-300">
                    {pickText('মেসেজ টেক্সট এডিট করুন (প্লেসহোল্ডার:', 'Edit Message Text (Placeholders:')}{' '}
                    <code className="text-[#164e3f] font-mono">{'{{customer_name}}'}</code>{' '}
                    {pickText('ও', '&')}{' '}
                    <code className="text-[#164e3f] font-mono">{'{{shop_name}}'}</code>)
                  </label>
                </div>
                <textarea
                  rows={4}
                  value={customMessageBody}
                  onChange={(e) => setCustomMessageBody(e.target.value)}
                  className="w-full bg-[#f4f7f5] dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-2xl p-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#164e3f]"
                />
              </div>

              <div className="p-3.5 rounded-2xl bg-[#e6f4ea]/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-[#164e3f] dark:text-emerald-300">
                    {pickText(
                      `লাইভ মেসেজ প্রিভিউ (${effectivePreviewCustomerName}-এর জন্য):`,
                      `Live Message Preview (for ${effectivePreviewCustomerName}):`
                    )}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white dark:bg-zinc-900 text-[#164e3f] border border-emerald-200">
                    {pickText('হোয়াটসঅ্যাপ / এসএমএস প্রিভিউ', 'WhatsApp / SMS Preview')}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-emerald-200/80 dark:border-emerald-800/60 text-slate-800 dark:text-zinc-200 whitespace-pre-wrap leading-relaxed">
                  {renderCampaignTemplate(customMessageBody, {
                    customerName: effectivePreviewCustomerName,
                    shopName: currentTenant.name,
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Customer Filter Pills & Individual WhatsApp List */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-3xl p-4 sm:p-5 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    { id: 'all', label: pickText('সকল কাস্টমার', 'All Buyers') },
                    { id: 'repeat', label: pickText('রিপিট কাস্টমার (২+ অর্ডার)', 'Repeat Buyers (2+ Orders)') },
                    { id: 'inactive', label: pickText('নিষ্ক্রিয় কাস্টমার (৩০+ দিন)', 'Inactive Buyers (30d+)') },
                    { id: 'due', label: pickText('বকেয়া কাস্টমার', 'Has Due') },
                    { id: 'opt_out', label: pickText('মেসেজ বন্ধ', 'Do-Not-Contact') },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setCampaignFilter(f.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      campaignFilter === f.id
                        ? 'bg-[#164e3f] text-white'
                        : 'bg-[#f4f7f5] dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={pickText('নাম বা মোবাইল নম্বর খুঁজুন...', 'Search by name or phone...')}
                  className="w-full bg-[#f4f7f5] dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {campaignCustomers.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400">
                {pickText('এই ফিল্টারে কোনো কাস্টমার পাওয়া যায়নি', 'No customers found for this filter')}
              </div>
            ) : (
              <div className="border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
                {/* Mobile Compact Summary List (< 768px) */}
                <div className="md:hidden divide-y divide-slate-100 dark:divide-zinc-800">
                  {campaignCustomers.slice(0, visibleLimit).map((cust, idx) => (
                    <div
                      key={`f_m_${cust.phone}_${idx}`}
                      onClick={() => {
                        setPreviewCustomerName(cust.name);
                        setQuickDetailCustomer(cust);
                      }}
                      className="px-3.5 py-2.5 flex items-center justify-between gap-2.5 hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 transition cursor-pointer"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                            {cust.name}
                          </span>
                          {cust.doNotContact && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-50 text-rose-700 font-semibold">
                              {pickText('মেসেজ বন্ধ', 'Opt-Out')}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500 dark:text-zinc-400">
                          {cust.phone} • {cust.loyaltyPoints} pts
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          disabled={cust.doNotContact}
                          onClick={() => handleOpenFestiveWhatsAppIndividual(cust)}
                          className="px-2.5 py-1.5 rounded-xl bg-[#164e3f] hover:bg-[#123e32] disabled:opacity-40 text-white font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer"
                        >
                          <MessageSquare className="w-3 h-3" />
                          <span>WhatsApp</span>
                        </button>
                        <ChevronRight
                          onClick={() => setQuickDetailCustomer(cust)}
                          className="w-4 h-4 text-slate-400 shrink-0"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Table (>= 768px) */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#f4f7f5] dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 font-bold border-b border-slate-200 dark:border-zinc-700">
                      <tr>
                        <th className="p-3">{pickText('কাস্টমারের নাম', 'Customer Name')}</th>
                        <th className="p-3">{pickText('মোবাইল নম্বর', 'Mobile Number')}</th>
                        <th className="p-3 text-center">{pickText('মোট অর্ডার ও পয়েন্ট', 'Total Orders & Points')}</th>
                        <th className="p-3 text-center">{pickText('মেসেজ স্ট্যাটাস', 'Message Status (Opt-Out)')}</th>
                        <th className="p-3 text-right">{pickText('ব্যক্তিগত মেসেজ অ্যাকশন', 'Individual Message Action (One-by-One)')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                      {campaignCustomers.slice(0, visibleLimit).map((cust, idx) => (
                        <tr
                          key={`${cust.phone}_${idx}`}
                          onMouseEnter={() => setPreviewCustomerName(cust.name)}
                          className="hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 transition"
                        >
                          <td className="p-3 font-bold text-slate-900 dark:text-white">
                            {cust.name}
                            <span className="block text-[10px] font-normal text-slate-400">
                              {pickText('শেষ ক্রয়:', 'Last purchase:')} {new Date(cust.lastOrderDate).toLocaleDateString()} • ৳{cust.totalSpent.toLocaleString()}
                            </span>
                          </td>
                          <td className="p-3 font-mono font-bold text-slate-700 dark:text-zinc-300">
                            {cust.phone}
                          </td>
                          <td className="p-3 text-center">
                            <span className="font-bold text-slate-800 dark:text-zinc-200">{cust.totalOrders} {pickText('অর্ডার', 'orders')}</span>
                            <span className="ml-1.5 px-2 py-0.5 rounded-full bg-[#e6f4ea] text-[#164e3f] font-mono font-bold text-[10px]">
                              {cust.loyaltyPoints} pts
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                const nextState = dbService.toggleCustomerDoNotContact(
                                  currentTenant.id,
                                  cust.phone,
                                  cust.name
                                );
                                setRefreshTick((t) => t + 1);
                                showToast(
                                  nextState
                                    ? pickText(
                                        `${cust.name}-কে Do-Not-Contact তালিকায় রাখা হয়েছে`,
                                        `${cust.name} added to Do-Not-Contact list`
                                      )
                                    : pickText(
                                        `${cust.name}-এর মেসেজ অপশন পুনরায় চালু করা হয়েছে`,
                                        `Messaging re-enabled for ${cust.name}`
                                      ),
                                  'info'
                                );
                              }}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition cursor-pointer inline-flex items-center gap-1 ${
                                cust.doNotContact
                                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                                  : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                              }`}
                            >
                              <BellOff className="w-3 h-3" />
                              <span>{cust.doNotContact ? pickText('মেসেজ বন্ধ', 'Opted Out') : pickText('সক্রিয়', 'Active')}</span>
                            </button>
                          </td>
                          <td className="p-3 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                disabled={cust.doNotContact}
                                onClick={() => handleOpenFestiveWhatsAppIndividual(cust)}
                                className="px-3 py-1.5 rounded-xl bg-[#164e3f] hover:bg-[#123e32] disabled:opacity-40 text-white font-bold text-[11px] inline-flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                                <span>{pickText('WhatsApp মেসেজ ওপেন করুন', 'Open WhatsApp Message')}</span>
                              </button>
                              <button
                                type="button"
                                disabled={cust.doNotContact}
                                onClick={() => handleOpenFestiveSmsIndividual(cust)}
                                className="px-2.5 py-1.5 rounded-xl bg-[#f4f7f5] hover:bg-slate-200 dark:bg-zinc-800 disabled:opacity-40 text-slate-700 dark:text-zinc-200 border border-slate-200 dark:border-zinc-700 font-bold text-[11px] inline-flex items-center gap-1 transition cursor-pointer"
                                title={pickText('ফোনের ডিফল্ট SMS অ্যাপে ওপেন করুন', 'Open in default SMS app')}
                              >
                                <Smartphone className="w-3.5 h-3.5" />
                                <span>{pickText('SMS অ্যাপ', 'SMS App')}</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Recent Individual WhatsApp Preview Open Logs (Audit) */}
            {campaignLogs.length > 0 && (
              <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#164e3f]" />
                    <span>
                      {pickText(
                        'সাম্প্রতিক ওপেন করা WhatsApp প্রিভিউ লগ (Status: opened_whatsapp_preview)',
                        'Recent Opened WhatsApp Preview Logs (Status: opened_whatsapp_preview)'
                      )}
                    </span>
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {pickText(
                      'শুধুমাত্র প্রিভিউ ওপেন রেকর্ড করা হয় (স্বয়ংক্রিয় Sent দাবি করা হয় না)',
                      'Records preview open only (does not claim automatic delivery)'
                    )}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {campaignLogs.slice(0, 6).map((log) => (
                    <div
                      key={log.id}
                      className="px-3 py-1.5 rounded-xl bg-[#f4f7f5] dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-[11px] flex items-center gap-2"
                    >
                      <span className="font-bold text-slate-900 dark:text-white">{log.customerName}</span>
                      <span className="font-mono text-slate-500">({log.customerPhone})</span>
                      <span className="px-1.5 py-0.5 rounded bg-[#e6f4ea] text-[#164e3f] font-mono text-[10px] font-bold">
                        {log.action}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: CUSTOMER DIRECTORY & LOYALTY TABLE                                 */}
      {/* ========================================================================= */}
      {activeSubTab === 'directory' && (
        <>
          {/* Filter and Search Bar */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-3xl p-3 sm:p-4 shadow-2xs space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              {/* Search Box */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={pickText('নাম বা মোবাইল নম্বর দিয়ে কাস্টমার খুঁজুন...', 'Search customer by name or phone...')}
                  className="w-full bg-[#f4f7f5] dark:bg-zinc-800 border border-slate-200/80 dark:border-zinc-700 rounded-2xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#164e3f]"
                />
              </div>

              {/* Date Range Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
                {[
                  { key: 'all', label: pickText('সব সময়', 'All Time') },
                  { key: 'today', label: pickText('আজ', 'Today') },
                  { key: 'yesterday', label: pickText('গতকাল', 'Yesterday') },
                  { key: 'last7', label: pickText('গত ৭ দিন', 'Last 7 Days') },
                  { key: 'this_month', label: pickText('এই মাস', 'This Month') },
                  { key: 'custom', label: pickText('কাস্টম তারিখ', 'Custom Range') },
                ].map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setDateFilter(p.key as any)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                      dateFilter === p.key
                        ? 'bg-[#164e3f] text-white shadow-xs font-bold'
                        : 'bg-[#f4f7f5] dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-750'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Party Type Filter */}
              <div className="flex items-center gap-1 shrink-0">
                {(['all', 'Retail', 'Reseller'] as const).map((pty) => (
                  <button
                    key={pty}
                    type="button"
                    onClick={() => setPartyFilter(pty)}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      partyFilter === pty
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-zinc-900'
                        : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200'
                    }`}
                  >
                    {pty === 'all' ? pickText('সব ধরন', 'All Types') : pty === 'Retail' ? pickText('রিটেইল', 'Retail') : pickText('রিসেলার', 'Reseller')}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Date Pickers if active */}
            {dateFilter === 'custom' && (
              <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800 text-xs">
                <span className="text-slate-500 font-semibold">{pickText('শুরু:', 'From:')}</span>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="bg-[#f4f7f5] dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-2.5 py-1 text-slate-800 dark:text-white"
                />
                <span className="text-slate-500 font-semibold">{pickText('শেষ:', 'To:')}</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="bg-[#f4f7f5] dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-2.5 py-1 text-slate-800 dark:text-white"
                />
              </div>
            )}
          </div>

          {/* Customer List: Desktop Table + Mobile Cards */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-3xl p-3 sm:p-5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between px-1">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  {pickText('কাস্টমার ডিরেক্টরি', 'Customer Directory')} ({displayedCustomers.length})
                </h2>
                <span className="text-xs text-slate-400">
                  {pickText(
                    'যেকোনো কাস্টমারে ক্লিক করে সম্পূর্ণ প্রোফাইল, ক্রয় ইতিহাস ও লয়্যালটি লেজার দেখুন',
                    'Click any customer to open full profile, purchase history & loyalty ledger'
                  )}
                </span>
              </div>

              <span className="text-xs font-semibold text-[#164e3f] dark:text-emerald-400">
                {pickText(`${currentTenant.name}-এর জন্য সংরক্ষিত`, `Isolated to ${currentTenant.name}`)}
              </span>
            </div>

            {displayedCustomers.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs space-y-1">
                <Users className="w-8 h-8 mx-auto opacity-30 text-slate-400 mb-2" />
                <p className="font-semibold text-slate-700 dark:text-zinc-300">
                  {pickText('কোনো কাস্টমার পাওয়া যায়নি', 'No customers found')}
                </p>
                <p className="text-[11px]">{pickText('ফিল্টার পরিবর্তন করে আবার চেষ্টা করুন', 'Try changing your filters')}</p>
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden md:block border border-slate-100 dark:border-zinc-800 rounded-2xl overflow-hidden">
                  <table className="w-full text-left text-xs text-slate-700 dark:text-zinc-300">
                    <thead className="bg-[#f4f7f5] dark:bg-zinc-800/80 border-b border-slate-200/80 dark:border-zinc-700 text-[11px] font-bold text-slate-600 dark:text-zinc-400">
                      <tr>
                        <th className="p-3">{pickText('কাস্টমারের নাম', 'Customer Name')}</th>
                        <th className="p-3">{pickText('ফোন', 'Phone')}</th>
                        <th className="p-3">{pickText('লয়্যালটি পয়েন্ট', 'Loyalty Points')}</th>
                        <th className="p-3 text-center">{pickText('অর্ডার', 'Orders')}</th>
                        <th className="p-3 text-right">{pickText('মোট ক্রয়', 'Total Spent')}</th>
                        <th className="p-3 text-right">{pickText('বর্তমান বকেয়া', 'Current Due')}</th>
                        <th className="p-3 text-center">{pickText('অ্যাকশন', 'Actions')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                      {displayedCustomers.slice(0, visibleLimit).map((cust, idx) => (
                        <tr
                          key={`${cust.phone}_${idx}`}
                          onClick={() => setSelectedCustomerPhone(cust.phone)}
                          className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition cursor-pointer group"
                        >
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-xl bg-[#e6f4ea] dark:bg-emerald-950/60 text-[#1f8a5b] dark:text-emerald-400 font-bold flex items-center justify-center shrink-0 text-xs group-hover:bg-[#164e3f] group-hover:text-white transition-colors">
                                {cust.name.charAt(0) || 'C'}
                              </div>
                              <div>
                                <span className="font-bold text-slate-900 dark:text-white block group-hover:text-[#164e3f] dark:group-hover:text-emerald-400 transition-colors">
                                  {cust.name}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  {pickText('শেষ:', 'Last:')} {new Date(cust.lastOrderDate).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="p-3 font-mono font-semibold text-slate-800 dark:text-zinc-200">
                            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                              <span>{cust.phone || 'N/A'}</span>
                              {cust.phone && <CopyPhoneButton phone={cust.phone} />}
                            </div>
                          </td>
                          <td className="p-3">
                            <span className="px-2.5 py-1 rounded-full bg-[#e6f4ea] dark:bg-emerald-950/60 text-[#164e3f] dark:text-emerald-300 font-mono font-extrabold text-[11px]">
                              {cust.loyaltyPoints} pts
                            </span>
                          </td>
                          <td className="p-3 text-center font-bold">
                            {cust.totalOrders}
                          </td>
                          <td className="p-3 text-right font-black text-slate-900 dark:text-white text-sm">
                            ৳{cust.totalSpent.toLocaleString()}
                          </td>
                          <td className="p-3 text-right">
                            {cust.totalDue > 0 ? (
                              <span className="font-bold text-rose-600 dark:text-rose-400">
                                ৳{cust.totalDue.toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-[#1f8a5b] dark:text-emerald-400 font-semibold">
                                {pickText('পরিশোধিত', 'Paid')}
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                              {cust.phone && (
                                <button
                                  onClick={() => handleWhatsApp(cust.phone, cust.name)}
                                  className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-400 transition cursor-pointer"
                                  title={pickText('হোয়াটসঅ্যাপ মেসেজ', 'WhatsApp Message')}
                                >
                                  <MessageSquare className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                onClick={() => setSelectedCustomerPhone(cust.phone)}
                                className="flex items-center gap-1 px-3 py-1 rounded-xl bg-[#164e3f] hover:bg-[#123e32] text-white text-[11px] font-bold transition cursor-pointer shadow-2xs active:scale-95"
                              >
                                <span>{pickText('বিস্তারিত', 'Details')}</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Compact Summary List (< 768px) */}
                <div className="md:hidden divide-y divide-slate-100 dark:divide-zinc-800 border border-slate-100 dark:border-zinc-800 rounded-2xl overflow-hidden">
                  {displayedCustomers.slice(0, visibleLimit).map((cust, idx) => (
                    <button
                      key={`m_${cust.phone}_${idx}`}
                      type="button"
                      onClick={() => setQuickDetailCustomer(cust)}
                      className="w-full px-3.5 py-2.5 text-left flex items-center justify-between gap-2.5 hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 transition cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="w-8 h-8 rounded-xl bg-[#e6f4ea] dark:bg-emerald-950/60 text-[#164e3f] dark:text-emerald-300 font-bold flex items-center justify-center shrink-0 text-xs">
                          {cust.name.charAt(0) || 'C'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-xs text-slate-900 dark:text-white truncate">
                            {cust.name}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono truncate">
                            {cust.phone || pickText('নম্বর নেই', 'No phone')} • {cust.totalOrders} {cust.totalOrders === 1 ? pickText('অর্ডার', 'order') : pickText('অর্ডার', 'orders')}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-right">
                          <div className="text-xs font-black text-slate-900 dark:text-white font-mono">
                            ৳{cust.totalSpent.toLocaleString()}
                          </div>
                          <div className="mt-0.5">
                            {cust.totalDue > 0 ? (
                              <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400">
                                {pickText('বকেয়া', 'Due')} ৳{cust.totalDue.toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold text-[#1f8a5b] dark:text-emerald-400">
                                {pickText('পরিশোধিত', 'Paid')}
                              </span>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                      </div>
                    </button>
                  ))}
                </div>

                {displayedCustomers.length > visibleLimit && (
                  <div className="pt-3 text-center">
                    <button
                      type="button"
                      onClick={() => setVisibleLimit((prev) => prev + 50)}
                      className="px-4 py-2 rounded-xl bg-[#f4f7f5] hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
                    >
                      {pickText('আরও কাস্টমার দেখুন', 'Load More Customers')}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}

      {/* Printable Customer Directory Report */}
      <div id="printable-customer-directory" className="hidden">
        <div className="p-8 text-black bg-white space-y-4">
          <div className="border-b-2 border-black pb-3 text-center">
            <h1 className="text-2xl font-black uppercase tracking-wider">{currentTenant.name}</h1>
            <p className="text-xs">{currentTenant.marketMallName} • {currentTenant.shopNo}</p>
            <p className="text-xs">
              {pickText('হটলাইন:', 'Hotline:')} {currentTenant.ownerPhone} • {pickText('অফিসিয়াল কাস্টমার ডিরেক্টরি স্টেটমেন্ট', 'Official Customer Directory Statement')}
            </p>
          </div>

          <table className="w-full text-xs text-left border-collapse border border-black">
            <thead>
              <tr className="bg-slate-100 border-b border-black">
                <th className="p-2 border border-black">#</th>
                <th className="p-2 border border-black">{pickText('কাস্টমারের নাম', 'Customer Name')}</th>
                <th className="p-2 border border-black">{pickText('মোবাইল নম্বর', 'Mobile Phone')}</th>
                <th className="p-2 text-center border border-black">{pickText('অর্ডার', 'Orders')}</th>
                <th className="p-2 text-center border border-black">{pickText('লয়্যালটি পয়েন্ট', 'Loyalty Pts')}</th>
                <th className="p-2 text-right border border-black">{pickText('মোট ক্রয় (৳)', 'Total Spent (৳)')}</th>
                <th className="p-2 text-right border border-black">{pickText('বকেয়া (৳)', 'Due (৳)')}</th>
              </tr>
            </thead>
            <tbody>
              {displayedCustomers.map((cust, idx) => (
                <tr key={idx} className="border-b border-black">
                  <td className="p-2 border border-black">{idx + 1}</td>
                  <td className="p-2 font-bold border border-black">{cust.name}</td>
                  <td className="p-2 font-mono border border-black">{cust.phone || 'N/A'}</td>
                  <td className="p-2 text-center border border-black">{cust.totalOrders}</td>
                  <td className="p-2 text-center border border-black">{cust.loyaltyPoints}</td>
                  <td className="p-2 text-right font-bold border border-black">৳{cust.totalSpent.toLocaleString()}</td>
                  <td className="p-2 text-right border border-black">৳{cust.totalDue.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Compact Bottom Sheet for Customer Quick Details */}
      <BottomSheet
        isOpen={Boolean(quickDetailCustomer)}
        onClose={() => setQuickDetailCustomer(null)}
        title={quickDetailCustomer ? quickDetailCustomer.name : pickText('কাস্টমার বিবরণ', 'Customer Details')}
        subtitle={quickDetailCustomer ? `${quickDetailCustomer.phone || pickText('নম্বর নেই', 'No phone')} • ${quickDetailCustomer.partyType}` : undefined}
        maxHeightClass="max-h-[48dvh]"
        footer={
          quickDetailCustomer ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const phone = quickDetailCustomer.phone;
                  setQuickDetailCustomer(null);
                  setSelectedCustomerPhone(phone);
                }}
                className="flex-1 py-2 px-3 rounded-xl bg-[#164e3f] hover:bg-[#123e32] text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>{pickText('সম্পূর্ণ প্রোফাইল ও অর্ডার হিস্ট্রি', 'Full Profile & Order History')}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              {quickDetailCustomer.phone && (
                <button
                  type="button"
                  onClick={() =>
                    activeSubTab === 'festive'
                      ? handleOpenFestiveWhatsAppIndividual(quickDetailCustomer)
                      : handleWhatsApp(quickDetailCustomer.phone, quickDetailCustomer.name)
                  }
                  className="py-2 px-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </button>
              )}
            </div>
          ) : undefined
        }
      >
        {quickDetailCustomer && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800/60 text-center">
                <div className="text-[10px] text-slate-400">{pickText('মোট ক্রয়', 'Total Spent')}</div>
                <div className="font-mono font-black text-xs text-slate-900 dark:text-white mt-0.5">
                  ৳{quickDetailCustomer.totalSpent.toLocaleString()}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800/60 text-center">
                <div className="text-[10px] text-slate-400">{pickText('লয়্যালটি পয়েন্ট', 'Loyalty Points')}</div>
                <div className="font-mono font-black text-xs text-[#164e3f] dark:text-emerald-400 mt-0.5">
                  {quickDetailCustomer.loyaltyPoints} pts
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800/60 text-center">
                <div className="text-[10px] text-slate-400">{pickText('বর্তমান বকেয়া', 'Current Due')}</div>
                <div className={`font-mono font-black text-xs mt-0.5 ${quickDetailCustomer.totalDue > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  ৳{quickDetailCustomer.totalDue.toLocaleString()}
                </div>
              </div>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">{pickText('মোট অর্ডার', 'Total Orders')}</span>
                <span className="font-bold text-slate-900 dark:text-white">{quickDetailCustomer.totalOrders} {pickText('অর্ডার', 'orders')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{pickText('শেষ ক্রয়ের তারিখ', 'Last Purchase Date')}</span>
                <span className="font-mono font-semibold text-slate-800 dark:text-zinc-200">
                  {new Date(quickDetailCustomer.lastOrderDate).toLocaleDateString('en-GB')}
                </span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-slate-100 dark:border-zinc-800">
                <span className="text-slate-500">{pickText('ক্যাম্পেইন স্ট্যাটাস', 'Campaign Status')}</span>
                <button
                  type="button"
                  onClick={() => {
                    const nextState = dbService.toggleCustomerDoNotContact(
                      currentTenant.id,
                      quickDetailCustomer.phone,
                      quickDetailCustomer.name
                    );
                    setRefreshTick((t) => t + 1);
                    setQuickDetailCustomer({
                      ...quickDetailCustomer,
                      doNotContact: nextState,
                    });
                    showToast(
                      nextState
                        ? pickText(
                            `${quickDetailCustomer.name}-কে Do-Not-Contact তালিকায় রাখা হয়েছে`,
                            `${quickDetailCustomer.name} added to Do-Not-Contact list`
                          )
                        : pickText(
                            `${quickDetailCustomer.name}-এর মেসেজ অপশন পুনরায় চালু করা হয়েছে`,
                            `Messaging re-enabled for ${quickDetailCustomer.name}`
                          ),
                      'info'
                    );
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition cursor-pointer inline-flex items-center gap-1 ${
                    quickDetailCustomer.doNotContact
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}
                >
                  <BellOff className="w-3 h-3" />
                  <span>{quickDetailCustomer.doNotContact ? pickText('মেসেজ বন্ধ', 'Opted Out') : pickText('সক্রিয়', 'Active')}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </BottomSheet>
    </div>
  );
};
