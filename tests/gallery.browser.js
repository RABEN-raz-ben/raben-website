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

    await page.emulateMedia({reducedMotion: 'reduce'});
    await page.goto(base);
    await gallery.scrollIntoViewIfNeeded();
    const photo = control('photo');
    for (const id of stories) {
      assert(await gallery.getAttribute('data-story') === id, 'Unexpected story: ' + id);
      await photo.evaluate(img => img.decode());
      assert(await photo.evaluate(img => img.naturalWidth > 0 && img.alt.trim()), 'Missing photo: ' + id);
      const demo = control('demo');
      const before = await demo.innerText();
      const choices = demo.getByRole('button');
      const choice = choices.last();
      await choice.click();
      assert(await demo.innerText() !== before, 'Missing action feedback: ' + id);
      assert(await choice.evaluate(node => node === document.activeElement), 'Focus lost: ' + id);
      await control('next').click();
    }
    assert(await gallery.getAttribute('data-story') === stories[0], 'Loop did not wrap');
    assert(await control('demo').locator('[aria-pressed="true"]').count() === 1, 'Ceramics choice lost');

    for (const [category, count] of [['clients', 3], ['work', 3], ['ideas', 2]]) {
      await gallery.locator('[data-gallery-filter="' + category + '"]').click();
      assert((await control('index').textContent()).endsWith(String(count)), 'Wrong count: ' + category);
      assert(await gallery.getAttribute('data-category') === category, 'Wrong category');
    }
    await page.reload();
    assert((await control('index').textContent()).endsWith('2'), 'Session filter lost on reload');
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
    return 'Eight stories, eight demo actions, loop, filters, context, retry, four widths and no-JS passed.';
  } finally {
    await context.close();
  }
}
