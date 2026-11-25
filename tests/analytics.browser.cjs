// NODE_PATH can point to an existing Playwright installation. No vendor or form is contacted.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

const origin = 'https://raben-website.onrender.com';
const dist = path.resolve(__dirname, '../dist');
const type = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
const tagIds = { ga4Id: 'G-TESTONLY00', clarityId: 'testonly01',
  clarityPrivacyVerified: true, productionHosts: [new URL(origin).hostname], campaigns: ['launch'] };

async function setup(context, config = tagIds, responses = []) {
  const requests = [];
  const vendors = [];
  const errors = [];
  await context.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.hostname === 'formspree.io') {
      requests.push(request.postData());
      const result = responses.shift();
      if (!result || result === 'network') return route.abort();
      return route.fulfill({ status: result.status, json: result.json });
    }
    if (url.hostname === 'www.googletagmanager.com') {
      vendors.push('ga');
      return route.fulfill({ contentType: 'text/javascript', body: '' });
    }
    if (url.hostname === 'www.clarity.ms') {
      vendors.push('clarity');
      return route.fulfill({ contentType: 'text/javascript', body: '' });
    }
    if (url.origin !== origin && url.hostname !== 'preview.example') return route.abort();
    if (url.pathname === '/api/projects') return route.fulfill({ json: { projects: [] } });
    if (url.pathname === '/analytics-config.js' && config) {
      return route.fulfill({ contentType: 'text/javascript', body: 'window.RABEN_ANALYTICS_CONFIG=' + JSON.stringify(config) });
    }
    const file = path.resolve(dist, '.' + (url.pathname === '/' ? '/index.html' : url.pathname));
    if (!file.startsWith(dist + path.sep)) return route.abort();
    try { return await route.fulfill({ contentType: type[path.extname(file)], body: await fs.readFile(file) }); }
    catch { return route.fulfill({ status: 404, body: '' }); }
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  return { page, vendors, requests, errors };
}

function choice(page, key) { return page.locator('[data-raben-consent="' + key + '"]'); }
async function events(page, name) {
  return page.evaluate(name => (window.dataLayer || []).filter(a => a[0] === 'event' && (!name || a[1] === name))
    .map(a => ({ event: a[1], data: a[2] })), name);
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
  try {
    const basic = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 390, height: 844 } });
    const t = await setup(basic, tagIds, [
      { status: 200, json: { ok: false } }, 'network',
      { status: 400, json: { ok: true } }, { status: 200, json: { ok: true } }
    ]);
    await t.page.goto(origin + '/');
    assert(await choice(t.page, 'none').isVisible(), 'No consent dialog');
    assert.equal(await t.page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
    assert.deepEqual(t.vendors, [], 'Pre-consent vendor load');
    await choice(t.page, 'none').click();
    await t.page.reload();
    assert(!await choice(t.page, 'none').isVisible(), 'Decline not remembered');
    assert.deepEqual(t.vendors, [], 'Vendor request from declined visit');
    await t.page.locator('#analytics-preferences-toggle').click();
    await choice(t.page, 'analytics').click();
    await t.page.waitForFunction(() => !!document.getElementById('raben-google-analytics'));
    assert.equal((await events(t.page, 'page_view')).length, 1);
    assert.equal(await t.page.locator('#raben-microsoft-clarity').count(), 0);
    await t.page.locator('.site-header [data-raben-cta="header_contact"], [data-raben-cta="header_contact"]').first().click();
    assert.equal((await events(t.page, 'cta_click')).filter(e => e.data.cta_id === 'header_contact').length, 1);

    await t.page.locator('[data-gallery-cta]').click();
    const interests = await events(t.page, 'service_interest');
    assert.equal(interests.length, 1, 'Gallery and synthetic select change double counted');
    assert.equal(interests[0].data.service_type, 'website');
    await t.page.locator('#brief-extras').evaluate(node => { node.open = true; });
    await t.page.locator('#kind').press('ArrowDown');
    assert.equal(await t.page.locator('#kind').evaluate(el => el.selectedIndex), 2);
    assert.equal((await events(t.page, 'service_interest')).length, 2);
    await t.page.locator('#name').fill('Personal Name Marker');
    await t.page.locator('#phone').fill('0501234567');
    await t.page.locator('#idea').fill('Private Message Marker');
    await t.page.locator('#interest').fill('Private Interest Marker');
    const submit = t.page.locator('[data-raben-cta="submit_callback"]');
    for (let count = 1; count <= 3; count++) {
      await submit.click();
      await t.page.locator('#form-status[data-state="error"]').waitFor();
      assert.equal(t.requests.length, count);
      assert.deepEqual(await events(t.page, 'generate_lead'), []);
    }
    assert.equal(await t.page.locator('#email-fallback-link').getAttribute('href'), 'mailto:raben10studio@gmail.com');
    assert(await t.page.locator('#instagram-brief').evaluate(e => e.closest('[data-clarity-mask="true"]') !== null));
    assert((await t.page.locator('#instagram-brief').inputValue()).includes('Private Message Marker'));
    const navigation = await basic.newCDPSession(t.page);
    await navigation.send('Page.enable');
    let fallbackDraft;
    navigation.on('Page.frameRequestedNavigation', event => {
      if (event.url.startsWith('mailto:')) fallbackDraft = event.url;
    });
    await t.page.locator('#email-fallback-link').click();
    if (fallbackDraft) {
      assert.match(new URL(fallbackDraft).searchParams.get('body'), /Private Message Marker/);
    }
    assert.equal((await events(t.page, 'contact_click')).filter(e => e.data.contact_channel === 'email').length, 1);
    await t.page.locator('.hero-dm').click();
    assert.equal((await events(t.page, 'contact_click')).filter(e => e.data.contact_channel === 'instagram').length, 1);
    assert.equal((await events(t.page, 'generate_lead')).length, 0);
    await submit.click();
    await t.page.locator('#form-status[data-state="success"]').waitFor();
    const leads = await events(t.page, 'generate_lead');
    assert.equal(leads.length, 1);
    assert.equal(leads[0].data.service_type, 'business_tool', 'Service read after form reset');
    assert.equal(await t.page.locator('#phone').inputValue(), '');
    assert.equal(t.requests.length, 4);
    assert(t.requests.every(body => new URLSearchParams(body).get('message') === 'Private Message Marker'));
    assert(!/0501234567|Personal Name|Private Message|Private Interest|ig\.me|gmail\.com/.test(JSON.stringify(await events(t.page))));
    await t.page.locator('#analytics-preferences-toggle').click();
    await choice(t.page, 'none').click();
    assert(await t.page.evaluate(() => window['ga-disable-G-TESTONLY00']));
    await t.page.locator('[data-raben-cta="header_contact"]').click();
    assert.equal((await events(t.page, 'cta_click')).filter(e => e.data.cta_id === 'header_contact').length, 1);
    assert.deepEqual(t.errors, []);
    await basic.close();

    const both = await browser.newContext();
    const t2 = await setup(both, tagIds);
    // Unknown query + hash and full-path referrer fail closed for replay and are not passed to GA.
    await t2.page.goto(origin + '/?utm_source=linkedin&utm_medium=social&utm_campaign=launch&email=private%40test.local&utm_term=visiting-person#PrivateHash',
      { referer: 'https://www.linkedin.com/PrivateReferrer?token=private' });
    await choice(t2.page, 'both').click();
    assert.equal(await t2.page.locator('#raben-microsoft-clarity').count(), 0);
    assert.equal((await events(t2.page, 'page_view'))[0].data.page_location,
      origin + '/?utm_source=linkedin&utm_medium=social&utm_campaign=launch');
    assert.equal((await events(t2.page, 'page_view'))[0].data.page_referrer, 'https://www.linkedin.com/');
    await t2.page.goto(origin + '/#story-ceramics');
    await t2.page.waitForFunction(() => !!document.getElementById('raben-microsoft-clarity'));
    const launchClarity = await t2.page.evaluate(() => Array.from(window.clarity.q[0]));
    assert.deepEqual(launchClarity, ['consentv2', { analytics_Storage: 'granted', ad_Storage: 'denied' }]);
    const settings = await t2.page.evaluate(() => window.dataLayer.find(a => a[0] === 'config')[2]);
    assert(!settings.allow_google_signals && !settings.allow_ad_personalization_signals && !settings.send_page_view);
    await t2.page.locator('#analytics-preferences-toggle').click();
    await choice(t2.page, 'analytics').click();
    assert(await t2.page.evaluate(() => window.clarity.q.some(a => a[0] === 'stop')));
    assert.equal((await events(t2.page, 'page_view')).length, 1);

    // Unknown and personalized campaigns stay out of the outgoing URL.
    await t2.page.goto(origin + '/?utm_source=linkedin&utm_source=email&utm_medium=private&utm_campaign=personal-name#contact');
    assert.equal((await events(t2.page, 'page_view'))[0].data.page_location, origin + '/');
    assert.deepEqual(t2.errors, []);
    await both.close();

    const defaults = await browser.newContext();
    const t3 = await setup(defaults, null);
    await t3.page.goto(origin + '/');
    assert(!await t3.page.locator('#analytics-preferences-toggle').isVisible());
    assert.deepEqual(t3.vendors, []);
    assert.deepEqual(t3.errors, []);
    await defaults.close();

    const preview = await browser.newContext();
    const t4 = await setup(preview);
    await t4.page.goto('https://preview.example/');
    assert(!await t4.page.locator('#analytics-preferences-toggle').isVisible());
    assert.deepEqual(t4.vendors, []);
    assert.deepEqual(t4.errors, []);
    await preview.close();

    const gpc = await browser.newContext();
    await gpc.addInitScript(() => {
      Object.defineProperty(navigator, 'globalPrivacyControl', { configurable: true, value: true });
      localStorage.setItem('raben:analytics-preferences:v1', JSON.stringify({ choice: 'both', at: Date.now() }));
    });
    const t5 = await setup(gpc);
    await t5.page.goto(origin + '/');
    assert.deepEqual(t5.vendors, []);
    await t5.page.locator('#analytics-preferences-toggle').click();
    assert(await t5.page.locator('[data-raben-gpc]').isVisible());
    assert(!await choice(t5.page, 'both').isVisible());
    await gpc.close();

    console.log('Analytics browser assertions passed; all vendors and Formspree were intercepted.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
