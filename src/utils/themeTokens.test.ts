import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LEKHO_THEME_TOKENS,
  VALID_APP_TABS,
  normalizeAppTab,
  parseTabFromLocation,
  buildUrlForTab,
} from './themeTokens';
import {
  sanitizeNavigationTabForShop,
  getAllowedExchangeModesForShop,
  getDefaultExchangeModeForShop,
} from './securityPolicy';

test('LEKHO_THEME_TOKENS provides consistent light-first surfaces and forest-green accents', () => {
  assert.ok(LEKHO_THEME_TOKENS.pageBackground.includes('bg-slate-50'));
  assert.ok(LEKHO_THEME_TOKENS.cardSurface.includes('bg-white'));
  assert.ok(LEKHO_THEME_TOKENS.primaryButton.includes('#164e3f'));
  assert.ok(LEKHO_THEME_TOKENS.secondaryButton.includes('#e6f4ea'));
  assert.ok(LEKHO_THEME_TOKENS.statusBadges.ready.includes('#e6f4ea'));
  assert.ok(!LEKHO_THEME_TOKENS.primaryButton.includes('indigo'));
  assert.ok(!LEKHO_THEME_TOKENS.primaryButton.includes('purple'));
});

test('normalizeAppTab maps size exchange and alteration aliases to canonical full-page routes', () => {
  assert.equal(normalizeAppTab('size_exchange'), 'size_exchange');
  assert.equal(normalizeAppTab('size-exchange'), 'size_exchange');
  assert.equal(normalizeAppTab('exchange'), 'size_exchange');
  assert.equal(normalizeAppTab('alteration'), 'alteration');
  assert.equal(normalizeAppTab('alterations'), 'alteration');
  assert.equal(normalizeAppTab('tailoring'), 'alteration');
  assert.equal(normalizeAppTab('home'), 'home');
  assert.equal(normalizeAppTab('unknown_route'), 'home');
  assert.ok(VALID_APP_TABS.has('size_exchange'));
  assert.ok(VALID_APP_TABS.has('alteration'));
});

test('parseTabFromLocation and buildUrlForTab support direct navigation, query params, pathname, and hash routes', () => {
  assert.deepEqual(parseTabFromLocation('?tab=size_exchange', '/'), {
    tab: 'size_exchange',
    subtab: undefined,
  });
  assert.deepEqual(parseTabFromLocation('?tab=size-exchange', '/'), {
    tab: 'size_exchange',
    subtab: undefined,
  });
  assert.deepEqual(parseTabFromLocation('', '/', '#/size-exchange'), {
    tab: 'size_exchange',
  });
  assert.deepEqual(parseTabFromLocation('', '/size-exchange', ''), {
    tab: 'size_exchange',
  });
  assert.deepEqual(parseTabFromLocation('?tab=alteration', '/'), {
    tab: 'alteration',
    subtab: undefined,
  });
  assert.deepEqual(parseTabFromLocation('', '/'), {
    tab: 'home',
  });

  assert.equal(buildUrlForTab('size_exchange'), '/?tab=size_exchange');
  assert.equal(buildUrlForTab('size-exchange'), '/?tab=size_exchange');
  assert.equal(buildUrlForTab('home'), '/');
  assert.equal(buildUrlForTab('settings', 'operators'), '/?tab=settings&subtab=operators');
});

test('sanitizeNavigationTabForShop permits size_exchange across clothing and sportswear shops while isolating jersey-only tabs', () => {
  const clothingShop = { category: 'clothing' };
  const jerseyShop = { category: 'jersey', featureFlags: { jerseyCustomization: true, teamBulkOrders: true } };

  assert.equal(sanitizeNavigationTabForShop('size_exchange', clothingShop), 'size_exchange');
  assert.equal(sanitizeNavigationTabForShop('exchange', clothingShop), 'size_exchange');
  assert.equal(sanitizeNavigationTabForShop('size_exchange', jerseyShop), 'size_exchange');
  assert.equal(sanitizeNavigationTabForShop('alterations', clothingShop), 'alteration');
  // Clothing shops still block jersey print-pipeline / team-bulk-matrix
  assert.equal(sanitizeNavigationTabForShop('pipeline', clothingShop), 'home');
  assert.equal(sanitizeNavigationTabForShop('team', clothingShop), 'home');

  // Exchange mode isolation remains intact
  assert.deepEqual(getAllowedExchangeModesForShop(clothingShop), ['inventory', 'custom']);
  assert.equal(getDefaultExchangeModeForShop(clothingShop), 'inventory');
  assert.deepEqual(getAllowedExchangeModesForShop(jerseyShop), ['jersey', 'inventory', 'custom']);
});
