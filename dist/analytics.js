'use strict';

(() => {
  const config = window.RABEN_ANALYTICS_CONFIG;
  const canonicalPath = /^\/(?:index\.html)?$/;
  if (!config || location.protocol !== 'https:' || location.port ||
      !config.productionHosts?.includes(location.hostname) || !canonicalPath.test(location.pathname)) return;

  const gaId = /^G-[A-Z0-9]{6,16}$/.test(config.ga4Id) && config.ga4Id;
  const clarityId = config.clarityPrivacyVerified === true &&
    /^[a-z0-9]{5,16}$/.test(config.clarityId) && config.clarityId;
  if (!gaId && !clarityId) return;

  // Only public campaign codes explicitly registered in analytics-config.js.
  const sources = new Set(['instagram', 'facebook', 'linkedin', 'google', 'whatsapp', 'email', 'github']);
  const mediums = new Set(['social', 'organic', 'referral', 'email', 'qr', 'cpc']);
  const campaigns = new Set(config.campaigns || []);
  const referrers = new Map([
    ['l.instagram.com', 'www.instagram.com'], ['instagram.com', 'www.instagram.com'],
    ['www.instagram.com', 'www.instagram.com'], ['l.facebook.com', 'www.facebook.com'],
    ['m.facebook.com', 'www.facebook.com'], ['www.facebook.com', 'www.facebook.com'],
    ['facebook.com', 'www.facebook.com'], ['www.linkedin.com', 'www.linkedin.com'],
    ['linkedin.com', 'www.linkedin.com'], ['www.google.com', 'www.google.com'],
    ['www.google.co.il', 'www.google.co.il'], ['www.bing.com', 'www.bing.com'],
    ['github.com', 'github.com']
  ]);
  const allowedHashes = new Set([
    '', '#top', '#main-content', '#contact', '#websites', '#about', '#projects', '#questions',
    '#story-ceramics', '#story-technician', '#story-study', '#story-bakery',
    '#story-community', '#story-hiking', '#story-guitar', '#story-volunteer',
    '#solution-website', '#solution-tool', '#solution-product'
  ]);

  const entry = new URL(location.href);
  const page = new URL('/', entry.origin);
  for (const [key, allowed] of [['utm_source', sources], ['utm_medium', mediums], ['utm_campaign', campaigns]]) {
    const values = entry.searchParams.getAll(key);
    if (values.length === 1 && /^[a-z0-9_-]{1,40}$/.test(values[0]) && allowed.has(values[0])) {
      page.searchParams.set(key, values[0]);
    }
  }
  let entryReferrer;
  try { entryReferrer = new URL(document.referrer); } catch { /* Direct or unavailable. */ }
  const referrerHost = entryReferrer?.protocol === 'https:' && !entryReferrer.port &&
    !entryReferrer.username && !entryReferrer.password && referrers.get(entryReferrer.hostname);
  const referrerOrigin = referrerHost ? 'https://' + referrerHost + '/' : '';
  const pageContext = {
    page_location: page.href,
    page_referrer: referrerOrigin,
    ignore_referrer: !referrerOrigin,
    page_title: 'RABEN'
  };
  function claritySafe() {
    const safeReferrer = !document.referrer || (entryReferrer?.protocol === 'https:' &&
      !entryReferrer.port && !entryReferrer.username && !entryReferrer.password &&
      (referrers.has(entryReferrer.hostname) || config.productionHosts.includes(entryReferrer.hostname)) &&
      canonicalPath.test(entryReferrer.pathname) && !entryReferrer.search &&
      allowedHashes.has(entryReferrer.hash));
    return safeReferrer && canonicalPath.test(location.pathname) && !location.search &&
      allowedHashes.has(location.hash);
  }

  const storageKey = 'raben:analytics-preferences:v1';
  const choices = new Set(['none', 'analytics', 'recording', 'both']);
  const ageLimit = 180 * 24 * 60 * 60 * 1000;
  const gaDisable = 'ga-disable-' + gaId;
  const denied = {
    analytics_storage: 'denied', ad_storage: 'denied',
    ad_user_data: 'denied', ad_personalization: 'denied'
  };
  const clarityCookies = { analytics_Storage: 'granted', ad_Storage: 'denied' };
  let choice;
  let gaLoaded = false;
  let clarityRequested = false;
  let clarityStopped = false;
  let sectionObserver;
  const seenSections = new Set();
  if (gaId) window[gaDisable] = true;

  function readChoice() {
    if (navigator.globalPrivacyControl === true) return 'none';
    try {
      const saved = JSON.parse(window.localStorage.getItem(storageKey));
      if (saved && choices.has(saved.choice) && Number.isFinite(saved.at) &&
          saved.at <= Date.now() && Date.now() - saved.at < ageLimit) return saved.choice;
    } catch { /* Never treat storage failure as consent. */ }
  }
  function functionTag(src, id, onload) {
    const script = document.createElement('script');
    script.id = id;
    script.async = true;
    script.referrerPolicy = 'no-referrer';
    if (onload) script.addEventListener('load', onload, { once: true });
    script.src = src;
    document.head.append(script);
  }
  function ga() {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(arguments);
  }
  function allowGA() { return gaId && (choice === 'analytics' || choice === 'both'); }
  function allowClarity() {
    return clarityId && (choice === 'recording' || choice === 'both') && claritySafe();
  }
  function send(name, parameters = {}) {
    if (!allowGA() || !gaLoaded) return;
    ga('event', name, { ...parameters, ...pageContext, send_to: gaId });
  }
  function observeSections() {
    if (!('IntersectionObserver' in window)) return;
    const sections = new Map([
      [document.querySelector('.intro'), 'intro'],
      [document.getElementById('websites'), 'examples'],
      [document.getElementById('about'), 'process'],
      [document.getElementById('projects'), 'portfolio'],
      [document.getElementById('questions'), 'faq'],
      [document.querySelector('.journey-contact'), 'closing_contact']
    ]);
    sectionObserver ||= new IntersectionObserver(entries => {
      if (!allowGA()) return;
      for (const entry of entries) {
        const sectionId = sections.get(entry.target);
        if (!entry.isIntersecting || entry.intersectionRatio < .1 || entry.target.hidden || seenSections.has(sectionId)) continue;
        seenSections.add(sectionId);
        send('section_view', { section_id: sectionId });
        sectionObserver.unobserve(entry.target);
      }
    }, { threshold: .1 });
    for (const [node, sectionId] of sections) {
      if (node && !seenSections.has(sectionId)) sectionObserver.observe(node);
    }
  }
  function startGa() {
    window[gaDisable] = false;
    if (gaLoaded) {
      ga('consent', 'update', { ...denied, analytics_storage: 'granted' });
      observeSections();
      return;
    }
    gaLoaded = true;
    ga('consent', 'default', denied);
    ga('consent', 'update', { ...denied, analytics_storage: 'granted' });
    ga('js', new Date());
    ga('set', { ...pageContext, ads_data_redaction: true, url_passthrough: false });
    ga('config', gaId, {
      ...pageContext, send_page_view: false, cookie_domain: location.hostname,
      allow_google_signals: false, allow_ad_personalization_signals: false
    });
    send('page_view');
    observeSections();
    functionTag('https://www.googletagmanager.com/gtag/js?id=' + gaId, 'raben-google-analytics');
  }
  function startClarity() {
    if (clarityRequested) return;
    clarityRequested = true;
    window.clarity = window.clarity || function () {
      (window.clarity.q = window.clarity.q || []).push(arguments);
    };
    // Explicit opt-in on the site, project-side Consent Mode ON, ads always denied.
    window.clarity('consentv2', clarityCookies);
    functionTag('https://www.clarity.ms/tag/' + clarityId, 'raben-microsoft-clarity', () => {
      if (clarityStopped || !allowClarity()) {
        window.clarity('stop');
      }
    });
  }
  function clearCookies(pattern) {
    for (const cookie of document.cookie.split(';')) {
      const name = cookie.split('=')[0].trim();
      if (!pattern.test(name)) continue;
      const removal = name + '=; Max-Age=0; Path=/; Secure; SameSite=Lax';
      document.cookie = removal;
      document.cookie = removal + '; Domain=' + location.hostname;
    }
  }
  function stopClarity() {
    if (clarityRequested && !clarityStopped) {
      clarityStopped = true;
      // ConsentV2 denied alone may start cookieless capture; stop in the same task.
      window.clarity('consentv2', { analytics_Storage: 'denied', ad_Storage: 'denied' });
      window.clarity('stop');
      clearCookies(/^_cl(?:ck|sk)$/);
    }
  }
  function apply(next) {
    choice = next;
    if (allowGA()) startGa();
    else if (gaId) {
      window[gaDisable] = true;
      sectionObserver?.disconnect();
      if (gaLoaded) ga('consent', 'update', denied);
      if (choice) clearCookies(/^_ga(?:_[A-Z0-9]+)?$/i);
    }
    if (allowClarity()) startClarity();
    else stopClarity();
  }

  const topic = document.getElementById('kind');
  const services = ['consultation', 'website', 'business_tool', 'app', 'partnership'];
  const service = () => services[topic?.selectedIndex] || 'consultation';
  const galleryServices = {
    ceramics: 'website', technician: 'business_tool', study: 'app',
    bakery: 'website', community: 'business_tool', hiking: 'app',
    guitar: 'website', volunteer: 'business_tool'
  };
  document.addEventListener('click', event => {
    if (!event.isTrusted || !(event.target instanceof Element)) return;
    const control = event.target.closest('a, button[data-raben-cta]');
    if (!control) return;
    if (control.matches('[data-gallery-cta]')) {
      const story = document.getElementById('story-gallery')?.dataset.story;
      if (Object.hasOwn(galleryServices, story)) {
        send('service_interest', { service_type: galleryServices[story], placement: 'gallery' });
      }
      return;
    }
    const href = control.getAttribute('href') || '';
    const id = control.dataset.rabenCta;
    const placements = ['hero', 'fallback', 'footer'];
    const placement = placements.includes(control.dataset.rabenPlacement)
      ? control.dataset.rabenPlacement : 'other';
    let channel;
    const tagged = control.dataset.rabenChannel;
    if (tagged === 'email' && href.startsWith('mailto:')) channel = 'email';
    else if (tagged === 'phone' && href.startsWith('tel:')) channel = 'phone';
    else if (control.hasAttribute('data-instagram')) channel = 'instagram';
    else if (tagged === 'whatsapp') {
      try {
        const target = new URL(href, location.origin);
        if (target.protocol === 'whatsapp:' || (target.protocol === 'https:' &&
            ['wa.me', 'api.whatsapp.com', 'web.whatsapp.com'].includes(target.hostname))) channel = 'whatsapp';
      } catch { /* An unsupported link is not a contact event. */ }
    }
    if (channel) send('contact_click', { contact_channel: channel, placement });
    else if (['header_contact', 'closing_contact', 'submit_callback', 'example_contact'].includes(id)) {
      send('cta_click', { cta_id: id });
    }
  }, true);
  topic?.addEventListener('change', event => {
    if (event.isTrusted) send('service_interest', { service_type: service(), placement: 'contact_form' });
  });
  document.addEventListener('raben:lead-accepted', () => {
    send('generate_lead', { method: 'callback_form', service_type: service() });
  });

  const panel = document.getElementById('analytics-preferences');
  const opener = document.getElementById('analytics-preferences-toggle');
  opener.hidden = false;
  function togglePanel(open) {
    panel.hidden = !open;
    opener.setAttribute('aria-expanded', String(open));
  }
  let focusOpener = false;
  opener.addEventListener('click', () => {
    focusOpener = true;
    togglePanel(true);
    panel.querySelector('button').focus();
  });
  if (navigator.globalPrivacyControl === true) {
    panel.querySelector('[data-raben-consent-actions]').hidden = true;
    panel.querySelector('[data-raben-gpc]').hidden = false;
    panel.tabIndex = -1;
    opener.addEventListener('click', () => panel.focus());
  } else {
    panel.querySelector('[data-raben-consent="analytics"]').hidden = !gaId;
    panel.querySelector('[data-raben-consent="recording"]').hidden = !clarityId || !!gaId;
    panel.querySelector('[data-raben-consent="both"]').hidden = !gaId || !clarityId;
    panel.addEventListener('click', event => {
      const next = event.target.closest('[data-raben-consent]')?.dataset.rabenConsent;
      if (!choices.has(next)) return;
      try { window.localStorage.setItem(storageKey, JSON.stringify({ choice: next, at: Date.now() })); }
      catch { /* In this case the choice applies only to this page. */ }
      apply(next);
      togglePanel(false);
      if (focusOpener) opener.focus();
      focusOpener = false;
    });
  }
  function closePanel() {
    togglePanel(false);
    opener.focus();
    focusOpener = false;
  }
  panel.querySelector('[data-raben-consent-close]').addEventListener('click', closePanel);
  panel.addEventListener('keydown', event => { if (event.key === 'Escape') closePanel(); });
  if (!gaId) panel.querySelector('[data-raben-ga-note]').hidden = true;
  if (!clarityId) panel.querySelector('[data-raben-clarity-note]').hidden = true;
  const prior = readChoice();
  apply(prior);
  togglePanel(!prior);

  // Honor revocation across tabs; unknown fragments end Clarity instead of recording them.
  window.addEventListener('storage', event => {
    if (event.key !== storageKey && event.key !== null) return;
    apply(readChoice());
    togglePanel(!choice);
  });
  const onLocationChange = () => { if (!allowClarity()) stopClarity(); };
  window.addEventListener('hashchange', onLocationChange);
  window.addEventListener('popstate', onLocationChange);
})();
