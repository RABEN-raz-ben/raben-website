'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { verifyProjects } = require('../lib/project-verifier');
const { createProjectsHandler, loadProjects, CACHE_MS } = require('../lib/projects-api');

const project = {
  id: 'garden', title: 'Garden', description: 'A garden catalogue.', url: 'https://garden.example.com/',
  category: 'מוצר', publish: true, permissionGranted: true,
  expected: { titleIncludes: 'Garden catalogue', textIncludes: 'Choose plants for your home' }
};
const goodHtml = '<!doctype html><html><head><title>Garden catalogue</title></head><body><h1>Garden</h1><p>Choose plants for your home</p></body></html>';
const html = (body = goodHtml, status = 200, headers = {}) => new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8', ...headers } });

test('only approved projects with matching public HTML are returned and private config is omitted', async () => {
  const calls = [];
  const results = await verifyProjects([{ ...project, concept: true, image: '/assets/garden.png', secret: 'not public' }], {
    fetchImpl: async (url, options) => { calls.push({ url, options }); return html(); }
  });
  assert.deepEqual(results, [{ id: 'garden', title: 'Garden', description: project.description, url: project.url, category: 'מוצר', concept: true, image: '/assets/garden.png' }]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.credentials, 'omit');
  assert.equal(calls[0].options.redirect, 'manual');
  assert.deepEqual(Object.keys(calls[0].options.headers).sort(), ['Accept', 'User-Agent']);
});

test('missing approval, weak/missing fingerprint, unsafe URL and unsupported category never cause a request', async () => {
  const invalid = [
    { ...project, publish: false }, { ...project, permissionGranted: false }, { ...project, permissionGranted: 'true' },
    { ...project, expected: {} }, { ...project, expected: { titleIncludes: 'ok', textIncludes: 'generic' } },
    { ...project, url: 'https://127.0.0.1/' }, { ...project, url: 'https://example.com/?token=private' },
    { ...project, url: 'http://garden.example.com/' }, { ...project, category: 'unknown' }
  ];
  assert.deepEqual(await verifyProjects(invalid, { fetchImpl: () => assert.fail('No request expected') }), []);
});

test('broken responses, auth walls, soft 404, wrong content and HTML shells fail closed', async t => {
  const responses = {
    broken: () => html('Unavailable', 503),
    unauthorized: () => html(goodHtml, 401),
    authTitle: () => html(goodHtml.replace('Garden catalogue', 'Sign in | Garden catalogue')),
    authBody: () => html(goodHtml.replace('<p>', '<p>Authentication Required ')),
    password: () => html(goodHtml.replace('</body>', '<input type="password"></body>')),
    soft404: () => html(goodHtml.replace('<h1>Garden</h1>', '<h1>404 page not found</h1>')),
    soft404BrandedShell: () => html(goodHtml.replace('</body>', '<main><h2>404 page not found</h2></main></body>')),
    authBrandedShell: () => html(goodHtml.replace('</body>', '<main><h2>Sign in to continue</h2><button>Continue with Google</button></main></body>')),
    authBodyOnly: () => html(goodHtml.replace('</body>', '<main><p>Please sign in to continue.</p></main></body>')),
    soft404BodyOnly: () => html(goodHtml.replace('</body>', '<main><p>This page does not exist.</p></main></body>')),
    wrongPage: () => html(goodHtml.replace('Choose plants for your home', 'An unrelated website')),
    scriptOnly: () => html(goodHtml.replace('<p>Choose plants for your home</p>', '<script>"Choose plants for your home"</script>')),
    json: () => new Response(goodHtml, { headers: { 'content-type': 'application/json' } }),
    oversized: () => html(goodHtml, 200, { 'content-length': String(1024 * 1024) }),
    metaRefresh: () => html(goodHtml.replace('</head>', '<meta http-equiv="refresh" content="0;url=/login"></head>'))
  };
  for (const [name, makeResponse] of Object.entries(responses)) {
    await t.test(name, async () => assert.deepEqual(await verifyProjects([project], { fetchImpl: async () => makeResponse() }), []));
  }
});

test('a public page may have a login navigation link, and remote screenshots are omitted', async () => {
  const results = await verifyProjects([{ ...project, image: 'https://cdn.example.com/image.png' }], {
    fetchImpl: async () => html(goodHtml.replace('</body>', '<nav><a href="/login">Sign in</a></nav></body>'))
  });
  assert.equal(results.length, 1);
  assert.equal(results[0].image, undefined);
});

test('same-origin redirects can verify, cross-origin/login redirects and loops fail closed', async () => {
  let requests = [];
  let fetchImpl = async url => {
    requests.push(url);
    return requests.length === 1 ? new Response(null, { status: 302, headers: { location: '/catalogue' } }) : html();
  };
  assert.equal((await verifyProjects([project], { fetchImpl })).length, 1);
  assert.deepEqual(requests, [project.url, 'https://garden.example.com/catalogue']);
  for (const location of ['https://other.example.com/', '/login', '/']) {
    requests = [];
    fetchImpl = async url => { requests.push(url); return new Response(null, { status: 302, headers: { location } }); };
    assert.deepEqual(await verifyProjects([project], { fetchImpl }), []);
    assert.ok(requests.length <= 3);
    if (location !== '/') assert.equal(requests.length, 1);
  }
});

test('timeouts abort anonymous fetches, and network failures hide the project', async () => {
  let signal;
  assert.deepEqual(await verifyProjects([project], { timeoutMs: 15, fetchImpl: (_, options) => { signal = options.signal; return new Promise(() => {}); } }), []);
  assert.equal(signal.aborted, true);
  assert.deepEqual(await verifyProjects([project], { fetchImpl: async () => { throw new Error('Network unavailable'); } }), []);
});

test('HTML entities normalize, duplicate IDs do not duplicate cards, and all fingerprints are required', async () => {
  const entityProject = { ...project, expected: { titleIncludes: ['Garden', '& catalogue'], textIncludes: ['Choose plants for', 'your home today'] } };
  const page = goodHtml.replace('Garden catalogue', 'Garden &amp; catalogue').replace('your home', 'your home today');
  assert.equal((await verifyProjects([entityProject, entityProject], { fetchImpl: async () => html(page) })).length, 1);
  assert.deepEqual(await verifyProjects([entityProject], { fetchImpl: async () => html() }), []);
});

function responseRecorder() {
  return { headers: {}, setHeader(name, value) { this.headers[name] = value; }, end(body) { this.body = body; } };
}

test('cache expires within five minutes, CDN cannot extend it, and failed refresh cannot serve stale success', async () => {
  let time = 1_800_000_000_000;
  let checks = 0;
  const handler = createProjectsHandler({
    load: () => [project], now: () => time,
    verify: async () => { checks++; if (checks > 1) throw new Error('Failed refresh'); return [{ id: 'garden' }]; }
  });
  let response = responseRecorder();
  await handler({ method: 'GET' }, response);
  assert.equal(response.statusCode, 200);
  assert.equal(JSON.parse(response.body).expiresAt, new Date(time + CACHE_MS).toISOString());
  assert.match(response.headers['Cache-Control'], /s-maxage=300/);
  time += 120000;
  response = responseRecorder();
  await handler({ method: 'GET' }, response);
  assert.equal(checks, 1);
  assert.match(response.headers['Cache-Control'], /s-maxage=180/);
  time += 180000;
  response = responseRecorder();
  await handler({ method: 'GET' }, response);
  assert.equal(checks, 2);
  assert.equal(response.statusCode, 503);
  assert.equal(response.headers['Cache-Control'], 'no-store');
  assert.deepEqual(JSON.parse(response.body), { projects: [] });
});

test('parallel requests share one verification and unsupported methods do not verify', async () => {
  let checks = 0;
  const handler = createProjectsHandler({ load: () => [], verify: async () => { checks++; return []; } });
  const responses = [responseRecorder(), responseRecorder()];
  await Promise.all(responses.map(response => handler({ method: 'GET' }, response)));
  assert.equal(checks, 1);
  const response = responseRecorder();
  await handler({ method: 'POST' }, response);
  assert.equal(response.statusCode, 405);
  assert.equal(response.headers['Cache-Control'], 'no-store');
  assert.equal(checks, 1);
});

test('checked-in content is available to the endpoint without a second project manifest', () => {
  assert.ok(Array.isArray(loadProjects()));
});
