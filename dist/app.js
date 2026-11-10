// Decorative SVGs share the local symbol set in index.html; labels stay in text.
const icon = name => '<svg class="icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><use href="#icon-' + name + '"></use></svg>';
const content = window.RABEN_CONTENT;
const el = (tag, text, className) => { const node=document.createElement(tag); node.textContent=text; if(className) node.className=className; return node; };
document.getElementById('about-text').textContent=content.about;
document.getElementById('year').textContent=new Date().getFullYear();
if(content.capabilities.length){const list=el('div','','capability-list');content.capabilities.forEach((item,i)=>{const card=el('article','','capability');card.append(el('span',String(i+1).padStart(2,'0'),'number'),el('h3',item.title),el('p',item.description));list.append(card)});document.getElementById('capabilities').append(list)}
const websiteService = content.services.find(service => service.id === 'business-websites');
if (websiteService) {
  document.getElementById('websites-title').textContent = websiteService.title;
  document.getElementById('website-description').textContent = websiteService.description;
  websiteService.features.forEach(feature => document.getElementById('website-features').append(el('li', feature)));
} else document.getElementById('websites').hidden = true;

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


// The hero is an explicitly labeled design study, separate from verified work.
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
