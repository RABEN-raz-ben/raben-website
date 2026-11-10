// Decorative SVGs share the local symbol set in index.html; labels stay in text.
const icon = name => '<svg class="icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><use href="#icon-' + name + '"></use></svg>';
const content = window.RABEN_CONTENT;
const el = (tag, text, className) => { const node=document.createElement(tag); node.textContent=text; if(className) node.className=className; return node; };
document.getElementById('about-text').textContent=content.about;
document.getElementById('year').textContent=new Date().getFullYear();
if(content.capabilities.length){const list=el('div','','capability-list');content.capabilities.forEach((item,i)=>{const card=el('article','','capability');card.append(el('span',String(i+1).padStart(2,'0'),'number'),el('h3',item.title),el('p',item.description));list.append(card)});document.getElementById('capabilities').append(list)}
if (content.offering) {
  document.getElementById('websites-title').textContent = content.offering.title;
  document.getElementById('website-description').textContent = content.offering.description;
}
const solutionList = document.getElementById('solution-list');
if (solutionList) {
  const solutionCards = content.services.map((service, index) => {
    const card = el('article', '', 'solution-card solution-' + service.id);
    card.id = 'solution-' + service.id;
    const visual = el('img', '', 'solution-visual');
    visual.src = 'assets/service-' + service.id + '.svg';
    visual.alt = '';
    visual.width = 480;
    visual.height = 220;
    visual.loading = 'lazy';
    const example = el('div', '', 'solution-example');
    example.append(el('strong', 'למשל'), el('span', service.example));
    const includes = el('ul', '', 'solution-includes');
    service.includes.forEach(item => includes.append(el('li', item)));
    const link = el('a', 'איך זה יכול להיראות', 'solution-link');
    link.href = '#playground';
    link.dataset.exampleLink = service.id;
    link.insertAdjacentHTML('beforeend', icon('arrow-left'));
    card.append(
      visual,
      el('span', String(index + 1).padStart(2, '0'), 'solution-number'),
      el('p', service.need, 'solution-need'),
      el('h3', service.title),
      el('p', service.description, 'solution-description'),
      example, includes, link
    );
    return card;
  });
  solutionList.replaceChildren(...solutionCards);
}

const projectSection = document.getElementById('projects');
const projectList = document.getElementById('project-list');
let projectExpiryTimer;
let projectRequest = 0;
function hideProjects() {
  clearTimeout(projectExpiryTimer);
  projectList.replaceChildren();
  projectSection.hidden = true;
  document.querySelectorAll('[data-project-nav]').forEach(link => link.hidden = true);
}
async function loadProjects() {
  const request = ++projectRequest;
  hideProjects();
  try {
    const response = await fetch('/api/projects', { signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error('Project verification unavailable');
    const result = await response.json();
    if (request !== projectRequest) return;
    const expiresAt = Date.parse(result.expiresAt);
    if (!Array.isArray(result.projects) || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) throw new Error('Invalid project verification');
    result.projects.forEach(project => {
      const url = new URL(project.url);
      if (url.protocol !== 'https:' || url.username || url.password) return;
      const card = el('a', '', 'project-card');
      card.href = url.href;
      card.target = '_blank';
      card.rel = 'noopener noreferrer';
      card.setAttribute('aria-label', project.title + ' — לצפייה באתר (בטאב חדש)');
      const media = el('div', 'RABEN / BUILD & EXPLORE', 'project-media');
      if (project.image && project.image.startsWith('/assets/')) {
        const img = document.createElement('img');
        img.src = project.image;
        img.alt = 'צילום מסך של ' + project.title;
        img.loading = 'lazy';
        img.onerror = () => img.remove();
        media.append(img);
      }
      const body = el('div', '', 'project-body');
      body.append(el('span', project.category, 'project-category'));
      if (project.concept) body.append(el('span', 'דוגמת קונספט', 'concept-label'));
      const projectLink = el('span', 'לצפייה באתר', 'project-link');
      projectLink.insertAdjacentHTML('beforeend', icon('arrow-up-right'));
      body.append(el('h3', project.title), el('p', project.description), projectLink);
      card.append(media, body);
      projectList.append(card);
    });
    projectExpiryTimer = setTimeout(() => { hideProjects(); loadProjects(); }, Math.min(expiresAt - Date.now(), 300000));
    if (projectList.children.length) {
      projectSection.hidden = false;
      document.querySelectorAll('[data-project-nav]').forEach(link => link.hidden = false);
    }
  } catch { if (request === projectRequest) { hideProjects(); projectExpiryTimer = setTimeout(loadProjects, 300000); } }
}
loadProjects();
// Revalidate after returning to the tab; no cross-origin browser probes.
document.addEventListener('visibilitychange', () => { if (!document.hidden) loadProjects(); });
const form = document.getElementById('brief-form');
const status = document.getElementById('form-status');
const phoneField = document.getElementById('phone');
phoneField.oninput = () => phoneField.setCustomValidity('');
let sending = false;
form.onsubmit = async event => {
  event.preventDefault();
  if (sending) return;
  if (form.classList.contains('conversation-form') && briefStep < 2) { advanceBrief(); return; }
  const phone = phoneField.value.trim();
  if (!/^\+?[0-9\s()-]+$/.test(phone) || !/^\d{8,15}$/.test(phone.replace(/[^0-9]/g, ''))) {
    phoneField.setCustomValidity('הזינו מספר טלפון תקין כדי שנוכל לחזור אליכם.');
    phoneField.reportValidity();
    return;
  }
  phoneField.setCustomValidity('');
  if (!form.reportValidity()) return;
  const payload = {
    name: document.getElementById('name').value.trim(),
    phone,
    project_type: document.getElementById('kind').value,
    message: document.getElementById('idea').value.trim(),
    _subject: 'פנייה חדשה מאתר RABEN',
    _template: 'table',
    _honey: form.elements.namedItem('_honey').value
  };
  if (!payload.name || !payload.message) {
    status.textContent = 'מלאו שם ותיאור קצר של הפרויקט.';
    return;
  }
  sending = true;
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  briefBack.disabled = true;
  briefNext.disabled = true;
  form.setAttribute('aria-busy', 'true');
  document.getElementById('contact-fallback').hidden = true;
  status.textContent = 'שולחים את הפנייה…';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch('https://formsubmit.co/ajax/raben10studio@gmail.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    const result = await response.json();
    if (!response.ok || ![true, 'true'].includes(result.success)) throw new Error('Submission rejected');
    status.textContent = 'הפנייה נשלחה ל־RABEN. תודה! נחזור אליכם למספר שהשארתם.';
    form.reset();
  } catch {
    document.getElementById('instagram-brief').value = `היי RABEN, אשמח לשמוע עוד על בניית פרויקט.\nשם: ${payload.name}\nטלפון: ${payload.phone}\nסוג הפרויקט: ${payload.project_type}\n\n${payload.message}`;
    document.getElementById('contact-fallback').hidden = false;
    status.textContent = 'לא הצלחנו לאשר שהפנייה נשלחה. הפרטים נשארו בטופס; אפשר לנסות שוב או לפנות אלינו באינסטגרם.';
  } finally {
    clearTimeout(timer);
    sending = false;
    button.disabled = false;
    briefBack.disabled = false;
    briefNext.disabled = false;
    form.removeAttribute('aria-busy');
  }
};

document.getElementById('instagram-fallback-link').onclick = () => {
  const message = document.getElementById('instagram-brief');
  const copyStatus = document.getElementById('instagram-copy-status');
  try {
    navigator.clipboard.writeText(message.value).then(() => {
      copyStatus.textContent = 'הפרטים הועתקו. הדביקו את ההודעה בשיחה באינסטגרם ולחצו על שליחה.';
    }).catch(() => {
      message.focus();
      message.select();
      copyStatus.textContent = 'לא הצלחנו להעתיק אוטומטית. העתיקו את ההודעה מהשדה והדביקו אותה באינסטגרם.';
    });
  } catch {
    message.focus();
    message.select();
    copyStatus.textContent = 'העתיקו את ההודעה מהשדה והדביקו אותה באינסטגרם.';
  }
};


// The playground is an explicitly labeled design study, separate from verified work.
const preview = document.getElementById('site-preview');
document.querySelectorAll('.device-controls button').forEach(button => {
  button.addEventListener('click', () => {
    preview.dataset.device = button.dataset.device;
    document.querySelectorAll('.device-controls button').forEach(control => {
      control.setAttribute('aria-pressed', String(control === button));
    });
  });
});
document.querySelectorAll('.color-controls button').forEach(button => {
  button.addEventListener('click', () => {
    preview.style.setProperty('--preview-accent', button.dataset.color);
    document.querySelectorAll('.color-controls button').forEach(control => {
      control.setAttribute('aria-pressed', String(control === button));
    });
  });
});

// Optional enhancements stay scoped to their own controls and respect motion preferences.
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const briefIntents = document.getElementById('brief-intents');
const briefKind = document.getElementById('kind');
const briefSelection = document.getElementById('brief-selection');
const intentButtons = briefIntents ? briefIntents.querySelectorAll('[data-brief-kind]') : [];
function syncBriefIntent() {
  if (!briefKind) return;
  intentButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.briefKind === briefKind.value)));
  if (briefSelection) briefSelection.textContent = 'בחרתם: ' + briefKind.value;
}
intentButtons.forEach(button => {
  button.addEventListener('click', () => {
    if (sending || !briefKind || !Array.from(briefKind.options).some(option => option.value === button.dataset.briefKind)) return;
    briefKind.value = button.dataset.briefKind;
    syncBriefIntent();
    showBriefStep(0, false);
    const ideaField = document.getElementById('idea');
    ideaField?.focus({ preventScroll: true });
    ideaField?.scrollIntoView({ behavior: reducedMotion.matches ? 'instant' : 'smooth', block: 'center' });
  });
});
briefKind?.addEventListener('change', syncBriefIntent);
// Form resets apply default values after the reset event has been dispatched.
form.addEventListener('reset', () => queueMicrotask(syncBriefIntent));


// Examples demonstrate possible client needs; they are separate from verified work.
const exampleChoices = document.querySelectorAll('.example-buttons [data-example-choice]');
const examplePanels = document.querySelectorAll('[data-example-panel]');
const exampleDescription = document.getElementById('example-description');
const exampleKindLink = document.getElementById('example-kind-link');
const exampleArt = document.querySelector('#playground .hero-art');
function selectExample(id) {
  const service = content.services.find(item => item.id === id);
  if (!service) return;
  exampleChoices.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.exampleChoice === id)));
  examplePanels.forEach(panel => { panel.hidden = panel.dataset.examplePanel !== id; });
  if (exampleDescription) exampleDescription.textContent = service.description;
  if (exampleKindLink) {
    exampleKindLink.dataset.exampleKind = service.kind;
    exampleKindLink.textContent = 'נדבר על ' + service.title + ' ←';
  }
  if (exampleArt) exampleArt.dataset.example = id;
}
exampleChoices.forEach(button => button.addEventListener('click', () => selectExample(button.dataset.exampleChoice)));
document.querySelectorAll('[data-example-link]').forEach(link => {
  link.addEventListener('click', () => selectExample(link.dataset.exampleLink));
});
exampleKindLink?.addEventListener('click', () => {
  if (sending) return;
  const kind = exampleKindLink.dataset.exampleKind;
  if (!briefKind || !Array.from(briefKind.options).some(option => option.value === kind)) return;
  briefKind.value = kind;
  syncBriefIntent();
  showBriefStep(0, false);
});
if (exampleChoices.length) {
  const activeExample = Array.from(exampleChoices).find(button => button.getAttribute('aria-pressed') === 'true');
  selectExample(activeExample?.dataset.exampleChoice || 'website');
}

const revealSections = Array.from(document.querySelectorAll('[data-reveal]'));
let revealObserver;
function revealSection(section) {
  section.classList.add('is-visible');
  revealObserver?.unobserve(section);
}
if (!reducedMotion.matches && 'IntersectionObserver' in window) {
  revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => { if (entry.isIntersecting) revealSection(entry.target); });
  }, { threshold: 0, rootMargin: '0px 0px -35px 0px' });
  revealSections.forEach(section => {
    // Content already on screen, including anchor targets, remains visible immediately.
    if (section.getBoundingClientRect().top >= window.innerHeight) {
      section.classList.add('reveal-ready');
      revealObserver.observe(section);
    } else revealSection(section);
  });
  document.addEventListener('focusin', event => {
    const section = event.target.closest('[data-reveal]');
    if (section) revealSection(section);
  });
}
reducedMotion.addEventListener('change', event => {
  if (event.matches) {
    revealSections.forEach(revealSection);
    revealObserver?.disconnect();
  }
});

const readingProgress = document.getElementById('reading-progress');
if (readingProgress) {
  let progressFrame = 0;
  function updateReadingProgress() {
    progressFrame = 0;
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    const fraction = scrollable > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollable)) : 0;
    readingProgress.style.transform = 'scaleX(' + fraction + ')';
  }
  function scheduleReadingProgress() {
    if (!progressFrame) progressFrame = requestAnimationFrame(updateReadingProgress);
  }
  window.addEventListener('scroll', scheduleReadingProgress, { passive: true });
  window.addEventListener('resize', scheduleReadingProgress, { passive: true });
  window.addEventListener('load', scheduleReadingProgress, { once: true });
  if ('ResizeObserver' in window) new ResizeObserver(scheduleReadingProgress).observe(document.body);
  scheduleReadingProgress();
}

const heroSculpture = document.getElementById('hero-sculpture');
const heroVisual = heroSculpture?.closest('.hero-visual');
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
if (heroSculpture && heroVisual) {
  let tiltFrame = 0;
  let tiltX = 0;
  let tiltY = 0;
  function resetHeroTilt() {
    cancelAnimationFrame(tiltFrame);
    tiltFrame = 0;
    heroSculpture.style.setProperty('--tilt-x', '0deg');
    heroSculpture.style.setProperty('--tilt-y', '0deg');
  }
  heroVisual.addEventListener('pointermove', event => {
    if (reducedMotion.matches || !finePointer.matches || event.pointerType === 'touch') return;
    const bounds = heroVisual.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    tiltX = Math.max(-1, Math.min(1, (event.clientY - bounds.top) / bounds.height * 2 - 1)) * -4;
    tiltY = Math.max(-1, Math.min(1, (event.clientX - bounds.left) / bounds.width * 2 - 1)) * 4;
    if (!tiltFrame) tiltFrame = requestAnimationFrame(() => {
      tiltFrame = 0;
      heroSculpture.style.setProperty('--tilt-x', tiltX.toFixed(2) + 'deg');
      heroSculpture.style.setProperty('--tilt-y', tiltY.toFixed(2) + 'deg');
    });
  }, { passive: true });
  heroVisual.addEventListener('pointerleave', resetHeroTilt);
  heroVisual.addEventListener('pointercancel', resetHeroTilt);
  reducedMotion.addEventListener('change', resetHeroTilt);
  finePointer.addEventListener('change', resetHeroTilt);
}

// Animate native disclosures in both directions; preserve keyboard and no-JS behavior.
document.querySelectorAll('.faq details').forEach(details => {
  const summary = details.querySelector('summary');
  const answer = details.querySelector('.faq-answer');
  let animation;
  let expanded = details.open;
  summary.addEventListener('click', event => {
    if (reducedMotion.matches || !answer.animate) return;
    event.preventDefault();
    expanded = !expanded;
    const from = details.open ? answer.getBoundingClientRect().height : 0;
    const opacity = details.open ? getComputedStyle(answer).opacity : '0';
    animation?.cancel();
    details.open = true;
    const to = expanded ? answer.scrollHeight : 0;
    animation = answer.animate([
      { height: from + 'px', opacity, transform: 'translateY(' + (from ? 0 : -8) + 'px)' },
      { height: to + 'px', opacity: expanded ? 1 : 0, transform: 'translateY(' + (expanded ? 0 : -8) + 'px)' }
    ], { duration: 360, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'both' });
    animation.onfinish = () => {
      details.open = expanded;
      animation.cancel();
      animation = null;
    };
  });
  details.addEventListener('toggle', () => { if (!animation) expanded = details.open; });
  reducedMotion.addEventListener('change', () => {
    if (animation) { animation.cancel(); animation = null; details.open = expanded; }
  });
});

// Derive the active section from its position, including sections without a nav link.
// Passive listeners schedule one frame per scroll; no continuous animation loop.
const navigationLinks = Array.from(document.querySelectorAll('.header nav a'));
const navigationSections = Array.from(document.querySelectorAll('main > section'));
let navigationFrame = 0;
function updateNavigation() {
  navigationFrame = 0;
  const marker = (document.querySelector('.header')?.getBoundingClientRect().bottom || 0) + 90;
  let current = '';
  navigationSections.forEach(section => {
    if (!section.hidden && section.getBoundingClientRect().top <= marker) current = section.id;
  });
  navigationLinks.forEach(link => {
    if (current && link.hash === '#' + current) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  });
}
function scheduleNavigation() {
  if (!navigationFrame) navigationFrame = requestAnimationFrame(updateNavigation);
}
window.addEventListener('scroll', scheduleNavigation, { passive: true });
window.addEventListener('resize', scheduleNavigation, { passive: true });
window.addEventListener('load', scheduleNavigation, { once: true });
scheduleNavigation();

// A short conversation, progressively enhanced from the regular accessible form.
let briefStep = 0;
const briefPages = [];
const briefSubmit = form.querySelector('button[type="submit"]');
const conversationHeader = el('div', '', 'conversation-header');
const conversationProgress = el('div', '', 'conversation-progress');
conversationProgress.setAttribute('role', 'group');
conversationProgress.setAttribute('aria-label', 'התקדמות הפנייה');
const conversationTitle = el('h3', '', 'conversation-title');
conversationTitle.tabIndex = -1;
const conversationHint = el('p', '', 'conversation-hint');
conversationHeader.append(conversationProgress, conversationTitle, conversationHint);
form.querySelector('.form-heading').after(conversationHeader);
[['idea','kind'], ['name','phone']].forEach(ids => {
  const page = el('div', '', 'conversation-page');
  ids.forEach(id => {
    page.append(form.querySelector('label[for="' + id + '"]'), document.getElementById(id));
  });
  briefPages.push(page);
  conversationHeader.after(page);
});
const briefReview = el('div', '', 'conversation-review');
briefPages.push(briefReview);
conversationHeader.after(briefReview);
const conversationNavigation = el('div', '', 'conversation-navigation');
const briefBack = el('button', '→ חזרה', 'conversation-back');
briefBack.type = 'button';
const briefNext = el('button', '', 'button primary conversation-next');
briefNext.append(el('span', 'ממשיכים'));
briefNext.insertAdjacentHTML('beforeend', icon('arrow-left'));
briefNext.type = 'button';
briefNext.addEventListener('click', advanceBrief);
briefBack.addEventListener('click', () => showBriefStep(briefStep - 1));
conversationNavigation.append(briefBack, briefNext);
briefSubmit.before(conversationNavigation);
form.classList.add('conversation-form');
// Native validation is invoked explicitly per visible step, so Enter never tries
// to focus a required field on a later, hidden page. The no-JS form stays native.
form.noValidate = true;
form.addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.isComposing && event.target.matches('input') && briefStep < 2) {
    event.preventDefault();
    if (!sending) advanceBrief();
  }
});
const briefStepCopy = [
  ['מה נבנה יחד?', 'כמה מילים על העסק, הרעיון או משהו שהייתם רוצים שיעבוד טוב יותר.'],
  ['נעים להכיר. ואיך קוראים לכם?', 'נשאר רק לדעת למי לחזור.'],
  ['זה הכיוון שלכם. שולחים?', 'הכול כאן? אפשר לחזור ולדייק, או לשלוח אלינו.']
];
function showBriefStep(step, focus = true) {
  if (!briefPages.length || sending) return;
  briefStep = Math.max(0, Math.min(2, step));
  briefPages.forEach((page, index) => { page.hidden = index !== briefStep; });
  conversationTitle.textContent = briefStepCopy[briefStep][0];
  conversationHint.textContent = briefStepCopy[briefStep][1];
  conversationProgress.replaceChildren(...briefStepCopy.map((copy, index) => {
    const mark = el('span', index < briefStep ? '✓' : String(index + 1));
    mark.classList.toggle('current', index === briefStep);
    mark.classList.toggle('done', index < briefStep);
    if (index === briefStep) mark.setAttribute('aria-current', 'step');
    return mark;
  }));
  conversationProgress.setAttribute('aria-label', 'שלב ' + (briefStep + 1) + ' מתוך 3');
  briefBack.hidden = briefStep === 0;
  briefNext.hidden = briefStep === 2;
  briefNext.querySelector('span').textContent = briefStep === 0 ? 'ממשיכים להיכרות' : 'רואים את הסיכום';
  briefSubmit.hidden = briefStep !== 2;
  if (briefStep === 2) {
    briefReview.replaceChildren(
      el('span', 'היי רז ובן,', 'review-greeting'),
      el('p', 'אני ' + document.getElementById('name').value.trim() + '. ' + (briefKind.selectedIndex === 0 ? 'אשמח לחשוב יחד על הכיוון.' : 'אשמח לדבר על ' + briefKind.value + '.')),
      el('blockquote', document.getElementById('idea').value.trim()),
      el('p', 'אפשר לחזור אליי ב־' + phoneField.value.trim(), 'review-phone')
    );
    briefSubmit.firstChild.textContent = 'בואו נהפוך את זה למשהו ← ';
  }
  if (focus) conversationTitle.focus({ preventScroll: true });
}
function advanceBrief() {
  const page = briefPages[briefStep];
  if (!page || sending) return;
  if (briefStep === 1) {
    const phone = phoneField.value.trim();
    phoneField.setCustomValidity(/^\+?[0-9\s()-]+$/.test(phone) && /^\d{8,15}$/.test(phone.replace(/[^0-9]/g, '')) ? '' : 'הזינו מספר טלפון תקין כדי שנוכל לחזור אליכם.');
  }
  const fields = Array.from(page.querySelectorAll('input,textarea,select'));
  const invalid = fields.find(field => !field.checkValidity());
  if (invalid) { invalid.reportValidity(); return; }
  const idea = document.getElementById('idea');
  const name = document.getElementById('name');
  const blank = briefStep === 0 && !idea.value.trim() ? idea : briefStep === 1 && !name.value.trim() ? name : null;
  if (blank) { blank.setCustomValidity('כתבו כאן כמה מילים כדי שנוכל להמשיך.'); blank.reportValidity(); return; }
  showBriefStep(briefStep + 1);
}
['idea','name'].forEach(id => document.getElementById(id).addEventListener('input', event => event.target.setCustomValidity('')));
form.addEventListener('invalid', event => {
  const pageIndex = briefPages.findIndex(page => page.contains(event.target));
  if (pageIndex >= 0 && pageIndex !== briefStep) showBriefStep(pageIndex, false);
}, true);
form.addEventListener('reset', () => queueMicrotask(() => showBriefStep(0, false)));
showBriefStep(0, false);
