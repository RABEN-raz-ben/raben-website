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
  const previous = find('prev');
  const next = find('next');
  const link = find('cta');
  const share = find('share');
  const shareLabel = share?.textContent;
  const filters = [...gallery.querySelectorAll('[data-gallery-filter]')];

  let selectedFilter = 'all';
  let visible = stories;
  let position = 0;
  let timer;
  let shareTimer;
  let inView = false;
  let near = false;
  let hovered = false;
  let resumeOnPlay = false;
  let photoFor;
  let preloadedFor;
  let nextImage;
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let paused = motion.matches;
  const delay = 8000;
  const states = new Map();

  function stateFor(id) {
    if (!states.has(id)) {
      const state = {};
      try {
        const saved = JSON.parse(sessionStorage.getItem('raben-gallery-' + id));
        if (Number.isInteger(saved?.choice)) state.choice = saved.choice;
      } catch { /* Storage is optional in private or restricted browsing. */ }
      states.set(id, state);
    }
    return states.get(id);
  }

  function armTimer() {
    clearTimeout(timer);
    const focusInside = gallery.contains(document.activeElement);
    const blockedByInteraction = (hovered || focusInside) && !resumeOnPlay;
    if (paused || !inView || blockedByInteraction || document.hidden || visible.length < 2) return;
    timer = setTimeout(() => move(1, false), delay);
  }

  function setPaused(value) {
    paused = value;
    if (value) resumeOnPlay = false;
    play.textContent = paused ? 'המשך ניגון' : 'השהיה';
    play.setAttribute('aria-label', paused ? 'המשך ניגון — הפעלת מעבר אוטומטי' : 'השהיה — עצירת מעבר אוטומטי');
    armTimer();
  }

  function stagePhotos() {
    if (!near) return;
    const story = visible[position];
    const following = visible[(position + 1) % visible.length];
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
    if (!document.hidden && inView && visible.length > 1 && following.id !== preloadedFor && gallery.dataset.photoStatus !== 'loading') {
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

  function render(announce) {
    const story = visible[position];
    gallery.dataset.category = story.category;
    gallery.dataset.story = story.id;
    find('title').textContent = story.title;
    find('caption').textContent = story.caption;
    const count = 'דוגמה ' + (position + 1) + ' מתוך ' + visible.length;
    find('index').textContent = count;
    link.textContent = story.cta;
    link.href = '#contact';
    if (share) {
      clearTimeout(shareTimer);
      share.href = '#story-' + story.id;
      share.textContent = shareLabel;
    }
    filters.forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.galleryFilter === selectedFilter));
    });
    previous.disabled = next.disabled = play.disabled = visible.length === 1;
    demo.replaceChildren();
    const state = stateFor(story.id);
    story.render(demo, state, () => {
      setPaused(true);
      try {
        sessionStorage.setItem('raben-gallery-' + story.id, JSON.stringify({ choice: state.choice }));
      } catch { /* Keep selections in memory when storage is unavailable. */ }
    });
    fadeIn(demo);
    stagePhotos();
    if (announce) status.textContent = count + '. ' + story.title;
    armTimer();
  }

  function syncStoryHash() {
    if (location.hash.startsWith('#story-')) {
      history.replaceState(history.state, '', '#story-' + visible[position].id);
    }
  }

  function move(delta, manual) {
    if (manual) setPaused(true);
    position = (position + delta + visible.length) % visible.length;
    render(manual);
    if (manual) syncStoryHash();
  }

  function selectFilter(filter, announce = true) {
    const options = filter === 'all' ? stories : stories.filter(story => story.category === filter);
    if (!options.length) return;
    selectedFilter = filter;
    visible = options;
    position = 0;
    setPaused(true);
    render(announce);
    if (announce) {
      try { sessionStorage.setItem('raben-story-filter', filter); } catch { /* The filter still works in memory. */ }
      syncStoryHash();
    }
    return true;
  }

  function showStory(id, scroll) {
    const story = stories.find(item => item.id === id);
    if (!story) return false;
    if (!visible.includes(story)) {
      visible = stories;
      selectedFilter = 'all';
    }
    position = visible.indexOf(story);
    setPaused(true);
    render(true);
    if (scroll) gallery.scrollIntoView({ block: 'start', behavior: 'instant' });
    return true;
  }

  function followHash() {
    const legacyLinks = {
      '#solution-website': 'ceramics',
      '#solution-tool': 'community',
      '#solution-product': 'study'
    };
    const id = legacyLinks[location.hash] || (location.hash.startsWith('#story-') && location.hash.slice(7));
    return id && showStory(id, true);
  }

  filters.forEach(button => button.addEventListener('click', () => selectFilter(button.dataset.galleryFilter)));
  previous.addEventListener('click', () => move(-1, true));
  next.addEventListener('click', () => move(1, true));
  play.addEventListener('click', () => {
    resumeOnPlay = paused;
    setPaused(!paused);
  });
  link.addEventListener('click', () => {
    setPaused(true);
    const story = visible[position];
    document.dispatchEvent(new CustomEvent('raben:story-contact', { detail: { kind: story.kind, interest: story.interest } }));
  });
  share?.addEventListener('click', async event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    setPaused(true);
    const permalink = share.href;
    const storyTitle = visible[position].title;
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
  gallery.addEventListener('keydown', event => {
    if (![previous, next, play, gallery].includes(event.target)) return;
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    move(event.key === 'ArrowLeft' ? 1 : -1, true);
  });
  gallery.addEventListener('pointerenter', event => {
    if (event.pointerType === 'mouse' || event.pointerType === 'pen') {
      hovered = true;
      armTimer();
    }
  });
  gallery.addEventListener('pointermove', event => {
    if (resumeOnPlay && !play.contains(event.target)) {
      resumeOnPlay = false;
      armTimer();
    }
  });
  gallery.addEventListener('pointerleave', () => { hovered = false; armTimer(); });
  gallery.addEventListener('focusin', event => {
    if (event.target !== play) resumeOnPlay = false;
    armTimer();
  });
  gallery.addEventListener('focusout', () => queueMicrotask(armTimer));
  document.addEventListener('visibilitychange', () => { stagePhotos(); armTimer(); });
  motion.addEventListener('change', event => { if (event.matches) setPaused(true); });

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
      armTimer();
    }, { threshold: [0, .15] }).observe(gallery);
  } else {
    near = true;
    setPaused(true);
  }

  enhanced.hidden = false;
  const fallback = find('static');
  if (fallback) fallback.hidden = true;
  setPaused(paused);
  if (!followHash()) {
    let lastFilter;
    try { lastFilter = sessionStorage.getItem('raben-story-filter'); } catch { /* Storage may be unavailable. */ }
    if (!lastFilter || !selectFilter(lastFilter, false)) render(false);
  }
})();
