/**
 * LEKHO POS — Centralized Design System Tokens & Route Helpers
 *
 * Reference Design System:
 * - Page Background: #f8fafc (bg-slate-50 dark:bg-zinc-950)
 * - Card Surface: #ffffff (bg-white dark:bg-zinc-900) with subtle border (border-slate-200/90 dark:border-zinc-800)
 * - Secondary Muted Surface: #f4f7f5 (bg-[#f4f7f5] dark:bg-zinc-950)
 * - Primary Brand Accent: Dark Forest Green #164e3f (hover #123e32) & Mid Green #1f8a5b
 * - Soft Brand Tint: #e6f4ea (bg-[#e6f4ea] text-[#1f8a5b] border-emerald-200)
 * - Typography: Plus Jakarta Sans + Noto Sans Bengali (font-sans), JetBrains Mono (font-mono)
 */

export const LEKHO_THEME_TOKENS = {
  pageBackground:
    'min-h-screen bg-slate-50 text-slate-900 dark:bg-zinc-950 dark:text-zinc-100 font-sans transition-colors duration-150',
  pageContainer:
    'max-w-7xl w-full mx-auto px-3 sm:px-4 lg:px-6 py-3.5 sm:py-5 space-y-4 sm:space-y-5',
  cardSurface:
    'bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-3xl shadow-2xs',
  cardSurfaceCompact:
    'bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-2xl shadow-2xs',
  secondarySurface:
    'bg-[#f4f7f5] dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800 rounded-2xl',
  sectionHeader:
    'bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 shadow-2xs',
  iconBadgePrimary:
    'w-10 h-10 rounded-2xl bg-[#164e3f] text-white flex items-center justify-center shrink-0 shadow-xs',
  iconBadgeTint:
    'w-10 h-10 rounded-2xl bg-[#e6f4ea] dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 text-[#1f8a5b] dark:text-emerald-400 flex items-center justify-center shrink-0',
  primaryButton:
    'bg-[#164e3f] hover:bg-[#123e32] active:bg-[#0e3328] text-white font-bold rounded-2xl transition shadow-xs cursor-pointer',
  secondaryButton:
    'bg-[#e6f4ea] hover:bg-emerald-100 text-[#1f8a5b] border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800 font-bold rounded-2xl transition cursor-pointer',
  outlineButton:
    'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200/90 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700 font-semibold rounded-2xl transition cursor-pointer',
  ghostButton:
    'bg-transparent hover:bg-slate-100 text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-800 font-semibold rounded-xl transition cursor-pointer',
  dangerButton:
    'bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800 font-bold rounded-2xl transition cursor-pointer',
  inputField:
    'w-full bg-[#f4f7f5] dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800 rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#164e3f] focus:ring-2 focus:ring-[#164e3f]/15 transition',
  tableContainer:
    'bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-2xs',
  tableHeader:
    'bg-[#f4f7f5] dark:bg-zinc-950 border-b border-slate-200/80 dark:border-zinc-800 text-[11px] uppercase font-bold text-slate-500 dark:text-zinc-400',
  modalOverlay:
    'fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto animate-in fade-in duration-150',
  modalContainer:
    'bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-3xl p-4 sm:p-5 text-slate-900 dark:text-zinc-100 shadow-2xl relative my-auto max-h-[90dvh] flex flex-col overflow-hidden',
  typography: {
    pageHeading: 'lekho-h1 text-slate-900 dark:text-white',
    sectionHeading: 'lekho-h2 text-slate-900 dark:text-white',
    modalTitle: 'lekho-modal-title text-slate-900 dark:text-white',
    cardTitle: 'lekho-card-title text-slate-900 dark:text-white',
    bodyText: 'lekho-body text-slate-700 dark:text-zinc-300',
    label: 'lekho-label text-slate-700 dark:text-zinc-300',
    caption: 'lekho-caption text-slate-500 dark:text-zinc-400',
  },
  statusBadges: {
    pending:
      'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
    ready:
      'bg-[#e6f4ea] text-[#1f8a5b] border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
    completed:
      'bg-slate-100 text-slate-700 border border-slate-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700',
    danger:
      'bg-rose-50 text-rose-600 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
    info:
      'bg-[#e6f4ea] text-[#164e3f] border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
  },
} as const;

export const VALID_APP_TABS = new Set([
  'home',
  'dashboard',
  'pos',
  'inventory',
  'offer_announcement',
  'pipeline',
  'team',
  'reseller',
  'alteration',
  'lot_splitter',
  'dead_stock',
  'size_exchange',
  'drawers',
  'expenses',
  'settings',
  'invoices',
  'due_list',
  'customers',
  'daily_closing',
  'help',
  'auth',
]);

/**
 * Normalizes route/tab aliases (e.g., 'size-exchange', 'exchange', 'alterations')
 * into canonical LEKHO MainTabType identifiers.
 */
export function normalizeAppTab(rawTab?: string | null): string {
  const clean = String(rawTab || '')
    .trim()
    .toLowerCase()
    .replace(/^#\/?/, '')
    .replace(/^\/+/, '');

  if (!clean) return 'home';
  if (clean === 'stock' || clean === 'products' || clean === 'catalog' || clean === 'inventory') {
    return 'inventory';
  }
  if (clean === 'help' || clean === 'help-center' || clean === 'help_center' || clean === 'support') {
    return 'help';
  }
  if (
    clean === 'offers' ||
    clean === 'offer-announcement' ||
    clean === 'offer_announcement' ||
    clean === 'festive'
  ) {
    return 'offer_announcement';
  }
  if (clean === 'exchange' || clean === 'size-exchange' || clean === 'size_exchange') {
    return 'size_exchange';
  }
  if (clean === 'alterations' || clean === 'alteration' || clean === 'tailoring') {
    return 'alteration';
  }
  if (clean === 'dead-stock' || clean === 'dead_stock') {
    return 'dead_stock';
  }
  if (clean === 'lot-splitter' || clean === 'lot_splitter') {
    return 'lot_splitter';
  }
  if (clean === 'daily-closing' || clean === 'daily_closing') {
    return 'daily_closing';
  }
  if (clean === 'due-list' || clean === 'due_list') {
    return 'due_list';
  }
  if (VALID_APP_TABS.has(clean)) {
    return clean;
  }
  return 'home';
}

/**
 * Resolves the initial or current tab from URL query (?tab=size_exchange),
 * pathname (/size-exchange), or hash (#size_exchange) so direct navigation,
 * browser refresh, and back/forward buttons work reliably.
 */
export function parseTabFromLocation(
  search: string = '',
  pathname: string = '/',
  hash: string = ''
): { tab: string; subtab?: string } {
  try {
    const params = new URLSearchParams(search || '');
    const tabParam = params.get('tab') || params.get('page');
    const subtabParam = params.get('subtab') || undefined;
    if (tabParam) {
      const normalized = normalizeAppTab(tabParam);
      if (normalized === 'offer_announcement') {
        return { tab: 'customers', subtab: 'festive' };
      }
      return { tab: normalized, subtab: subtabParam };
    }
  } catch {
    // Ignore malformed query strings
  }

  if (hash && hash.length > 1) {
    const normalizedHash = normalizeAppTab(hash);
    if (normalizedHash === 'offer_announcement') {
      return { tab: 'customers', subtab: 'festive' };
    }
    if (normalizedHash !== 'home') {
      return { tab: normalizedHash };
    }
  }

  if (pathname && pathname !== '/' && pathname !== '/index.html') {
    const normalizedPath = normalizeAppTab(pathname);
    if (normalizedPath === 'offer_announcement') {
      return { tab: 'customers', subtab: 'festive' };
    }
    if (normalizedPath !== 'home') {
      return { tab: normalizedPath };
    }
  }

  return { tab: 'home' };
}

/**
 * Builds the relative URL for a given navigation tab and optional settings/customers subtab.
 */
export function buildUrlForTab(
  tab: string,
  subtab?: string,
  pathname: string = '/'
): string {
  const normalized = normalizeAppTab(tab);
  const basePath = pathname && pathname !== '/index.html' ? '/' : pathname || '/';
  if (normalized === 'home') {
    return basePath;
  }
  if (normalized === 'offer_announcement') {
    const params = new URLSearchParams();
    params.set('tab', 'customers');
    params.set('subtab', 'festive');
    return `${basePath}?${params.toString()}`;
  }
  const params = new URLSearchParams();
  params.set('tab', normalized);
  if ((normalized === 'settings' || normalized === 'customers') && subtab) {
    params.set('subtab', subtab);
  }
  return `${basePath}?${params.toString()}`;
}

