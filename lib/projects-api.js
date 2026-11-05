'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { verifyProjects } = require('./project-verifier');

const CACHE_MS = 5 * 60 * 1000;

function loadProjects() {
  // This is trusted, checked-in source; never execute request input in this context.
  const source = fs.readFileSync(path.join(__dirname, '..', 'dist', 'content.js'), 'utf8');
  const context = { window: {} };
  vm.runInNewContext(source, context, { timeout: 100, contextCodeGeneration: { strings: false, wasm: false } });
  const projects = context.window.RABEN_CONTENT?.projects;
  if (!Array.isArray(projects)) throw new Error('Project configuration unavailable');
  return JSON.parse(JSON.stringify(projects));
}

function createProjectsHandler({ load = loadProjects, verify = verifyProjects, now = Date.now } = {}) {
  let cached;
  let pending;
  return async function projectsHandler(request, response) {
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.setHeader('Allow', 'GET, HEAD');
      response.setHeader('Cache-Control', 'no-store');
      response.statusCode = 405;
      return response.end(JSON.stringify({ projects: [] }));
    }
    try {
      if (!cached || cached.expiresAt <= now()) {
        if (!pending) {
          const checkedAt = now();
          pending = Promise.resolve().then(load).then(verify).then(projects => ({ projects, checkedAt, expiresAt: checkedAt + CACHE_MS }));
        }
        try { cached = await pending; } finally { pending = null; }
      }
      // A CDN hit must not add another five minutes on top of the in-process cache.
      const ttl = Math.floor((cached.expiresAt - now()) / 1000);
      if (ttl <= 0) throw new Error('Verification expired');
      response.setHeader('Cache-Control', `public, max-age=0, s-maxage=${ttl}, must-revalidate`);
      response.statusCode = 200;
      return response.end(request.method === 'HEAD' ? '' : JSON.stringify({
        projects: cached.projects,
        checkedAt: new Date(cached.checkedAt).toISOString(),
        expiresAt: new Date(cached.expiresAt).toISOString()
      }));
    } catch {
      // Never serve a previously successful response after a failed refresh.
      cached = null;
      response.setHeader('Cache-Control', 'no-store');
      response.statusCode = 503;
      return response.end(request.method === 'HEAD' ? '' : JSON.stringify({ projects: [] }));
    }
  };
}

module.exports = { createProjectsHandler, loadProjects, CACHE_MS };
