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
    const result = element('p', 'gp-result');
    result.setAttribute('role', 'status');
    return result;
  }

  function button(label, click) {
    const control = element('button', 'gp-button', label);
    control.type = 'button';
    control.addEventListener('click', click);
    return control;
  }

  // Only results and pressed states change. Controls keep focus after an action.
  function example(id, min, max, initial, build) {
    return (container, state, onChange) => {
      if (!Number.isInteger(state.choice) || state.choice < min || state.choice > max) {
        state.choice = initial;
      }
      const panel = element('section', 'gp-preview gp-' + id);
      panel.dir = 'rtl';
      const update = build(panel, value => {
        state.choice = value;
        update(value);
        onChange?.();
      }, () => state.choice);
      update(state.choice);
      container.replaceChildren(panel);
    };
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
      result.textContent = index < 0 ? 'בחרו תאריך כדי לבדוק אם יש מקום.' :
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
    const mark = choices(panel, 'הצביעו ליום שנוח לכם', days, select);
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
      result.textContent = index < 0 ? standing : 'בחרתם ביום ' + days[index] + '. ' + standing;
    };
  });

  window.RABEN_STORIES = [
    {
      id: 'ceramics', category: 'clients', title: 'לבחור מועד לסדנה',
      alt: 'ספל קרמיקה בזיגוג כחול בסטודיו', caption: 'בסדנת הקרמיקה מכינים ספל בזיגוג כחול. בוחרים תאריך ורואים כמה מקומות נשארו במפגש.',
      cta: 'נדבר על אתר לסדנה שלי', kind: website, interest: 'אתר לסדנה עם בחירת מועד', render: pottery
    },
    {
      id: 'bakery', category: 'clients', title: 'לבחור עוגה לפי מספר האורחים',
      alt: 'עוגת תותים במאפייה', caption: 'במאפייה בוחרים לכמה אנשים תספיק עוגת התותים, ומיד רואים את הגודל והמחיר.',
      cta: 'נדבר על אתר למוצרים שלי', kind: website, interest: 'עמוד מוצרים עם בחירת גודל ומחיר', render: cake
    },
    {
      id: 'guitar', category: 'clients', title: 'למצוא שעה לשיעור גיטרה ראשון',
      alt: 'גיטרה בשיעור נגינה', caption: 'תלמידים בוחרים שיעור אישי או זוגי ורואים מתי אפשר להגיע.',
      cta: 'נדבר על אתר לשיעורים שלי', kind: website, interest: 'אתר לשיעורים עם הצגת שעות פנויות', render: lesson
    },
    {
      id: 'technician', category: 'work', title: 'לסיים ביקור ולראות מי הבא בתור',
      alt: 'טכנאית בודקת מכונת כביסה בביקור בית', caption: 'הטכנאית מסמנת שתיקון מכונת הכביסה הסתיים, ומיד רואה אצל מי הביקור הבא ומתי הוא מתחיל.',
      cta: 'נדבר על יומן לעבודה שלי', kind: tool, interest: 'יומן לניהול ביקורים בשטח', render: visits
    },
    {
      id: 'community', category: 'work', title: 'לדעת למי עוד צריך לחזור',
      alt: 'פעילות במרכז קהילתי', caption: 'הצוות יכול להתמקד בפניות על חוגים שעדיין מחכות לתשובה.',
      cta: 'נדבר על מעקב אחרי פניות', kind: tool, interest: 'מעקב אחרי פניות שממתינות לתשובה', render: inbox
    },
    {
      id: 'volunteer', category: 'work', title: 'למצוא מי יאסוף את ארגזי הירקות',
      alt: 'מתנדבים עם ארגזי ירקות לחלוקה', caption: 'לצוות החלוקה נשאר לאסוף ארגזי ירקות. בוחרים מי ייצא לאיסוף, וכולם רואים שהמשימה אוישה.',
      cta: 'נדבר על שיבוץ בצוות שלי', kind: tool, interest: 'כלי לשיבוץ מתנדבים ומשמרות', render: assign
    },
    {
      id: 'study', category: 'ideas', title: 'למצוא עם מי לתרגל אנגלית בערב',
      alt: 'חוברת תרגול אנגלית במפגש לימוד', caption: 'רוצים לתרגל שיחה באנגלית? מסך התאמה מוצא שותף ללימוד שפנוי בערב כמוכם.',
      cta: 'נדבר על הרעיון שלי', kind: product, interest: 'אפליקציה להתאמה בין אנשים', render: match
    },
    {
      id: 'hiking', category: 'ideas', title: 'לקבוע יום לטיול בהצבעה',
      alt: 'מטיילים נעזרים במפת שבילים', caption: 'חברי הקבוצה בוחרים יום ליציאה לשביל ורואים איזה מועד מוביל, גם כשההצבעה צמודה.',
      cta: 'נדבר על כלי לקבוצה שלי', kind: product, interest: 'רעיון להצבעות ותיאום בקבוצה', render: poll
    }
  ];
})();
