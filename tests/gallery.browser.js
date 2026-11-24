// Run using playwright-cli run-code against the local preview (see README).
async previewTab => {
  const base = new URL('/', previewTab.url()).href;
  if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) {
    throw new Error('Open the local RABEN preview before running this check.');
  }

  const context = await previewTab.context().browser().newContext();
  try {
    const page = await context.newPage();
    const assert = (condition, message) => { if (!condition) throw new Error(message); };
    const gallery = page.locator('#story-gallery');
    const control = name => gallery.locator('[data-gallery-' + name + ']');
    const stories = ['ceramics', 'technician', 'study', 'bakery', 'community', 'hiking', 'guitar', 'volunteer'];
    const errors = [];
    const requests = [];

    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/projects', route => route.fulfill({
      json: {projects: [], expiresAt: new Date(Date.now() + 300000).toISOString()}
    }));
    await page.route('https://formsubmit.co/**', route => {
      requests.push(route.request().postDataJSON());
      return route.fulfill({json: {success: requests.length > 1}});
    });

    await page.emulateMedia({reducedMotion: 'no-preference'});
    await page.setViewportSize({width:490,height:904});
    await page.clock.install({time:new Date('2026-01-01T10:00:00Z')});
    await page.clock.pauseAt(new Date('2026-01-01T10:00:02Z'));
    await page.goto(base + '#story-ceramics');
    await gallery.scrollIntoViewIfNeeded();
    await page.clock.runFor(100);
    assert(await gallery.locator('.gallery-toolbar').count() === 0, 'Old gallery controls still present');
    for (const id of stories) {
      assert(await gallery.getAttribute('data-story') === id, 'Automatic story order: ' + id);
      await control('photo').evaluate(img => img.decode());
      assert(await gallery.getAttribute('data-phase') === 'problem', 'Missing initial problem: ' + id);
      assert(await control('problem').isVisible() && !await control('demo').isVisible(), 'Problem frame not isolated: ' + id);
      assert((await control('problem').innerText()).trim().length > 0, 'Problem is empty: ' + id);
      const issue = await control('issue').innerText();
      const gain = await control('outcome').innerText();
      assert(issue.trim() && gain.trim(), 'Missing always-visible comparison: ' + id);
      const before = await control('demo').textContent();
      await page.clock.runFor(3200);
      assert(await gallery.getAttribute('data-phase') === 'solution', 'Solution not revealed: ' + id);
      assert(await control('demo').isVisible() && !await control('problem').isVisible(), 'Solution frame not isolated: ' + id);
      assert(await control('demo').textContent() !== before, 'No automatic result: ' + id);
      await control('demo').evaluate(node => window.scrollBy({top:node.getBoundingClientRect().top - 180, behavior:'instant'}));
      for (const [key, value] of [['issue', issue], ['outcome', gain]]) {
        const box = await control(key).boundingBox();
        assert(box && box.y >= 0 && box.y + box.height <= 904 && await control(key).innerText() === value,
          'Comparison lost midway through ' + id);
      }
      await page.clock.runFor(5800);
    }
    assert(await gallery.getAttribute('data-story') === stories[0], 'Automatic loop did not wrap');
    await control('play').click();
    await page.clock.runFor(16000);
    assert(await gallery.getAttribute('data-story') === stories[0], 'Explicit pause ignored');
    await control('play').click();
    await page.clock.runFor(9100);
    assert(await gallery.getAttribute('data-story') === stories[1], 'Explicit resume failed');
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.clock.runFor(32);
    await page.waitForFunction(() => document.querySelector('[data-gallery-play]').textContent === 'המשך ניגון');
    await page.clock.runFor(20000);
    assert(await gallery.getAttribute('data-story') === stories[1], 'Reduced motion ignored');
    assert(await control('problem').isVisible() && await control('demo').isVisible(), 'Static comparison missing');
    await page.goto(base + '#story-hiking');
    assert(await gallery.getAttribute('data-story') === 'hiking', 'Shared story did not open');
    await page.locator('#brief-extras summary').click();
    await page.locator('#idea').fill('הודעת בדיקה מקומית');
    await control('cta').click();
    const interest = page.locator('#interest');
    assert(await interest.isVisible() && await interest.inputValue(), 'Missing editable story context');
    await interest.fill('הקשר שנערך בבדיקה');
    await page.locator('#phone').fill('0501234567');
    await page.locator('#brief-form button[type=submit]').click();
    await page.locator('#form-status[data-state=error]').waitFor();
    assert((await page.locator('#instagram-brief').inputValue()).includes('הקשר שנערך בבדיקה'), 'Missing fallback context');
    await page.locator('#brief-form button[type=submit]').click();
    await page.locator('#form-status[data-state=success]').waitFor();
    assert(requests.length === 2 && requests.every(data => data.message === 'הודעת בדיקה מקומית' &&
      data.story_interest === 'הקשר שנערך בבדיקה'), 'Incorrect contact payload');

    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({width, height: 844});
      for (const id of stories) {
        await page.goto(base + '#story-' + id);
        assert(!await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), 'Overflow: ' + id + ' at ' + width);
      }
    }
    const staticContext = await page.context().browser().newContext({javaScriptEnabled:false});
    try {
      const staticPage = await staticContext.newPage();
      await staticPage.goto(base + '#websites');
      assert(await staticPage.locator('[data-gallery-static]').isVisible(), 'Missing static fallback');
      await staticPage.locator('.static-ideas summary').click();
      await staticPage.locator('.static-ideas a').last().click();
      assert(staticPage.url().endsWith('#contact'), 'Static contact link');
    } finally {
      await staticContext.close();
    }
    assert(errors.length === 0, errors.join('\n'));
    return 'Eight automatic actions, loop, pause, resume, reduced motion, context, retry, responsive layout and no-JS passed.';
  } finally {
    await context.close();
  }
}
