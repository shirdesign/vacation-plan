# TripTrack ✈️ — תכנון ומעקב טיול משפחתי

אפליקציית ווב (PWA) בעברית לתכנון טיולים: מסלול יומי, תקציב והוצאות, טיסות פנים, המלצות לכל מקום, מפת מסלול ושיתוף עם המשפחה.

## תוכן עניינים

- [פיצ'רים](#פיצרים)
- [טכנולוגיות](#טכנולוגיות)
- [התקנה והרצה](#התקנה-והרצה)
- [משתני סביבה](#משתני-סביבה)
- [מבנה הפרויקט](#מבנה-הפרויקט)
- [מודל הנתונים](#מודל-הנתונים)
- [ראוטים ו־API](#ראוטים-ו-api)
- [אבטחה](#אבטחה)
- [שירותים חיצוניים](#שירותים-חיצוניים)

## פיצ'רים

### 🧳 ניהול טיולים
- יצירת טיול: שם, יעד, תאריכים, תיאור, תקציב כולל/יומי ומטבע.
- **עריכת טיול** (`/trips/[id]/edit`): שינוי כל הפרטים כולל תאריכים — עם אזהרה ומחיקה מבוקרת של ימים מתוכננים שיוצאים מהטווח החדש.
- ייבוא פרטי טיול מקובץ (Word/Excel) בעת היצירה.

### 🗓️ מסלול יומי (`/trips/[id]/itinerary`)
- כרטיס לכל יום: כותרת, מיקום, פעילויות והערות. סימון מיוחד לשישי (ערב שבת) ושבת.
- **שתי תצוגות**: רשימה או **לוח שנה חודשי** — גריד עברי (ראשון–שבת) שמציג לכל יום את מספר יום הטיול, מיקום, כותרת, מספר פעילויות וסימון טיסה. לחיצה על יום פותחת אותו לעריכה.
- פעילויות עם שעה, תיאור, מיקום וסטטוס (מתוכנן / בוצע / בוטל), כולל **העברת פעילות ליום אחר**.
- **תכנון AI**: כפתור שממלא את הימים הריקים במסלול מלא (כותרות, פעילויות, טיפים) לפי היעד, התקציב וההעדפות — בהתחשבות בשבת ובימי הגעה/עזיבה.

### 💰 תקציב והוצאות (`/trips/[id]/budget`)
- קטגוריות תקציב עם סכום משוער מול בפועל, כולל קטגוריות "קבועות" (טיסות, ביטוח) שמוחרגות מחישוב הממוצע היומי.
- הוספת הוצאה מהירה עם המרת מטבע (שער ניתן לעריכה).
- בעמוד הטיול: סיכום תקציב, "נשאר ליום", ממוצע יומי עם/בלי הוצאות קבועות.

### ✈️ טיסות פנים
- סקשן בעמוד הטיול: מוצא→יעד, תאריך, שעה, חברת תעופה, מספר טיסה, מחיר וסטטוס הזמנה.
- טיסה שמסומנת "הוזמן" נרשמת אוטומטית כהוצאה בקטגוריה קבועה **"טיסות פנים"** בתקציב; ביטול הסימון או מחיקה מסירים את ההוצאה.
- הטיסות מוצגות ביום המתאים במסלול ובלוח השנה.

### 📍 מקומות — "מה עושים בכל מקום" (`/trips/[id]/places`)
- קיבוץ אוטומטי של ימי הטיול לפי מיקום: באילו ימים נמצאים בכל מקום, מה כבר מתוכנן שם, ואילו טיפים שייכים אליו.
- **הצעות AI**: כפתור "מה יש לעשות כאן?" מביא 8–12 פעילויות מגוונות (אטרקציות, אוכל, טבע, קניות, תרבות, משפחה) עם עלות משוערת. כל הצעה ניתנת להוספה בלחיצה כפעילות ביום נבחר.

### 🗺️ מפת מסלול
- מפה (Leaflet + OpenStreetMap) בעמוד הטיול ובעמוד השיתוף: סמנים ממוספרים לפי ימי הטיול (ימים רצופים באותו מקום מאוחדים לסמן אחד), קו מסלול ופופאפ עם פרטי היום.
- **גיאוקודינג אוטומטי** (Nominatim): שמירת מיקום ליום שולפת קואורדינטות; כפתור "אתרי מיקומים" ממלא בבת אחת את כל הימים שחסרות להם.

### 🔗 שיתוף (`/share/[token]`)
- קישור ציבורי לקריאה בלבד (ללא התחברות) עם טוגלים למסלול ולתקציב.
- כולל את מפת המסלול, סימון "היום" וקפיצה אליו.

### ✅ עוד
- צ'קליסט לפני נסיעה, טיפים והמלצות לפי מקום וקטגוריה (כולל כשר/חב"ד), אנשי קשר לחירום.
- PWA: מתווסף למסך הבית עם אייקון ושם.

## טכנולוגיות

| רכיב | טכנולוגיה |
|---|---|
| פריימוורק | Next.js 16 (App Router, Turbopack) + React 19 |
| שפה | TypeScript |
| עיצוב | Tailwind CSS 4, RTL מלא, פונט Rubik |
| דאטהבייס + אימות | Supabase (PostgreSQL + Auth + RLS) |
| AI | Anthropic API (Claude) — תכנון מסלול והצעות פעילויות |
| מפות | react-leaflet 5 + OpenStreetMap + Nominatim |
| תאריכים | date-fns (לוקאל עברי) |
| ייבוא קבצים | mammoth (Word), xlsx (Excel) |

## התקנה והרצה

```bash
npm install
cp .env.example .env.local   # או ליצור ידנית — ראו משתני סביבה
npm run dev                  # http://localhost:3000
```

פקודות נוספות: `npm run build` (בילד פרודקשן), `npm run lint`.

## משתני סביבה

| משתנה | תיאור |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | כתובת פרויקט ה־Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | מפתח anon (public) של Supabase |
| `ANTHROPIC_API_KEY` | מפתח Anthropic — נדרש רק לפיצ'רי ה־AI (תכנון מסלול והצעות פעילויות) |

## מבנה הפרויקט

```
src/
├── app/
│   ├── page.tsx                        # רידיירקט ל־/dashboard
│   ├── layout.tsx                      # שורש: RTL, פונט, מטא
│   ├── dashboard/                      # רשימת הטיולים
│   ├── auth/login, auth/register       # התחברות והרשמה (Supabase Auth)
│   ├── trips/new                       # יצירת טיול (+ייבוא מקובץ)
│   ├── trips/[id]                      # עמוד טיול: תקציב, מפה, טיסות, צ'קליסט...
│   │   ├── edit                        # עריכת פרטי הטיול
│   │   ├── itinerary                   # מסלול יומי (רשימה + לוח שנה)
│   │   ├── budget                      # תקציב והוצאות
│   │   └── places                      # מה עושים בכל מקום (+AI)
│   ├── share/[token]                   # עמוד שיתוף ציבורי
│   └── api/
│       ├── plan-trip                   # POST — תכנון מסלול AI לימים ריקים
│       └── suggest-activities          # POST — הצעות פעילויות AI למקום
├── components/
│   ├── trips/       # DayCard, TripCalendar, ItineraryClient, FlightsSection, EditTripForm...
│   ├── budget/      # BudgetClient, BudgetPlanner, AddExpenseForm
│   ├── places/      # PlacesClient
│   ├── map/         # TripMap (Leaflet), TripMapSection (עטיפה + גיאוקודינג)
│   ├── share/       # JumpToToday
│   └── ui/          # NavBar
├── lib/
│   ├── types.ts     # טיפוסי הדאטה (Trip, TripDay, DayEvent, TripFlight...)
│   ├── geocode.ts   # גיאוקודינג Nominatim
│   └── supabase/    # client.ts (דפדפן) / server.ts (שרת)
└── proxy.ts         # middleware: אכיפת התחברות + ניתוב auth
```

## מודל הנתונים

כל הטבלאות ב־Supabase (PostgreSQL) עם **RLS פעיל** — כל שורה נגישה רק לבעלי הטיול (`trips.user_id = auth.uid()`).

| טבלה | תפקיד | שדות עיקריים |
|---|---|---|
| `trips` | הטיול | name, destination, start/end_date, total/daily_budget, currency, share_token, share_show_itinerary/budget |
| `trip_days` | יום בטיול | date, title, notes, location_name, location_lat/lng |
| `day_events` | פעילות ביום | title, description, location, start/end_time, status (planned/done/cancelled), sort_order |
| `budget_categories` | קטגוריית תקציב | name, icon, planned_amount, is_fixed |
| `expenses` | הוצאה | description, amount, currency, date, category_id, day_id, notes |
| `trip_flights` | טיסת פנים | from/to_location, flight_date, depart_time, airline, flight_number, price, is_booked, expense_id |
| `place_activities` | הצעת פעילות למקום | location, title, description, category, est_cost, source (ai/manual), added_event_id |
| `trip_checklists` | צ'קליסט | text, is_done |
| `trip_tips` | טיפים לפי מקום | location, category (food/kosher/chabad/...), tip, source |
| `trip_emergency_contacts` | אנשי קשר לחירום | name, role, phone, notes |
| `profiles` | פרופיל משתמש | מקושר ל־auth.users |

**פונקציות RPC:**
- `get_shared_trip(token)` — ‏SECURITY DEFINER; מחזירה טיול+ימים+פעילויות+טיפים (+הוצאות אם שיתוף תקציב פעיל) לפי share_token, לצריכת עמוד השיתוף ללא התחברות.
- `create_default_categories(trip_uuid)` — יוצרת קטגוריות תקציב ברירת מחדל לטיול חדש.

**קשרים:** `trip_flights.expense_id → expenses` (טיסה שהוזמנה ↔ ההוצאה שלה), `place_activities.added_event_id → day_events` (הצעה שנוספה למסלול ↔ הפעילות שנוצרה). מחיקת טיול גוררת מחיקת כל הנתונים (ON DELETE CASCADE).

## ראוטים ו־API

| Method | נתיב | אימות | תיאור |
|---|---|---|---|
| GET | כל עמודי `/dashboard`, `/trips/*` | חובה (middleware) | עמודי האפליקציה |
| GET | `/share/[token]` | ללא | עמוד שיתוף ציבורי דרך RPC |
| POST | `/api/plan-trip` | חובה + בעלות על הטיול | `{ tripId, preferences? }` → תכנון AI לימים הריקים בלבד |
| POST | `/api/suggest-activities` | חובה + בעלות על הטיול | `{ tripId, location }` → הצעות פעילויות, נשמרות ב־place_activities |

## אבטחה

- **Middleware** (`src/proxy.ts`): כל נתיב מלבד `/share/*` ו־`/auth/*` דורש סשן Supabase.
- **RLS** על כל הטבלאות; קומפוננטות client עובדות ישירות מול Supabase עם מפתח anon ותלויות ב־RLS.
- **API routes** מאמתות סשן ובעלות (`user_id`) לפני כל פעולה.
- עמוד השיתוף חושף רק את השדות שהוא מציג (הקרנה מפורשת של נתוני המפה) ומכבד את דגלי `share_show_itinerary` / `share_show_budget`.

## שירותים חיצוניים

| שירות | שימוש | מפתח? |
|---|---|---|
| Supabase | DB, Auth, RLS | כן (env) |
| Anthropic API | תכנון מסלול והצעות פעילויות | כן (env, אופציונלי) |
| OpenStreetMap tiles | אריחי המפה | לא |
| Nominatim | גיאוקודינג שמות מקומות (מהדפדפן, בקצב מנומס של בקשה לשנייה) | לא |
