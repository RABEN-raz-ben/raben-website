'use strict';

const { isIP } = require('node:net');

const CATEGORIES = new Set(['אתר עסקי', 'מוצר', 'פרויקט תוכנה', 'ניסוי']);
const TIMEOUT_MS = 4000;
const MAX_HTML_BYTES = 512 * 1024;
const MAX_PROJECTS = 12;
const AUTH_PATH = /\/(?:login|log-in|signin|sign-in|auth|sso)(?:\/|$)/i;
const AUTH_TEXT = /authentication required|deployment protection|vercel authentication|log\s?in|sign\s?in|access denied|unauthorized|התחברות|כניסה לחשבון/i;
const ERROR_TEXT = /\b404\b|\bnot found\b|page (?:does not exist|is unavailable)|deployment (?:not found|has been removed)|העמוד לא נמצא|הדף לא נמצא/i;
const BLOCKED_BODY = /authentication required|deployment protection|vercel authentication|(?:sign\s?in|log\s?in) (?:is required|to (?:continue|access|view))|please (?:sign\s?in|log\s?in)|access (?:is )?denied|you (?:do not|don't) have (?:access|permission)|\b404(?:\s*[-:–—]\s*|\s+)(?:page )?not found|(?:page|site|deployment) (?:was |is )?not found|(?:page|site|deployment) (?:does not exist|is unavailable|has been removed)|DEPLOYMENT_NOT_FOUND|העמוד לא נמצא|הדף לא נמצא|יש להתחבר|נדרשת התחברות/i;

function cleanString(value, max) {
  return typeof value === 'string' && value.trim() && value.length <= max ? value.trim() : null;
}

function publicUrl(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== 'https:' || url.username || url.password || url.port || !host.includes('.') ||
        isIP(host.replace(/^\[|\]$/g, '')) || /(?:^|\.)(?:localhost|local|internal|test|invalid)$/.test(host) || AUTH_PATH.test(url.pathname)) return null;
    // Configuration may contain public links, never authentication or bypass credentials.
    if ([...url.searchParams.keys()].some(key => /token|secret|password|bypass|authorization/i.test(key))) return null;
    url.hash = '';
    return url;
  } catch {
    return null;
  }
}

function fingerprints(value, min) {
  const values = typeof value === 'string' ? [value] : value;
  if (!Array.isArray(values) || !values.length || values.length > 5) return null;
  const normalized = values.map(item => cleanString(item, 240));
  return normalized.every(item => item && item.length >= min) ? normalized : null;
}

function candidateFrom(project) {
  if (!project || project.publish !== true || project.permissionGranted !== true) return null;
  const id = cleanString(project.id, 80);
  const title = cleanString(project.title, 120);
  const description = cleanString(project.description, 600);
  const url = publicUrl(project.url);
  const titleIncludes = fingerprints(project.expected?.titleIncludes, 3);
  const textIncludes = fingerprints(project.expected?.textIncludes, 12);
  if (!id || !/^[a-z0-9][a-z0-9-]*$/.test(id) || !title || !description || !url ||
      !CATEGORIES.has(project.category) || !titleIncludes || !textIncludes) return null;
  const record = { id, title, description, url: url.href, category: project.category, concept: project.concept === true };
  // Only approved, checked-in screenshots are rendered by the client.
  if (typeof project.image === 'string' && /^\/assets\/[a-z0-9/_-]+\.(?:png|jpe?g|webp|avif)$/i.test(project.image)) record.image = project.image;
  return { record, titleIncludes, textIncludes };
}

function decodeEntities(value) {
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (entity, code) => {
    const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
    if (code[0] !== '#') return named[code.toLowerCase()];
    const point = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
    return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : ' ';
  });
}

function normalize(value) {
  return decodeEntities(value).normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
}

function htmlText(html) {
  return normalize(html.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<(script|style|template|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ').replace(/<[^>]*>/g, ' '));
}

async function readLimitedHtml(response) {
  const length = Number(response.headers.get('content-length'));
  if (length > MAX_HTML_BYTES) throw new Error('Response too large');
  if (!response.body) throw new Error('Missing body');
  const reader = response.body.getReader();
  const chunks = [];
  let bytes = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_HTML_BYTES) throw new Error('Response too large');
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks).toString('utf8');
  } finally {
    await reader.cancel().catch(() => {});
  }
}

async function verifyCandidate(candidate, { fetchImpl = fetch, timeoutMs = TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => { controller.abort(); reject(new Error('Verification timed out')); }, timeoutMs);
  });
  const verification = async () => {
    const original = new URL(candidate.record.url);
    let url = original;
    for (let redirects = 0; redirects <= 2; redirects++) {
      const response = await fetchImpl(url.href, {
        method: 'GET', redirect: 'manual', credentials: 'omit', cache: 'no-store', signal: controller.signal,
        headers: { Accept: 'text/html', 'User-Agent': 'RABEN-Public-Project-Check/1.0' }
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        await response.body?.cancel();
        if (!location || redirects === 2) return null;
        const next = publicUrl(new URL(location, url).href);
        if (!next || next.origin !== original.origin) return null;
        url = next;
        continue;
      }
      if (response.status !== 200 || response.redirected ||
          !/^text\/html(?:\s*;|$)/i.test(response.headers.get('content-type') || '')) {
        await response.body?.cancel();
        return null;
      }
      const html = await readLimitedHtml(response);
      const title = htmlText(html.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i)?.[1] || '');
      const headings = [...html.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1\s*>/gi)].map(match => htmlText(match[2])).join(' ');
      const body = htmlText(html.match(/<body\b[^>]*>([\s\S]*?)<\/body\s*>/i)?.[1] || '');
      if (!title || !body || AUTH_TEXT.test(title + ' ' + headings) || ERROR_TEXT.test(title + ' ' + headings) ||
          BLOCKED_BODY.test(body) ||
          /<input\b[^>]*\btype\s*=\s*["']?password\b/i.test(html) ||
          /<meta\b[^>]*http-equiv\s*=\s*["']?refresh\b/i.test(html)) return null;
      if (!candidate.titleIncludes.every(text => title.includes(normalize(text))) ||
          !candidate.textIncludes.every(text => body.includes(normalize(text)))) return null;
      return candidate.record;
    }
    return null;
  };
  try {
    return await Promise.race([verification(), timeout]);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}

async function verifyProjects(projects, options) {
  if (!Array.isArray(projects)) return [];
  const seen = new Set();
  const candidates = projects.map(candidateFrom).filter(candidate => {
    if (!candidate || seen.has(candidate.record.id)) return false;
    seen.add(candidate.record.id);
    return true;
  }).slice(0, MAX_PROJECTS);
  const verified = [];
  // Three bounded groups keep the complete request below the 30-second function limit.
  for (let index = 0; index < candidates.length; index += 4) {
    const results = await Promise.all(candidates.slice(index, index + 4).map(candidate => verifyCandidate(candidate, options)));
    verified.push(...results.filter(Boolean));
  }
  return verified;
}

module.exports = { candidateFrom, publicUrl, verifyProjects, verifyCandidate };
