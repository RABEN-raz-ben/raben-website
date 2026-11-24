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
  if (project.concept) body.append(makeElement('span', 'concept-label', 'דוגמת קונספט'));
  body.append(
    makeElement('h3', 'project-title', project.title),
    makeElement('p', 'project-description', project.description),
    makeElement('span', 'project-link', 'לצפייה באתר ↗')
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
if (contact?.email) {
  const destination = new URL('https://formsubmit.co/');
  destination.pathname = '/' + contact.email;
  form.action = destination.href;
}
if (contact?.instagram) {
  document.querySelectorAll('[data-instagram]').forEach(link => {
    link.href = 'https://ig.me/m/' + encodeURIComponent(contact.instagram);
  });
}
const fieldset = form.querySelector('fieldset');
const formStatus = document.getElementById('form-status');
const phone = document.getElementById('phone');
const nameField = document.getElementById('name');
const message = document.getElementById('idea');
const kind = document.getElementById('kind');
const fallback = document.getElementById('contact-fallback');
const instagramBrief = document.getElementById('instagram-brief');
const copyStatus = document.getElementById('instagram-copy-status');

function callbackMessage() {
  return message.value.trim() || 'אשמח שתחזרו אליי לשיחת היכרות.';
}

function updateFallback() {
  instagramBrief.value = [
    'היי רז ובן, אשמח לדבר על פרויקט.',
    ...(nameField.value.trim() ? ['שם: ' + nameField.value.trim()] : []),
    'טלפון: ' + phone.value.trim(),
    'סוג הפרויקט: ' + kind.selectedOptions[0].textContent,
    '',
    callbackMessage()
  ].join('\n');
}

form.addEventListener('input', event => {
  event.target.setCustomValidity?.('');
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
  const number = phone.value.trim();
  const validPhone = /^\+?[0-9\s()-]+$/.test(number) && /^\d{8,15}$/.test(number.replace(/\D/g, ''));
  phone.setCustomValidity(validPhone ? '' : 'יש להזין מספר טלפון תקין, כולל קידומת.');
  if (!form.reportValidity()) return;

  const payload = Object.fromEntries(new FormData(form));
  payload.name = nameField.value.trim();
  payload.phone = number;
  payload.message = callbackMessage();
  fieldset.disabled = true;
  fallback.hidden = true;
  formStatus.textContent = 'שולחים את הפנייה…';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const endpoint = new URL(form.action);
    endpoint.pathname = '/ajax' + endpoint.pathname;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    const result = await response.json();
    if (!response.ok || ![true, 'true'].includes(result.success)) throw new Error('Submission rejected');
    form.reset();
    document.getElementById('brief-extras').open = false;
    updateTopic();
    instagramBrief.value = '';
    formStatus.textContent = 'תודה, הפנייה נשלחה. נחזור אליך למספר שהשארת.';
  } catch {
    updateFallback();
    copyStatus.textContent = 'אחרי ההעתקה אפשר להדביק את ההודעה בשיחה ולשלוח.';
    fallback.hidden = false;
    formStatus.textContent = 'לא התקבל אישור שליחה. הפרטים נשמרו כאן ואפשר לנסות שוב או לשלוח אותם באינסטגרם.';
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
    copyStatus.textContent = 'יש להעתיק את הטקסט המסומן ולהדביק אותו בשיחה באינסטגרם.';
  }
});
