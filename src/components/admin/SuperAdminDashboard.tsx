import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { TenantShop, GlobalBlacklistEntry, SubscriptionStatus } from '../../types';
import { dbService } from '../../services/db';
import {
  ShieldCheck,
  Building2,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  LogIn,
  Sliders,
  Users,
  Search,
  Plus,
  Trash2,
  Phone,
  Sparkles,
  Shirt,
  ShoppingBag,
} from 'lucide-react';

export const SuperAdminDashboard: React.FC = () => {
  const { tenants, impersonateShop, reloadShopData, showToast } = useApp();
  const [activeTab, setActiveTab] = useState<'tenants' | 'audit' | 'blacklist' | 'flags'>('audit');
  const [search, setSearch] = useState('');

  // Blacklist
  const [blacklist, setBlacklist] = useState<GlobalBlacklistEntry[]>(() => dbService.getBlacklist());
  const [isBlacklistModalOpen, setIsBlacklistModalOpen] = useState(false);
  const [blPhone, setBlPhone] = useState('');
  const [blName, setBlName] = useState('');
  const [blReason, setBlReason] = useState('Fake bKash TrxID screenshot scam attempt');
  const [blAmount, setBlAmount] = useState<number>(2500);

  // Selected tenant for feature flags
  const [flagTenant, setFlagTenant] = useState<TenantShop>(tenants[0]);

  const reload = () => {
    reloadShopData();
    setBlacklist(dbService.getBlacklist());
  };

  // Metrics
  const activeTenantsCount = tenants.filter((t) => t.subscription?.status === 'active' || t.subscription?.status === 'grace').length;
  const totalMrr = tenants.reduce((acc, t) => acc + (t.subscription?.status !== 'expired' ? (t.subscription?.amount || t.subscription?.monthlyFeeBdt || 0) : 0), 0);
  const totalPlatformGmv = tenants.reduce((acc, t) => acc + (t.stats?.gmv || 0), 0);
  const pendingAuditCount = tenants.filter((t) => t.subscription?.status === 'pending' || t.subscription?.status === 'grace').length;

  // Subscription Actions
  const handleApproveTrx = (tenantId: string) => {
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    dbService.updateTenant(tenantId, {
      subscription: {
        ...tenants.find((t) => t.id === tenantId)!.subscription,
        status: 'active',
        verifiedAt: new Date().toISOString(),
        verifiedBy: 'Platform Super Admin',
        expiresAt,
      },
    });
    reload();
    showToast('Subscription approved! Shop granted 30 days active access.', 'success');
  };

  const handleGrantGrace = (tenantId: string) => {
    const graceEndsAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    dbService.updateTenant(tenantId, {
      subscription: {
        ...tenants.find((t) => t.id === tenantId)!.subscription,
        status: 'grace',
        graceEndsAt,
      },
    });
    reload();
    showToast('24-Hour Grace period granted to store.', 'warning');
  };

  const handleRejectTrx = (tenantId: string) => {
    dbService.updateTenant(tenantId, {
      subscription: {
        ...tenants.find((t) => t.id === tenantId)!.subscription,
        status: 'expired',
      },
    });
    reload();
    showToast('TrxID rejected. Store marked expired.', 'error');
  };

  // Toggle Feature Flag
  const handleToggleFlag = (flagName: keyof TenantShop['featureFlags']) => {
    if (!flagTenant) return;
    const updatedFlags = {
      ...flagTenant.featureFlags,
      [flagName]: !flagTenant.featureFlags[flagName],
    };
    dbService.updateTenant(flagTenant.id, { featureFlags: updatedFlags });
    setFlagTenant({ ...flagTenant, featureFlags: updatedFlags });
    reload();
    showToast(`Flag "${flagName}" updated for ${flagTenant.name}`, 'info');
  };

  // Blacklist addition
  const handleAddBlacklist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!blPhone) {
      showToast('Phone number required', 'error');
      return;
    }
    const entry: GlobalBlacklistEntry = {
      id: `bl_${Date.now()}`,
      phone: blPhone.trim(),
      customerName: blName.trim() || 'Unknown Subject',
      reportedByShopId: 'super_admin',
      reportedByShopName: 'LEKHO Central Audit Hub',
      reason: blReason.trim(),
      amountDefrauded: blAmount,
      reportedAt: new Date().toISOString(),
      severity: 'high',
    };
    dbService.addToBlacklist(entry);
    setBlacklist(dbService.getBlacklist());
    setIsBlacklistModalOpen(false);
    setBlPhone('');
    setBlName('');
    showToast(`Added ${entry.phone} to Global Fraud Blacklist!`, 'success');
  };

  const handleRemoveBlacklist = (phone: string) => {
    dbService.removeFromBlacklist(phone);
    setBlacklist(dbService.getBlacklist());
    showToast('Removed customer from Blacklist', 'info');
  };

  const filteredTenants = tenants.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.ownerPhone.includes(search) ||
      t.marketMallName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Insights Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4.5 space-y-1 shadow-2xs">
          <div className="flex justify-between items-center text-slate-500 dark:text-zinc-400 text-xs font-semibold">
            <span>Total Active Shops</span>
            <Building2 className="w-4 h-4 text-[#164e3f] dark:text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">{activeTenantsCount} / {tenants.length}</div>
          <div className="text-[11px] text-slate-400 dark:text-zinc-500">Retailers across Bangladesh</div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4.5 space-y-1 shadow-2xs">
          <div className="flex justify-between items-center text-slate-500 dark:text-zinc-400 text-xs font-semibold">
            <span>Platform MRR (SaaS)</span>
            <DollarSign className="w-4 h-4 text-[#164e3f] dark:text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-[#164e3f] dark:text-emerald-400">৳{totalMrr.toLocaleString()}</div>
          <div className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80">Monthly Recurring Revenue</div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4.5 space-y-1 shadow-2xs">
          <div className="flex justify-between items-center text-slate-500 dark:text-zinc-400 text-xs font-semibold">
            <span>Platform Retail GMV</span>
            <TrendingUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">৳{totalPlatformGmv.toLocaleString()}</div>
          <div className="text-[11px] text-slate-400 dark:text-zinc-500">Gross counter transactions</div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4.5 space-y-1 shadow-2xs">
          <div className="flex justify-between items-center text-slate-500 dark:text-zinc-400 text-xs font-semibold">
            <span>Pending TrxID Audits</span>
            <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400">{pendingAuditCount} Queued</div>
          <div className="text-[11px] text-amber-700/80 dark:text-amber-400/80">bKash/Nagad verification</div>
        </div>
      </div>

      {/* Navigation tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-zinc-900 p-2 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-2xs">
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'audit'
                ? 'bg-[#164e3f] text-white shadow-sm'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-zinc-800'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            Subscription & TrxID Audit Hub ({pendingAuditCount})
          </button>

          <button
            onClick={() => setActiveTab('tenants')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'tenants'
                ? 'bg-[#164e3f] text-white shadow-sm'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-zinc-800'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            Tenant Directory ({tenants.length})
          </button>

          <button
            onClick={() => setActiveTab('flags')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'flags'
                ? 'bg-[#164e3f] text-white shadow-sm'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-zinc-800'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            Modular Feature Flags
          </button>

          <button
            onClick={() => setActiveTab('blacklist')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'blacklist'
                ? 'bg-[#164e3f] text-white shadow-sm'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-zinc-800'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
            Global Customer Blacklist ({blacklist.length})
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 dark:text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search store, mall, phone..."
            className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-750 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-600"
          />
        </div>
      </div>

      {/* TAB 1: SUBSCRIPTION & TrxID AUDIT HUB */}
      {activeTab === 'audit' && (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 space-y-4 shadow-2xs">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              bKash / Nagad TrxID Real-Time Verification Hub
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Review incoming subscription transaction IDs, match against merchant statements, and approve or grant 24h grace
            </p>
          </div>

          <div className="border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-white dark:bg-zinc-950">
            <table className="w-full text-left text-xs text-slate-700 dark:text-zinc-300">
              <thead className="bg-slate-50 dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 text-[11px] uppercase font-bold text-slate-500 dark:text-zinc-400">
                <tr>
                  <th className="p-3">Store & Owner</th>
                  <th className="p-3">Plan & Fee</th>
                  <th className="p-3">Method & Sender</th>
                  <th className="p-3">Transaction ID (TrxID)</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Audit Controls</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-zinc-850">
                {tenants.map((tenant) => {
                  const sub = tenant.subscription;
                  return (
                    <tr key={tenant.id} className="hover:bg-slate-50 dark:hover:bg-zinc-900/60 transition">
                      <td className="p-3">
                        <div className="font-bold text-slate-900 dark:text-white">{tenant.name}</div>
                        <div className="text-[10px] text-slate-500 dark:text-zinc-400">
                          {tenant.ownerName} • {tenant.ownerPhone}
                        </div>
                      </td>

                      <td className="p-3">
                        <span className="font-bold uppercase text-slate-900 dark:text-white font-mono">
                          {sub.plan}
                        </span>
                        <div className="text-[11px] text-[#164e3f] dark:text-emerald-400 font-bold">
                          ৳{sub.amount}/mo
                        </div>
                      </td>

                      <td className="p-3">
                        <span className="font-bold uppercase text-amber-700 dark:text-amber-300">
                          {sub.paymentMethod}
                        </span>
                        <div className="text-[10px] text-slate-500 dark:text-zinc-400 font-mono">
                          {sub.senderPhone}
                        </div>
                      </td>

                      <td className="p-3">
                        <span className="bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 font-mono font-bold text-slate-900 dark:text-white px-2 py-1 rounded text-xs select-all">
                          {sub.trxId}
                        </span>
                        <div className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1">
                          {sub.submittedAt ? new Date(sub.submittedAt).toLocaleString() : 'N/A'}
                        </div>
                      </td>

                      <td className="p-3">
                        {sub.status === 'active' && (
                          <span className="bg-[#e6f4ea] dark:bg-emerald-500/10 text-[#164e3f] dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 px-2 py-0.5 rounded text-[11px] font-bold">
                            Active (30d)
                          </span>
                        )}
                        {sub.status === 'grace' && (
                          <span className="bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30 px-2 py-0.5 rounded text-[11px] font-bold">
                            24h Grace
                          </span>
                        )}
                        {sub.status === 'pending' && (
                          <span className="bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30 px-2 py-0.5 rounded text-[11px] font-bold">
                            Pending Verification
                          </span>
                        )}
                        {sub.status === 'expired' && (
                          <span className="bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30 px-2 py-0.5 rounded text-[11px] font-bold">
                            Expired
                          </span>
                        )}
                      </td>

                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleApproveTrx(tenant.id)}
                            className="px-2.5 py-1 bg-[#164e3f] hover:bg-[#1f8a5b] text-white rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
                            title="Verify TrxID & Grant 30 Days"
                          >
                            <CheckCircle className="w-3 h-3" />
                            Approve
                          </button>

                          <button
                            onClick={() => handleGrantGrace(tenant.id)}
                            className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
                            title="Give 24-Hour Grace Access"
                          >
                            <Clock className="w-3 h-3" />
                            24h Grace
                          </button>

                          <button
                            onClick={() => handleRejectTrx(tenant.id)}
                            className="p-1 bg-slate-100 dark:bg-zinc-800 hover:bg-rose-100 dark:hover:bg-rose-600/30 text-rose-600 dark:text-rose-400 rounded-lg transition cursor-pointer"
                            title="Reject TrxID"
                          >
                            <XCircle className="w-4 h-4" />
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
      )}

      {/* TAB 2: TENANT DIRECTORY & SHADOW IMPERSONATION */}
      {activeTab === 'tenants' && (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 space-y-4 shadow-2xs">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#164e3f] dark:text-emerald-400" />
              Registered Retail Stores Directory
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              1-Click "Login as Shop" shadow impersonation to debug accounting or ledger issues without customer passwords
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTenants.map((tenant) => (
              <div
                key={tenant.id}
                className="bg-slate-50/70 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 hover:border-emerald-300 dark:hover:border-zinc-700 rounded-2xl p-4.5 space-y-3 transition shadow-2xs"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      {tenant.category === 'jersey' ? <Shirt className="w-4 h-4 text-blue-600 dark:text-blue-400" /> : <ShoppingBag className="w-4 h-4 text-[#164e3f] dark:text-emerald-400" />}
                      {tenant.name}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">{tenant.marketMallName} • {tenant.shopNo}</p>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                      tenant.subscription.status === 'active'
                        ? 'bg-[#e6f4ea] dark:bg-emerald-500/20 text-[#164e3f] dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30'
                        : tenant.subscription.status === 'grace'
                        ? 'bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30'
                        : 'bg-rose-50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30'
                    }`}
                  >
                    {tenant.subscription.status}
                  </span>
                </div>

                <div className="text-xs text-slate-700 dark:text-zinc-300 space-y-1 bg-white dark:bg-zinc-900/60 p-2.5 rounded-xl border border-slate-200 dark:border-zinc-850">
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-zinc-500">Owner Contact:</span>
                    <span className="font-semibold">{tenant.ownerName} ({tenant.ownerPhone})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-zinc-500">Plan Tier:</span>
                    <span className="font-bold uppercase text-[#164e3f] dark:text-emerald-400">{tenant.subscription?.plan} (৳{tenant.subscription?.amount || tenant.subscription?.monthlyFeeBdt || 0})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-zinc-500">Total Sales GMV:</span>
                    <span className="font-mono font-bold">৳{(tenant.stats?.gmv || 0).toLocaleString()}</span>
                  </div>
                </div>

                <button
                  onClick={() => impersonateShop(tenant.id)}
                  className="w-full py-2.5 rounded-xl bg-[#164e3f] hover:bg-[#1f8a5b] text-white font-bold text-xs flex items-center justify-center gap-2 transition shadow-sm cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  Login as Shop (Shadow Impersonation)
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: MODULAR FEATURE FLAGS */}
      {activeTab === 'flags' && (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 space-y-5 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200 dark:border-zinc-800 gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#164e3f] dark:text-emerald-400" />
                Modular Feature Flags Configuration
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Enable or disable deep modules per tenant based on subscribed tier or customized store requirements
              </p>
            </div>

            <select
              value={flagTenant.id}
              onChange={(e) => {
                const found = tenants.find((t) => t.id === e.target.value);
                if (found) setFlagTenant(found);
              }}
              className="bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-750 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none"
            >
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.category.toUpperCase()})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                key: 'jerseyCustomization' as const,
                title: 'Jersey Customization & Job Slip',
                desc: 'UPPERCASE lettering, number 0-99, patches, font picker, and print pipeline',
              },
              {
                key: 'alterationTracker' as const,
                title: 'Trial Room Alteration Tracker',
                desc: 'Tailoring ticket pipeline, fee deduction, and 1-click WhatsApp alerts',
              },
              {
                key: 'teamBulkOrders' as const,
                title: 'Team Tournament Bulk Matrix',
                desc: 'Multi-row spreadsheet roster generator for corporate tournaments',
              },
              {
                key: 'staffPins' as const,
                title: 'Sales Staff PINs & Commission',
                desc: 'Fast 4-digit PIN lock at register and commission per sold piece',
              },
              {
                key: 'multiDrawer' as const,
                title: 'Multi-Drawer Financial Reserves',
                desc: 'Cash drawer, bKash Merchant/Personal, Nagad, and Bank breakdown',
              },
              {
                key: 'resellerCounter' as const,
                title: 'Wholesale Dispatch & Baki Khata',
                desc: 'Reseller credit accounts, wholesale dispatches, and recovery ledger',
              },
            ].map((mod) => {
              const enabled = flagTenant.featureFlags[mod.key];
              return (
                <div
                  key={mod.key}
                  className={`p-4 rounded-2xl border transition ${
                    enabled
                      ? 'bg-[#e6f4ea]/60 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/40 text-slate-900 dark:text-white'
                      : 'bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-850 text-slate-500 dark:text-zinc-400'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">{mod.title}</span>
                    <button
                      onClick={() => handleToggleFlag(mod.key)}
                      className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                        enabled ? 'bg-[#164e3f] dark:bg-emerald-500' : 'bg-slate-300 dark:bg-zinc-800'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                          enabled ? 'left-6' : 'left-1'
                        }`}
                      />
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-2 leading-relaxed">{mod.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: GLOBAL CUSTOMER BLACKLIST */}
      {activeTab === 'blacklist' && (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 space-y-4 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                Global Customer Blacklist (Fraud & Unpaid Dues)
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Centralized registry of fraudulent numbers and fake TrxID submitters broadcasted across all platform shops
              </p>
            </div>

            <button
              onClick={() => setIsBlacklistModalOpen(true)}
              className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-500 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Report Fraud Number
            </button>
          </div>

          <div className="border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-white dark:bg-zinc-950">
            <table className="w-full text-left text-xs text-slate-700 dark:text-zinc-300">
              <thead className="bg-slate-50 dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 text-[11px] uppercase font-bold text-slate-500 dark:text-zinc-400">
                <tr>
                  <th className="p-3">Blacklisted Phone & Name</th>
                  <th className="p-3">Reported Reason</th>
                  <th className="p-3">Reported By</th>
                  <th className="p-3 text-right">Defrauded ৳</th>
                  <th className="p-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-zinc-850">
                {blacklist.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50 dark:hover:bg-zinc-900/60 transition">
                    <td className="p-3">
                      <div className="font-mono font-bold text-rose-600 dark:text-rose-400 text-sm flex items-center gap-1.5">
                        <Phone className="w-3 h-3" />
                        {entry.phone}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-zinc-400">{entry.customerName}</div>
                    </td>
                    <td className="p-3 text-slate-800 dark:text-zinc-200">{entry.reason}</td>
                    <td className="p-3 text-slate-500 dark:text-zinc-400">
                      <div>{entry.reportedByShopName}</div>
                      <div className="text-[10px] text-slate-400 dark:text-zinc-500">
                        {new Date(entry.reportedAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                      {entry.amountDefrauded ? `৳${entry.amountDefrauded.toLocaleString()}` : '-'}
                    </td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => handleRemoveBlacklist(entry.phone)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 dark:text-zinc-500 dark:hover:text-white rounded-lg transition cursor-pointer"
                        title="Remove from Blacklist"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Report Fraud Modal */}
      {isBlacklistModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleAddBlacklist}
            className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl max-w-sm w-full p-6 text-slate-900 dark:text-zinc-100 shadow-2xl space-y-4"
          >
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
              Report Customer to Global Blacklist
            </h3>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">Customer Phone Number</label>
              <input
                type="text"
                required
                value={blPhone}
                onChange={(e) => setBlPhone(e.target.value)}
                placeholder="017..."
                className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-750 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">Customer Name (Optional)</label>
              <input
                type="text"
                value={blName}
                onChange={(e) => setBlName(e.target.value)}
                placeholder="e.g. Fraud Subject"
                className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-750 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">Defrauded Amount (৳)</label>
              <input
                type="number"
                value={blAmount}
                onChange={(e) => setBlAmount(Number(e.target.value))}
                className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-750 rounded-xl px-3 py-2 text-xs text-rose-600 dark:text-rose-400 font-bold focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">Reason / Fraud Evidence</label>
              <textarea
                required
                rows={2}
                value={blReason}
                onChange={(e) => setBlReason(e.target.value)}
                className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-750 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white focus:outline-none resize-none"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsBlacklistModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-750 text-xs font-semibold text-slate-600 dark:text-zinc-400 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-sm cursor-pointer"
              >
                Broadcast to Blacklist
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
