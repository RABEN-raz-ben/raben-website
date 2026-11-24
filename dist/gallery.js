(() => {
  'use strict';

  const gallery = document.getElementById('story-gallery');
  const catalog = window.RABEN_STORIES;
  if (!gallery || !Array.isArray(catalog) || !catalog.length) return;

  const order = ['ceramics', 'technician', 'study', 'bakery', 'community', 'hiking', 'guitar', 'volunteer'];
  const ordered = order.map(id => catalog.find(item => item.id === id)).filter(Boolean);
  const stories = [...ordered, ...catalog.filter(item => !order.includes(item.id))];
  if (!stories.length) return;
  const find = name => gallery.querySelector('[data-gallery-' + name + ']');
  const enhanced = find('enhanced');
  const photo = find('photo');
  const demo = find('demo');
  const status = find('status');
  const play = find('play');
  const link = find('cta');
  const share = find('share');
  const shareLabel = share?.textContent;
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const choices = new Map();
  let position = 0;
  let slideTimer;
  let actionTimer;
  let shareTimer;
  let inView = false;
  let near = false;
  let keyboardInput = true;
  let paused = motion.matches;
  let reducedMotionOverride = false;
  let demonstrated = false;
  let photoFor;
  let preloadedFor;
  let nextImage;

  function savedChoice(id) {
    if (!choices.has(id)) {
      let choice;
      try {
        const saved = JSON.parse(sessionStorage.getItem('raben-gallery-' + id));
        if (Number.isInteger(saved?.choice)) choice = saved.choice;
      } catch { /* Private browsing can keep selections in memory. */ }
      choices.set(id, choice);
    }
    return choices.get(id);
  }

  function demonstrate() {
    if (demonstrated) return;
    demonstrated = true;
    stories[position].demonstrate?.(demo);
  }

  function schedule() {
    clearTimeout(slideTimer);
    clearTimeout(actionTimer);
    if (motion.matches && !reducedMotionOverride) {
      paused = true;
      updatePlayControl();
      if (demo.firstElementChild) demonstrate();
      return;
    }
    const focused = document.activeElement;
    const reading = keyboardInput && (demo.contains(focused) || focused === link || focused === share);
    if (paused || !inView || document.hidden || reading) return;
    if (!demonstrated) actionTimer = setTimeout(demonstrate, 2500);
    if (stories.length > 1) {
      slideTimer = setTimeout(() => {
        position = (position + 1) % stories.length;
        render();
      }, 8000);
    }
  }

  function updatePlayControl() {
    if (play) {
      play.textContent = paused ? 'המשך ניגון' : 'השהיה';
      play.setAttribute('aria-label', paused ? 'המשך ניגון — הפעלת מעבר אוטומטי' : 'השהיה — עצירת מעבר אוטומטי');
    }
  }

  function setPaused(value) {
    paused = value;
    updatePlayControl();
    schedule();
  }

  function stagePhotos() {
    if (!near) return;
    const story = stories[position];
    const following = stories[(position + 1) % stories.length];
    const imageUrl = 'assets/gallery/' + story.id + '.webp';
    if (photoFor !== story.id) {
      photoFor = story.id;
      gallery.dataset.photoStatus = 'loading';
      photo.hidden = false;
      photo.alt = story.alt;
      photo.decoding = 'async';
      photo.sizes = '(max-width: 700px) 100vw, 50vw';
      photo.srcset = 'assets/gallery/' + story.id + '-small.webp 460w, ' + imageUrl + ' 1100w';
      photo.src = imageUrl;
    }
    if (!document.hidden && inView && stories.length > 1 && following.id !== preloadedFor && gallery.dataset.photoStatus !== 'loading') {
      preloadedFor = following.id;
      nextImage = new Image();
      nextImage.fetchPriority = 'low';
      nextImage.sizes = photo.sizes;
      nextImage.srcset = 'assets/gallery/' + following.id + '-small.webp 460w, assets/gallery/' + following.id + '.webp 1100w';
      nextImage.src = 'assets/gallery/' + following.id + '.webp';
    }
  }

  function fadeIn(element) {
    if (!motion.matches && element.animate) {
      element.animate([{ opacity: .45 }, { opacity: 1 }], { duration: 190, easing: 'ease-out' });
    }
  }

  photo.addEventListener('load', () => {
    if (!photoFor) return;
    gallery.dataset.photoStatus = 'ready';
    fadeIn(photo);
    stagePhotos();
  });
  photo.addEventListener('error', () => {
    if (!photoFor) return;
    gallery.dataset.photoStatus = 'error';
    photo.hidden = true;
    stagePhotos();
  });

  function render() {
    const story = stories[position];
    gallery.dataset.category = story.category;
    gallery.dataset.story = story.id;
    find('title').textContent = story.title;
    find('caption').textContent = story.caption;
    link.textContent = story.cta;
    link.href = '#contact';
    if (share) {
      clearTimeout(shareTimer);
      share.href = '#story-' + story.id;
      share.textContent = shareLabel;
    }
    const choice = savedChoice(story.id);
    const state = Number.isInteger(choice) ? { choice } : {};
    story.render(demo, state, () => {
      demonstrated = true;
      choices.set(story.id, state.choice);
      try {
        sessionStorage.setItem('raben-gallery-' + story.id, JSON.stringify({ choice: state.choice }));
      } catch { /* The selection remains available within the page. */ }
      schedule();
    });
    demonstrated = Number.isInteger(state.choice);
    fadeIn(demo);
    stagePhotos();
    schedule();
  }

  function showStory(id) {
    const target = stories.findIndex(item => item.id === id);
    if (target === -1) return false;
    position = target;
    render();
    gallery.scrollIntoView({ block: 'start', behavior: 'instant' });
    return true;
  }

  function followHash() {
    const legacyLinks = {
      '#solution-website': 'ceramics',
      '#solution-tool': 'community',
      '#solution-product': 'study'
    };
    const id = legacyLinks[location.hash] || (location.hash.startsWith('#story-') && location.hash.slice(7));
    return id && showStory(id);
  }

  play?.addEventListener('click', () => {
    reducedMotionOverride = motion.matches && paused;
    setPaused(!paused);
  });
  link.addEventListener('click', () => {
    schedule();
    const story = stories[position];
    document.dispatchEvent(new CustomEvent('raben:story-contact', { detail: { kind: story.kind, interest: story.interest } }));
  });
  share?.addEventListener('click', async event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    schedule();
    const permalink = share.href;
    const storyTitle = stories[position].title;
    try {
      await navigator.clipboard.writeText(permalink);
      if (share.href !== permalink) return;
      share.textContent = 'הקישור הועתק';
      status.textContent = 'הקישור לדוגמה ' + storyTitle + ' הועתק.';
    } catch {
      if (share.href !== permalink) return;
      if (location.href !== permalink) history.pushState(history.state, '', permalink);
      share.textContent = 'הקישור בשורת הכתובת';
      status.textContent = 'אפשר להעתיק את הקישור לדוגמה ' + storyTitle + ' משורת הכתובת.';
    }
    clearTimeout(shareTimer);
    shareTimer = setTimeout(() => { share.textContent = shareLabel; }, 3500);
  });
  window.addEventListener('hashchange', followHash);
  document.addEventListener('pointerdown', () => {
    keyboardInput = false;
    if (gallery.contains(document.activeElement)) schedule();
  }, true);
  document.addEventListener('keydown', () => {
    if (!keyboardInput) {
      keyboardInput = true;
      if (gallery.contains(document.activeElement)) schedule();
    }
  }, true);
  gallery.addEventListener('focusin', schedule);
  gallery.addEventListener('focusout', () => queueMicrotask(schedule));
  document.addEventListener('visibilitychange', () => { stagePhotos(); schedule(); });
  motion.addEventListener('change', event => {
    reducedMotionOverride = false;
    if (event.matches) setPaused(true);
  });

  if ('IntersectionObserver' in window) {
    const nearby = new IntersectionObserver(entries => {
      if (!entries[0].isIntersecting) return;
      near = true;
      stagePhotos();
      nearby.disconnect();
    }, { rootMargin: '320px' });
    nearby.observe(gallery);
    new IntersectionObserver(entries => {
      const entry = entries[0];
      inView = entry.isIntersecting && entry.intersectionRatio >= .15;
      stagePhotos();
      schedule();
    }, { threshold: [0, .15] }).observe(gallery);
  } else {
    function updateVisibility() {
      const bounds = gallery.getBoundingClientRect();
      const visibleHeight = Math.min(bounds.bottom, innerHeight) - Math.max(bounds.top, 0);
      const visible = visibleHeight > 0 && visibleHeight >= .15 * Math.min(innerHeight, bounds.height);
      near = near || (bounds.top < innerHeight + 320 && bounds.bottom > -320);
      if (inView !== visible) {
        inView = visible;
        schedule();
      }
      stagePhotos();
    }
    window.addEventListener('scroll', updateVisibility, { passive: true });
    window.addEventListener('resize', updateVisibility);
    window.addEventListener('load', updateVisibility, { once: true });
  }

  enhanced.hidden = false;
  const fallback = find('static');
  if (fallback) fallback.hidden = true;
  setPaused(paused);
  if (!followHash()) render();
})();
