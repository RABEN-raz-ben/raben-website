// Decorative SVGs share the local symbol set in index.html; labels stay in text.
const icon = name => '<svg class="icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><use href="#icon-' + name + '"></use></svg>';
const content = window.RABEN_CONTENT;
const el = (tag, text, className) => { const node=document.createElement(tag); node.textContent=text; if(className) node.className=className; return node; };
document.getElementById('about-text').textContent=content.about;
document.getElementById('year').textContent=new Date().getFullYear();
if(content.capabilities.length){const list=el('div','','capability-list');content.capabilities.forEach((item,i)=>{const card=el('article','','capability');card.append(el('span',String(i+1).padStart(2,'0'),'number'),el('h3',item.title),el('p',item.description));list.append(card)});document.getElementById('capabilities').append(list)}
const projects=document.getElementById('project-list');
if(!content.projects.length){projects.innerHTML='<div class="empty-projects"><div><h3>הפרק הבא יופיע כאן.</h3><p>כאן נציג את הפרויקטים שאנחנו בונים יחד ואת העבודה שלנו לעסקים. נוסיף כל פרויקט עם הסיפור שלו, תמונות וקישור כשיהיה מוכן להצגה.</p></div><span class="empty-symbol" aria-hidden="true">'+icon('asterisk')+'</span></div>'}else{content.projects.forEach(p=>{const card=el('article','','project-card');card.append(el('h3',p.title),el('p',p.description));if(p.url&&/^https?:\/\//.test(p.url)){const link=el('a','לצפייה בפרויקט','project-link');link.insertAdjacentHTML('beforeend',icon('arrow-up-right'));link.href=p.url;link.target='_blank';link.rel='noopener noreferrer';card.append(link)}projects.append(card)})}

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
    status.textContent = 'לא הצלחנו לאשר שהפנייה נשלחה. הפרטים נשארו בטופס; אפשר לנסות שוב או לפנות אלינו באינסטגרם.';
  } finally {
    clearTimeout(timer);
    sending = false;
    button.disabled = false;
    form.removeAttribute('aria-busy');
  }
};
