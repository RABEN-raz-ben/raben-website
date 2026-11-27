(() => {
  "use strict";
  const byId = id => document.getElementById(id);
  const dialog = byId("project-view");
  const stage = byId("project-stage");
  const about = byId("project-about");
  const closeButton = byId("project-close");
  const demoButton = dialog.querySelector('[data-view="demo"]');
  const aboutButton = dialog.querySelector('[data-view="about"]');
  const gallery = byId("project-gallery");
  const galleryOpen = byId("project-gallery-open");
  const wallOpen = byId("project-wall-open");
  const galleryClose = byId("project-gallery-close");
  const galleryScroll = byId("project-gallery-scroll");
  const galleryStatus = byId("project-gallery-status");
  const galleryGrid = byId("project-gallery-grid");
  let catalogRequest, opener, activeProject, pending = 0, galleryOpener, galleryReady = false;
  galleryOpen.hidden = false;

  function catalog() {
    if (!catalogRequest) {
      catalogRequest = fetch("assets/projects/catalog.json").then(response => {
        if (!response.ok) throw new Error("Project catalog unavailable");
        return response.json();
      }).catch(error => { catalogRequest = null; throw error; });
    }
    return catalogRequest;
  }

  async function openGallery(trigger) {
    if (gallery.open) return;
    galleryOpener = trigger;
    gallery.showModal();
    galleryClose.focus({preventScroll:true});
    if (galleryReady) return;
    galleryStatus.textContent = "טוען את הפרויקטים…";
    try {
      const projects = await catalog();
      const links = [...document.querySelectorAll(".project-list a[data-project]")];
      galleryGrid.replaceChildren(...links.flatMap((original, index) => {
        const item = projects[original.dataset.project];
        if (!item) return [];
        const link = document.createElement("a");
        link.dataset.project = original.dataset.project;
        link.href = original.href;
        link.className = "project-gallery-card";
        link.setAttribute("aria-haspopup", "dialog");
        const figure = document.createElement("div");
        figure.className = "project-gallery-image";
        const img = document.createElement("img");
        img.src = item.image;
        img.alt = "";
        img.decoding = "async";
        if (index > 2) img.loading = "lazy";
        figure.append(img);
        const copy = document.createElement("div");
        copy.className = "project-gallery-card-copy";
        const meta = document.createElement("p");
        meta.textContent = item.subtitle + " · " + item.label;
        const name = document.createElement("h3");
        name.lang = item.lang || "en";
        name.dir = item.dir || "ltr";
        name.textContent = item.name;
        const action = document.createElement("span");
        action.textContent = "לפרויקט ↗";
        action.className = "project-gallery-action";
        action.setAttribute("aria-hidden", "true");
        copy.append(meta, name, action);
        link.append(figure, copy);
        return [link];
      }));
      galleryStatus.textContent = "בחרו פרויקט כדי לראות מה הוא עושה ולפתוח אותו.";
      galleryReady = true;
    } catch {
      galleryStatus.textContent = "הלוח לא נטען. אפשר לסגור ולנסות שוב, או לבחור פרויקט מהרשימה בחדר.";
    }
  }

  [galleryOpen, wallOpen].forEach(trigger => trigger.addEventListener("click", () => openGallery(trigger)));
  galleryClose.addEventListener("click", () => gallery.close());
  gallery.addEventListener("click", event => {
    if (event.target !== gallery) return;
    const r = gallery.getBoundingClientRect();
    if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) gallery.close();
  });
  gallery.addEventListener("close", () => {
    galleryScroll.scrollTop = 0;
    if (galleryOpener?.isConnected && !galleryOpener.hidden && document.activeElement === document.body) {
      galleryOpener.focus({preventScroll:true});
    }
  });

  function showView(name) {
    const live = name === "demo" && Boolean(activeProject?.demo);
    demoButton.setAttribute("aria-pressed", String(live));
    aboutButton.setAttribute("aria-pressed", String(!live));
    stage.hidden = !live;
    about.hidden = live;
    if (live && !stage.firstElementChild) {
      const frame = document.createElement("iframe");
      frame.title = "הדגמת " + activeProject.name;
      frame.referrerPolicy = "no-referrer";
      frame.src = activeProject.demo;
      frame.addEventListener("load", () => {
        // Escape returns a visitor whose keyboard focus is inside a local demo.
        frame.contentDocument?.addEventListener("keydown", event => {
          if (event.key === "Escape" && !event.defaultPrevented && dialog.open) dialog.close();
        });
      });
      stage.append(frame);
    }
  }

  function renderCase(project) {
    const c = project.case;
    const panel = byId("project-case");
    panel.hidden = !c;
    dialog.classList.toggle("project-has-case", Boolean(c));
    dialog.dataset.caseStyle = c?.style || "";
    if (!c) return;
    byId("project-case-kicker").textContent = "מתיק העבודות · " + c.category;
    byId("project-case-intro").textContent = c.intro;
    byId("project-case-tags").replaceChildren(...c.tags.map(text => {
      const tag = document.createElement("li");
      tag.textContent = text;
      return tag;
    }));
    const photo = byId("project-case-photo");
    photo.hidden = !c.photo;
    if (c.photo) photo.src = project.image;
    else photo.removeAttribute("src");
    const link = byId("project-case-open");
    link.href = project.website;
    link.textContent = project.websiteAction;
    const picker = byId("project-case-picker");
    const buttons = c.screens.map((screen, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("aria-controls", "project-case-image");
      button.textContent = screen.name;
      button.addEventListener("click", () => select(index));
      return button;
    });
    function select(index) {
      buttons.forEach((button, i) => button.setAttribute("aria-pressed", String(i === index)));
      const screen = c.screens[index];
      const img = byId("project-case-image");
      img.src = screen.src;
      img.alt = screen.alt;
      byId("project-case-caption").textContent = screen.caption;
    }
    picker.replaceChildren(...buttons);
    select(0);
  }

  async function openProject(link) {
    const request = ++pending;
    let project;
    try { project = (await catalog())[link.dataset.project]; } catch {}
    if (request !== pending || !link.isConnected) return;
    if (!project) { location.assign(link.href); return; }
    opener = link;
    activeProject = project;
    renderCase(project);
    dialog.classList.toggle("project-website", Boolean(project.website));
    dialog.classList.toggle("project-interface", project.imageType === "interface");
    byId("project-close-label").textContent = gallery.open ? "חזרה ללוח הגדול" : "חזרה ללוח";
    const title = byId("project-name");
    title.textContent = project.name;
    title.lang = project.lang || "en";
    title.dir = project.dir || "ltr";
    byId("project-context").textContent = project.subtitle + " · " + project.label;
    byId("project-summary").textContent = project.summary;
    byId("project-facts").replaceChildren(...project.facts.map(text => {
      const item = document.createElement("li");
      item.textContent = text;
      return item;
    }));
    byId("project-edition").textContent = project.edition;
    byId("project-image").src = project.image;
    byId("project-image").alt = project.caption;
    byId("project-caption").textContent = project.caption;
    const fullLink = byId("project-full");
    fullLink.href = project.website || project.demo || link.href;
    fullLink.textContent = project.websiteAction || "פתיחה בחלון נפרד";
    demoButton.hidden = !project.demo;
    stage.replaceChildren();
    if (!dialog.open) dialog.showModal();
    showView(project.demo ? "demo" : "about");
    about.scrollTop = 0;
    closeButton.focus({preventScroll:true});
  }

  document.addEventListener("click", event => {
    const link = event.target.closest("a[data-project]");
    if (!link || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    openProject(link);
  });
  demoButton.onclick = () => showView("demo");
  aboutButton.onclick = () => showView("about");
  closeButton.onclick = () => dialog.close();
  dialog.addEventListener("click", event => {
    if (event.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close();
  });
  dialog.addEventListener("close", () => {
    ++pending;
    stage.replaceChildren();
    activeProject = null;
    if (opener?.isConnected && !opener.hidden && document.activeElement === document.body) opener.focus({preventScroll:true});
  });
})();
