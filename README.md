# RABEN · הסטודיו של רז ובן

אתר בעברית לעיצוב ופיתוח אתרים, כלים לעבודה ומוצרים דיגיטליים. אפשר לבחור צורך, לפתוח דוגמה ולפנות ישירות לרז ובן. העמוד כתוב ב־HTML, CSS ו־JavaScript ופועל ללא שלב בנייה.

![מסך הבית במחשב](docs/screenshots/desktop.png)

[תצוגת נייד](docs/screenshots/mobile.png) · [העמוד המלא](docs/screenshots/desktop-full.png) · [דוגמאות לשירותים](docs/screenshots/examples.png) · [טופס הפנייה](docs/screenshots/contact.png)

## הרצה

מתוך תיקיית `site` מריצים

```sh
python3 -m http.server 4173 --bind 127.0.0.1 --directory dist
```

פותחים את [האתר המקומי](http://localhost:4173). להרצה שכוללת גם את פונקציית אימות העבודות משתמשים ב־`vercel dev` מאותה תיקייה. בשרת הסטטי אזור העבודות נשאר מוסתר.

## מבנה הפרויקט

| מיקום | אחריות |
| --- | --- |
| `dist/index.html` | תוכן האתר בעברית, קישורי הניווט, הדוגמאות, השאלות וטופס הפנייה |
| `dist/styles.css` | טיפוגרפיה, פתיח, ניווט והתאמות לנייד |
| `dist/services.css`, `dist/services.js` | המחשות לשירותים והעברת הבחירה לטופס |
| `dist/journey.css`, `dist/app.js` | תהליך העבודה, שאלות, עבודות מאומתות וטיפול בפנייה |
| `dist/assets/` | קובצי תמונה מקומיים |
| `dist/content.js` | הגדרות ציבוריות ורשימת מועמדים להצגה בתיק העבודות |
| `api/projects.js`, `lib/` | אימות זמינות והרשאה להצגת עבודות ומטמון תוצאות |

## פניות ועבודות

הדוגמאות לשירותים נפתחות גם ללא JavaScript. לאחר בחירת הקישור בתוך דוגמה, JavaScript ממלא את נושא הפנייה. אפשר לשנות אותו או לבחור לחשוב יחד. השליחה מתבצעת באמצעות FormSubmit. במקרה של כשל הפרטים נשמרים בטופס ואפשר להעתיק הודעה מוכנה לאינסטגרם. כתובת הטופס וקישור האינסטגרם מופיעים גם ב־HTML לשימוש ללא JavaScript.

עבודות מוצגות רק בעקבות אישור לפרסום ואימות ציבורי בשרת. רשימה ריקה מסתירה גם את הקישור בניווט. [מבנה הרשומות ואופן האימות](docs/PROJECT-VERIFICATION.md)

## בדיקות

```sh
node --test tests/project-verifier.test.js
node --check dist/app.js
node --check dist/services.js
node --check dist/content.js
git diff --check
```

## פריסה

שורש פרויקט Vercel הוא `site`. הקובץ `vercel.json` מגדיר פלט סטטי מתוך `dist` ופונקציית Node.js לאימות עבודות. הפריסה ידנית באמצעות `vercel deploy --prod` מתוך תיקיית הפרויקט המקושרת.

[אתר RABEN בייצור](https://site-alpha-kohl-60.vercel.app)
