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

// Progressive motion: content remains readable without JavaScript or animation APIs.
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
const art = document.querySelector('.hero-art');
const revealTargets = document.querySelectorAll(
  '.hero-copy > *, .hero-art, .section-label, .about-grid > *, .capability, ' +
  '.section-heading, .empty-projects, .project-card, .contact-copy > h2, ' +
  '.contact-copy > p, #contact-links, #brief-form'
);
const reveals = new Map();
const revealed = new WeakSet();
const motionToggle = document.querySelector('.motion-toggle');
let motionPausedByUser = false;
let revealObserver;
let ambientObserver;
let pointerFrame = 0;

function resetArt() {
  cancelAnimationFrame(pointerFrame);
  pointerFrame = 0;
  art.style.removeProperty('--art-x');
  art.style.removeProperty('--art-y');
}

function setMotionPreference() {
  revealObserver?.disconnect();
  ambientObserver?.disconnect();
  reveals.forEach(animation => animation.cancel());
  reveals.clear();
  resetArt();
  const enabled = !reducedMotion.matches && !motionPausedByUser;
  document.documentElement.classList.toggle('motion-enabled', enabled);
  motionToggle.setAttribute('aria-pressed', String(motionPausedByUser));
  motionToggle.textContent = motionPausedByUser ? 'הפעלת תנועה' : 'עצירת תנועה';
  motionToggle.hidden = reducedMotion.matches;
  document.querySelectorAll('.motion-in-view').forEach(node => node.classList.remove('motion-in-view'));
  if (!enabled || !('IntersectionObserver' in window)) return;

  if (typeof Element.prototype.animate === 'function') {
    revealObserver = new IntersectionObserver(entries => {
      entries.forEach(({ target, isIntersecting }) => {
        if (!isIntersecting) return;
        revealObserver.unobserve(target);
        if (revealed.has(target)) return;
        revealed.add(target);
        if (target.contains(document.activeElement)) return;
        const siblings = [...target.parentElement.children];
        const stagger = target.matches('.capability, .hero-copy > *')
          ? Math.min(siblings.indexOf(target), 3) * 85 : 0;
        const animation = target.animate([
          { opacity: 0, transform: 'translateY(40px) scale(.97)' },
          { opacity: 1, transform: 'translateY(0)' }
        ], { duration: 950, delay: stagger, easing: 'cubic-bezier(.22, 1, .36, 1)', fill: 'backwards' });
        reveals.set(target, animation);
        animation.onfinish = animation.oncancel = () => reveals.delete(target);
      });
    }, { threshold: 0, rootMargin: '0px 0px -24px 0px' });
    revealTargets.forEach(node => revealObserver.observe(node));
  }

  // Ambient effects run only while their section is on screen.
  ambientObserver = new IntersectionObserver(entries => {
    entries.forEach(({ target, isIntersecting }) => {
      target.classList.toggle('motion-in-view', isIntersecting);
      if (target === art && !isIntersecting) resetArt();
    });
  });
  document.querySelectorAll('.hero, .hero-art, .ticker, .empty-projects, .contact').forEach(node => ambientObserver.observe(node));
}

art.addEventListener('pointermove', event => {
  if (reducedMotion.matches || motionPausedByUser || !finePointer.matches) return;
  const rect = art.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width - .5) * 12;
  const y = ((event.clientY - rect.top) / rect.height - .5) * 10;
  cancelAnimationFrame(pointerFrame);
  pointerFrame = requestAnimationFrame(() => {
    art.style.setProperty('--art-x', `${x}px`);
    art.style.setProperty('--art-y', `${y}px`);
    pointerFrame = 0;
  });
});
art.addEventListener('pointerleave', resetArt);
finePointer.addEventListener('change', resetArt);
document.addEventListener('focusin', event => {
  reveals.forEach((animation, target) => {
    if (target.contains(event.target)) animation.cancel();
  });
});
document.addEventListener('visibilitychange', () => {
  document.documentElement.classList.toggle('motion-paused', document.hidden);
  if (document.hidden) resetArt();
});
reducedMotion.addEventListener('change', setMotionPreference);
motionToggle.addEventListener('click', () => {
  motionPausedByUser = !motionPausedByUser;
  setMotionPreference();
});
setMotionPreference();
