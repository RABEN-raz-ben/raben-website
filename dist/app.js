'use strict';

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  element.className = className;
  if (text) element.textContent = text;
  return element;
}

function createProjectCard(project) {
  const url = new URL(project.url);
  if (url.protocol !== 'https:' || url.username || url.password) return null;

  const card = makeElement('a', 'project-card');
  card.href = url.href;
  card.target = '_blank';
  card.rel = 'noopener noreferrer';
  card.setAttribute('aria-label', project.title + ' — לצפייה באתר בחלון חדש');
  if (project.image?.startsWith('/assets/')) {
    const image = makeElement('img', 'project-media');
    image.src = project.image;
    image.alt = '';
    image.loading = 'lazy';
    image.addEventListener('error', () => image.remove(), { once: true });
    card.append(image);
  }
  const body = makeElement('div', 'project-body');
  body.append(makeElement('span', 'project-category', project.category));
  if (project.concept) body.append(makeElement('span', 'concept-label', 'דוגמה להמחשה'));
  const link = makeElement('span', 'project-link', 'לצפייה באתר ');
  const arrow = makeElement('span', 'icon icon-arrow-up-right');
  arrow.setAttribute('aria-hidden', 'true');
  link.append(arrow);
  body.append(
    makeElement('h3', 'project-title', project.title),
    makeElement('p', 'project-description', project.description),
    link
  );
  card.append(body);
  return card;
}

const projectSection = document.getElementById('projects');
const projectList = document.getElementById('project-list');
const projectLinks = document.querySelectorAll('[data-project-nav]');
const refreshInterval = 300000;
let projectTimer;
let latestRequest = 0;

function showProjects(cards) {
  projectList.replaceChildren(...cards);
  projectSection.hidden = cards.length === 0;
  projectLinks.forEach(link => { link.hidden = projectSection.hidden; });
}

async function loadProjects() {
  const request = ++latestRequest;
  clearTimeout(projectTimer);
  showProjects([]);
  try {
    const response = await fetch('/api/projects', { signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error('Project verification unavailable');
    const result = await response.json();
    if (request !== latestRequest) return;
    const ttl = Date.parse(result.expiresAt) - Date.now();
    if (!Array.isArray(result.projects) || !Number.isFinite(ttl) || ttl <= 0) {
      throw new Error('Project verification expired');
    }
    showProjects(result.projects.map(createProjectCard).filter(Boolean));
    projectTimer = setTimeout(loadProjects, Math.min(ttl, refreshInterval));
  } catch {
    if (request === latestRequest) projectTimer = setTimeout(loadProjects, refreshInterval);
  }
}
loadProjects();
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) loadProjects();
});

const form = document.getElementById('brief-form');
const contact = window.RABEN_CONTENT?.contact;
if (contact?.instagram) {
  document.querySelectorAll('[data-instagram]').forEach(link => {
    link.href = 'https://ig.me/m/' + encodeURIComponent(contact.instagram);
  });
}
const fieldset = form.querySelector('fieldset');
const formStatus = document.getElementById('form-status');
const phone = document.getElementById('phone');
const phoneError = document.getElementById('phone-error');
// Enhanced validation uses the same native constraints as the plain HTML form.
form.noValidate = true;
const nameField = document.getElementById('name');
const message = document.getElementById('idea');
const kind = document.getElementById('kind');
const interestBox = document.getElementById('story-interest');
const interest = document.getElementById('interest');
const fallback = document.getElementById('contact-fallback');
const instagramBrief = document.getElementById('instagram-brief');
const emailFallback = document.getElementById('email-fallback-link');
const fallbackEmailAddress = contact?.email || emailFallback.getAttribute('href').slice('mailto:'.length);
const copyStatus = document.getElementById('instagram-copy-status');

function callbackMessage() {
  return message.value.trim() || 'אשמח שתחזרו אליי לשיחת היכרות.';
}

function updateFallback() {
  instagramBrief.value = [
    'היי רז ובן,',
    ...(nameField.value.trim() ? ['שם: ' + nameField.value.trim()] : []),
    'טלפון: ' + phone.value.trim(),
    'נושא הפנייה: ' + kind.selectedOptions[0].textContent,
    ...(interest.value.trim() ? ['מעניין אותי: ' + interest.value.trim()] : []),
    '',
    callbackMessage()
  ].join('\n');
  const subject = form.elements.namedItem('_subject').value;
  emailFallback.href = 'mailto:' + fallbackEmailAddress + '?subject=' + encodeURIComponent(subject) +
    '&body=' + encodeURIComponent(instagramBrief.value);
}

function clearInterest() {
  interest.value = '';
  interest.disabled = true;
  interestBox.hidden = true;
}

document.addEventListener('raben:story-contact', event => {
  if (fieldset.disabled) return;
  const selected = event.detail;
  if (!selected?.interest || !Array.from(kind.options).some(option => option.value === selected.kind)) return;
  interest.value = selected.interest;
  interest.disabled = false;
  interestBox.hidden = false;
  kind.value = selected.kind;
  kind.dispatchEvent(new Event('change', { bubbles: true }));
  phone.focus({ preventScroll: true });
});
document.getElementById('remove-interest').addEventListener('click', () => {
  clearInterest();
  if (!fallback.hidden) updateFallback();
  phone.focus();
});

form.addEventListener('input', event => {
  if (event.target === phone && phone.hasAttribute('aria-invalid')) {
    phone.removeAttribute('aria-invalid');
    phoneError.textContent = '';
  }
  if (formStatus.dataset.state === 'success') formStatus.textContent = '';
  if (!fallback.hidden) updateFallback();
});
function updateTopic() {
  document.getElementById('brief-topic').textContent = kind.selectedIndex > 0
    ? kind.selectedOptions[0].textContent
    : '';
}

updateTopic();
kind.addEventListener('change', () => {
  updateTopic();
  if (!fallback.hidden) updateFallback();
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (fieldset.disabled) return;
  phone.value = phone.value.trim();
  if (!phone.checkValidity()) {
    phone.setAttribute('aria-invalid', 'true');
    phoneError.textContent = phone.validity.valueMissing
      ? 'חסר מספר טלפון לחזרה.'
      : 'אפשר להזין מספר עם קידומת, למשל 050-1234567.';
    phone.focus();
    return;
  }

  const payload = new URLSearchParams(new FormData(form));
  payload.set('name', nameField.value.trim());
  payload.set('phone', phone.value);
  payload.set('message', callbackMessage());
  fieldset.disabled = true;
  fallback.hidden = true;
  formStatus.dataset.state = 'pending';
  formStatus.textContent = 'שולחים את הבקשה…';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(form.action, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: payload,
      signal: controller.signal
    });
    const result = await response.json();
    if (!response.ok || result?.ok !== true) {
      throw new Error('Submission not accepted');
    }
    form.reset();
    clearInterest();
    document.getElementById('brief-extras').open = false;
    updateTopic();
    instagramBrief.value = '';
    formStatus.dataset.state = 'success';
    formStatus.textContent = 'תודה, הבקשה נשלחה לשירות הטפסים.';
  } catch {
    updateFallback();
    copyStatus.textContent = 'אחרי ההעתקה אפשר להדביק את ההודעה בשיחה ולשלוח.';
    fallback.hidden = false;
    formStatus.dataset.state = 'error';
    formStatus.textContent = 'לא קיבלנו אישור שליחה. הפרטים עדיין בטופס. אפשר לנסות שוב או לפנות במייל או באינסטגרם.';
  } finally {
    clearTimeout(timer);
    fieldset.disabled = false;
  }
});

document.getElementById('instagram-fallback-link').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(instagramBrief.value);
    copyStatus.textContent = 'הפרטים הועתקו. אפשר להדביק את ההודעה בשיחה באינסטגרם ולשלוח.';
  } catch {
    instagramBrief.focus();
    instagramBrief.select();
    copyStatus.textContent = 'אפשר להעתיק את ההודעה המסומנת ולהדביק אותה בשיחה באינסטגרם.';
  }
});
