// Decorative SVGs share the local symbol set in index.html; labels stay in text.
const icon = name => '<svg class="icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><use href="#icon-' + name + '"></use></svg>';
const content = window.RABEN_CONTENT;
const el = (tag, text, className) => { const node=document.createElement(tag); node.textContent=text; if(className) node.className=className; return node; };
document.getElementById('about-text').textContent=content.about;
document.getElementById('year').textContent=new Date().getFullYear();
if(content.capabilities.length){const list=el('div','','capability-list');content.capabilities.forEach((item,i)=>{const card=el('article','','capability');card.append(el('span',String(i+1).padStart(2,'0'),'number'),el('h3',item.title),el('p',item.description));list.append(card)});document.getElementById('capabilities').append(list)}
const projects=document.getElementById('project-list');
if(!content.projects.length){projects.innerHTML='<div class="empty-projects"><div><h3>הפרק הבא יופיע כאן.</h3><p>כאן נציג את הפרויקטים שאנחנו בונים יחד ואת העבודה שלנו לעסקים. נוסיף כל פרויקט עם הסיפור שלו, תמונות וקישור כשיהיה מוכן להצגה.</p></div><span class="empty-symbol" aria-hidden="true">'+icon('asterisk')+'</span></div>'}else{content.projects.forEach(p=>{const card=el('article','','project-card');card.append(el('h3',p.title),el('p',p.description));if(p.url&&/^https?:\/\//.test(p.url)){const link=el('a','לצפייה בפרויקט','project-link');link.insertAdjacentHTML('beforeend',icon('arrow-up-right'));link.href=p.url;link.target='_blank';link.rel='noopener noreferrer';card.append(link)}projects.append(card)})}
const contact = content.contact || {};
const instagram = String(contact.instagram || '').replace(/^@/, '').trim();
const whatsapp = String(contact.whatsapp || '').replace(/[\s()+-]/g, '');
const instagramLink = document.getElementById('instagram-message');
const whatsappLink = document.getElementById('whatsapp-message');
if (/^[a-zA-Z0-9._]{1,30}$/.test(instagram)) {
  instagramLink.href = 'https://ig.me/m/' + encodeURIComponent(instagram);
  instagramLink.hidden = false;
}
if (/^[1-9]\d{7,14}$/.test(whatsapp)) {
  whatsappLink.hidden = false;
  document.getElementById('whatsapp-pending').hidden = true;
}
document.getElementById('brief-form').onsubmit=e=>{e.preventDefault();const name=document.getElementById('name').value.trim();const idea=document.getElementById('idea').value.trim();if(!idea){document.getElementById('idea').setCustomValidity('כתבו בכמה מילים את הרעיון שלכם.');document.getElementById('idea').reportValidity();return}document.getElementById('brief-output').value=`היי RABEN,${name?' אני '+name+'.':''}\n${document.getElementById('kind').value}\n\n${idea}`;if(!whatsappLink.hidden)whatsappLink.href='https://wa.me/'+whatsapp+'?text='+encodeURIComponent(document.getElementById('brief-output').value);document.getElementById('brief-result').hidden=false;document.getElementById('form-status').textContent='ההודעה מוכנה. העתיקו אותה, פתחו שיחה באינסטגרם והדביקו אותה שם.';};document.getElementById('idea').oninput=e=>e.target.setCustomValidity('');
document.getElementById('copy-brief').onclick=async()=>{const output=document.getElementById('brief-output');try{await navigator.clipboard.writeText(output.value);document.getElementById('form-status').textContent='ההודעה הועתקה. אפשר לפתוח שיחה באינסטגרם ולהדביק אותה.'}catch{output.focus();output.select();document.getElementById('form-status').textContent='בחרנו את הטקסט. אפשר להעתיק ידנית.'}};
