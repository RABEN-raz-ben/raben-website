// All interactions are local to the example. The gallery owns persistence and navigation.
(() => {
  const website = 'אתר או ממשק';
  const tool = 'כלי לעסק';
  const product = 'רעיון למוצר';

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function photo(id) {
    const image = element('img', 'gp-photo');
    image.src = 'assets/gallery/' + id + '-small.webp';
    image.alt = ''; // The gallery's main photograph already describes the scene.
    image.loading = 'lazy';
    image.decoding = 'async';
    return image;
  }

  function output() {
    return element('p', 'gp-result');
  }

  function button(label, click) {
    const control = element('button', 'gp-button', label);
    control.type = 'button';
    control.addEventListener('click', click);
    return control;
  }

  // Each mounted instance has a displayed choice independent of its visitor's saved choice.
  function example(id, min, max, initial, build) {
    const instances = new WeakMap();

    function render(container, state, onChange) {
      const valid = Number.isInteger(state.choice) && state.choice >= min && state.choice <= max;
      let shown = valid ? state.choice : initial;
      if (!valid) delete state.choice;

      const panel = element('section', 'gp-preview gp-' + id);
      panel.dir = 'rtl';
      const announcement = element('span', 'gp-announcement');
      announcement.setAttribute('role', 'status');
      const update = build(panel, value => {
        shown = value;
        state.choice = value;
        update(value);
        announcement.textContent = panel.querySelector('.gp-result').textContent;
        onChange?.();
      }, () => shown);

      update(shown);
      panel.append(announcement);
      container.replaceChildren(panel);
      instances.set(panel, () => {
        shown = shown < 0 ? 1 : (shown + 1) % (max + 1);
        update(shown);
      });
    }

    function demonstrate(container) {
      instances.get(container.firstElementChild)?.();
    }

    return { render, demonstrate };
  }

  function header(panel, name, heading, id) {
    const head = element('header', 'gp-head');
    const text = element('div', 'gp-head-copy');
    const title = element('h3', 'gp-title', heading);
    const brand = element('p', 'gp-brand', name);
    const isStorefront = id === 'ceramics' || id === 'bakery' || id === 'guitar';
    if (isStorefront) {
      panel.classList.add('gp-storefront');
      const mark = element('span', 'gp-brand-mark');
      mark.setAttribute('aria-hidden', 'true');
      brand.prepend(mark);
      panel.append(brand);
      text.append(title);
    } else {
      text.append(brand, title);
    }
    head.append(text);
    if (id) head.append(photo(id));
    panel.setAttribute('aria-label', name + ' — ' + heading);
    panel.append(head);
  }

  function choices(panel, label, options, select) {
    const labelNode = element('p', 'gp-label', label);
    const group = element('div', 'gp-choices');
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', label);
    const controls = options.map((option, index) => button(option, () => select(index)));
    group.append(...controls);
    panel.append(labelNode, group);
    return current => controls.forEach((control, index) => {
      control.setAttribute('aria-pressed', String(index === current));
    });
  }

  const pottery = example('ceramics', -1, 2, -1, (panel, select) => {
    header(panel, 'ידיים בחומר', 'סדנה להכנת ספל כחול', 'ceramics');
    const dates = ['12.1', '19.1', '26.1'];
    const places = [4, 2, 5];
    const mark = choices(panel, 'לאיזה מפגש להצטרף?', dates, select);
    const result = output();
    panel.append(result);
    return index => {
      mark(index);
      result.textContent = index < 0 ? 'שלושה מועדים לסדנה, כולם בשעה 18:00.' :
        'המפגש ב־' + dates[index] + ' בשעה 18:00 · נשארו ' + places[index] + ' מקומות.';
    };
  });

  const cake = example('bakery', 0, 2, 0, (panel, select) => {
    header(panel, 'המאפייה השכונתית', 'עוגת תותים וקצפת', 'bakery');
    const servings = ['6–8', '10–12', '14–16'];
    const sizes = [16, 20, 24];
    const prices = [120, 165, 210];
    const mark = choices(panel, 'כמה אנשים מגיעים?', servings, select);
    const result = output();
    panel.append(result);
    return index => {
      mark(index);
      result.textContent = 'עוגה בקוטר ' + sizes[index] + ' ס״מ · ' + prices[index] + ' ₪';
    };
  });

  const lesson = example('guitar', 0, 1, 0, (panel, select) => {
    header(panel, 'שיעורי גיטרה עם תום', 'שיעור הגיטרה הראשון שלי', 'guitar');
    const mark = choices(panel, 'בחירת סוג שיעור', ['שיעור אישי', 'שיעור בזוג'], select);
    const result = output();
    panel.append(result);
    return index => {
      mark(index);
      result.textContent = index === 0 ? 'שעות פנויות ביום שני · 16:00 או 18:30' :
        'שעות פנויות ביום רביעי · 17:00 או 19:00';
    };
  });

  const visits = example('technician', 0, 2, 0, (panel, select, current) => {
    header(panel, 'היומן של הטכנאית', 'הביקורים להיום');
    const schedule = [
      ['09:00', 'משפחת לוי', 'תיקון מכונת כביסה'],
      ['11:30', 'משפחת כהן', 'בדיקת משאבת ניקוז']
    ];
    const next = element('div', 'gp-visit');
    const time = element('bdi', 'gp-time');
    const customer = element('strong');
    const work = element('span');
    const copy = element('div');
    copy.append(customer, work);
    next.append(time, copy);
    const action = button('', () => select((current() + 1) % 3));
    const result = output();
    panel.append(next, action, result);
    return index => {
      next.hidden = index === schedule.length;
      if (!next.hidden) {
        [time.textContent, customer.textContent, work.textContent] = schedule[index];
      }
      action.textContent = next.hidden ? 'התחלת הסבב מחדש' : 'סימון הביקור כהושלם';
      result.textContent = ['נותרו שני ביקורים בסבב.', 'הביקור הראשון הושלם. המשימה הבאה כבר כאן.', 'שני הביקורים הושלמו.'][index];
    };
  });

  const inbox = example('community', 0, 1, 0, (panel, select) => {
    header(panel, 'המרכז הקהילתי', 'פניות על החוגים');
    const mark = choices(panel, 'אילו פניות להציג?', ['כל הפניות', 'ממתינות למענה'], select);
    const requests = [
      ['נועה', 'הרשמה לחוג ציור', false],
      ['יואב', 'שיעור ניסיון בכדורגל', true],
      ['סיוון', 'מקום בחוג מחול', false]
    ];
    const items = element('ul', 'gp-rows');
    const rows = requests.map(([name, subject, answered]) => {
      const row = element('li');
      row.append(element('span', '', name + ' · ' + subject), element('small', '', answered ? 'נענתה' : 'ממתינה'));
      items.append(row);
      return row;
    });
    const result = output();
    panel.append(items, result);
    return index => {
      mark(index);
      rows.forEach((row, pos) => { row.hidden = index === 1 && requests[pos][2]; });
      result.textContent = index === 1 ? 'מוצגות שתי הפניות שעוד מחכות לתשובה.' : 'שלוש פניות, שתיים מהן ממתינות למענה.';
    };
  });

  const assign = example('volunteer', -1, 1, -1, (panel, select) => {
    header(panel, 'ההתנדבות בשכונה', 'משימה פתוחה לחלוקה');
    const shift = element('p', 'gp-shift', 'איסוף ארגזי ירקות · חמישי, 17:00');
    const names = ['יעל', 'אמיר'];
    panel.append(shift);
    const mark = choices(panel, 'מי ייצא לחלוקה?', names, select);
    const result = output();
    panel.append(result);
    return index => {
      mark(index);
      result.textContent = index < 0 ? 'המשמרת פנויה לשיבוץ.' : 'המשימה אוישה. האיסוף באחריות ' + names[index] + '.';
    };
  });

  const match = example('study', -1, 1, -1, (panel, select, current) => {
    header(panel, 'לומדים יחד', 'שותף או שותפה לאנגלית', 'study');
    const preferences = element('div', 'gp-tags');
    preferences.append(element('span', '', 'תרגול שיחה'), element('span', '', 'בשעות הערב'));
    const result = output();
    const action = button('', () => select((current() + 1) % 2));
    panel.append(preferences, action, result);
    return index => {
      action.textContent = index < 0 ? 'מציאת התאמה' : 'הצגת התאמה נוספת';
      result.textContent = ['עדי רוצה לתרגל שיחה באנגלית ביום שני ב־19:00.', 'גיל רוצה לתרגל שיחה באנגלית ביום רביעי ב־20:00.'][index] ||
        'מחפשים אנשים שרוצים לתרגל באותו זמן.';
    };
  });

  const poll = example('hiking', -1, 2, -1, (panel, select) => {
    header(panel, 'יוצאים לשביל', 'מתי יוצאים לטיול?', 'hiking');
    const days = ['חמישי', 'שישי', 'שבת'];
    const baseVotes = [2, 3, 4];
    const mark = choices(panel, 'באיזה יום נוח לצאת?', days, select);
    const results = element('ul', 'gp-poll');
    const bars = days.map(day => {
      const row = element('li');
      const bar = element('i', 'gp-bar');
      bar.setAttribute('aria-hidden', 'true');
      const total = element('span');
      row.append(element('strong', '', day), bar, total);
      results.append(row);
      return {bar, total};
    });
    const result = output();
    panel.append(results, result);
    return index => {
      mark(index);
      bars.forEach(({bar, total}, pos) => {
        const votes = baseVotes[pos] + Number(pos === index);
        total.textContent = votes + ' קולות';
        bar.style.setProperty('--gp-share', (votes / 5 * 100) + '%');
      });
      const tallies = baseVotes.map((votes, pos) => votes + Number(pos === index));
      const leaders = days.filter((day, pos) => tallies[pos] === Math.max(...tallies));
      const standing = leaders.length > 1 ? 'תיקו בין ' + leaders.join(' ל') + '.' : 'היום המוביל הוא ' + leaders[0] + '.';
      result.textContent = index < 0 ? standing : 'נוסף קול ליום ' + days[index] + '. ' + standing;
    };
  });

  window.RABEN_STORIES = [
    {
      id: 'ceramics', category: 'clients', title: 'אתר הרשמה לסדנת קרמיקה',
      alt: 'ספל קרמיקה בזיגוג כחול בסטודיו', caption: 'המשתתפים רואים באילו מפגשים נשאר מקום. לבעלת הסדנה יש פחות הודעות לענות עליהן לפני כל הרשמה.',
      cta: 'נדבר על אתר לסדנה שלי', kind: website, interest: 'אתר לסדנה עם בחירת מועד', ...pottery
    },
    {
      id: 'bakery', category: 'clients', title: 'עמוד להזמנת עוגה ממאפייה ביתית',
      alt: 'עוגת תותים במאפייה', caption: 'הלקוחות בוחרים לכמה אורחים מיועדת העוגה ורואים מיד את הגודל והמחיר, עוד לפני שפונים לאופה.',
      cta: 'נדבר על אתר למוצרים שלי', kind: website, interest: 'עמוד מוצרים עם בחירת גודל ומחיר', ...cake
    },
    {
      id: 'guitar', category: 'clients', title: 'אתר לקביעת שיעור גיטרה',
      alt: 'גיטרה בשיעור נגינה', caption: 'התלמידים בוחרים סוג שיעור ורואים מתי המורה פנוי. כך קל למצוא שעה שמתאימה לשני הצדדים.',
      cta: 'נדבר על אתר לשיעורים שלי', kind: website, interest: 'אתר לשיעורים עם הצגת שעות פנויות', ...lesson
    },
    {
      id: 'technician', category: 'work', title: 'יומן ביקורי בית לטכנאית',
      alt: 'טכנאית בודקת מכונת כביסה בביקור בית', caption: 'בסיום תיקון הטכנאית מסמנת שהביקור הושלם. היומן מראה לה לאן להמשיך ובאיזו שעה להגיע.',
      cta: 'נדבר על יומן לעבודה שלי', kind: tool, interest: 'יומן לניהול ביקורים בשטח', ...visits
    },
    {
      id: 'community', category: 'work', title: 'מעקב אחרי פניות למרכז קהילתי',
      alt: 'פעילות במרכז קהילתי', caption: 'כשמתחלפת משמרת, הצוות רואה אילו הורים עדיין מחכים לתשובה על חוג ולמי כבר חזרו.',
      cta: 'נדבר על מעקב אחרי פניות', kind: tool, interest: 'מעקב אחרי פניות שממתינות לתשובה', ...inbox
    },
    {
      id: 'volunteer', category: 'work', title: 'לוח משימות לחלוקת סלי מזון',
      alt: 'מתנדבים עם ארגזי ירקות לחלוקה', caption: 'הרכזת משבצת מתנדב לאיסוף ארגזים. כולם רואים מי אחראי ומה עוד נשאר לעשות.',
      cta: 'נדבר על שיבוץ בצוות שלי', kind: tool, interest: 'כלי לשיבוץ מתנדבים ומשמרות', ...assign
    },
    {
      id: 'study', category: 'ideas', title: 'אפליקציה למציאת שותף ללימוד',
      alt: 'חוברת תרגול אנגלית במפגש לימוד', caption: 'רוצים לתרגל אנגלית בערב? האפליקציה מציעה מישהו שרוצה ללמוד אותו דבר ופנוי באותן שעות.',
      cta: 'נדבר על הרעיון שלי', kind: product, interest: 'אפליקציה להתאמה בין אנשים', ...match
    },
    {
      id: 'hiking', category: 'ideas', title: 'כלי לבחירת מועד לטיול עם חברים',
      alt: 'מטיילים נעזרים במפת שבילים', caption: 'כל אחד מצביע ליום שנוח לו. הקבוצה רואה איזה יום מתאים לרוב החברים וחוסכת את ספירת התשובות בצ׳אט.',
      cta: 'נדבר על כלי לקבוצה שלי', kind: product, interest: 'רעיון להצבעות ותיאום בקבוצה', ...poll
    }
  ];
})();
